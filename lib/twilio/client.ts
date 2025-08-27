import twilio from 'twilio';

// Twilio configuration
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const whatsappFrom = process.env.TWILIO_WHATSAPP_FROM;

// Initialize Twilio client
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SendWhatsAppMessageResult {
  success: boolean;
  messageSid?: string;
  messageId?: string;
  sid?: string;
  status?: string;
  error?: string;
  errorCode?: string;
}

export interface TwilioTestResult {
  success: boolean;
  details?: {
    accountSid: string;
    accountStatus: string;
    friendlyName: string;
  };
  error?: string;
}

/**
 * Send a WhatsApp message using Twilio
 */
export async function sendWhatsAppMessage(
  toPhone: string,
  message: string,
  options: { test?: boolean; operation?: string; activityId?: string; staffId?: string } = {}
): Promise<SendWhatsAppMessageResult> {
  try {
    // Validate configuration
    if (!client) {
      console.error('❌ Twilio client not configured - missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
      return {
        success: false,
        error: 'Twilio client not configured',
        errorCode: 'TWILIO_NOT_CONFIGURED'
      };
    }

    if (!whatsappFrom) {
      console.error('❌ Twilio WhatsApp sender not configured - missing TWILIO_WHATSAPP_FROM');
      return {
        success: false,
        error: 'WhatsApp sender not configured',
        errorCode: 'WHATSAPP_FROM_NOT_CONFIGURED'
      };
    }

    // Format phone numbers for WhatsApp
    const formattedTo = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;
    const formattedFrom = whatsappFrom.startsWith('whatsapp:') ? whatsappFrom : `whatsapp:${whatsappFrom}`;

    console.log(`📤 Sending WhatsApp message via Twilio:`);
    console.log(`  To: ${maskPhone(toPhone)}`);
    console.log(`  From: ${maskPhone(whatsappFrom)}`);
    console.log(`  Message length: ${message.length}`);
    console.log(`  Test mode: ${options.test ? 'Yes' : 'No'}`);

    // Send message via Twilio
    const twilioMessage = await client.messages.create({
      body: message,
      from: formattedFrom,
      to: formattedTo,
      // Add status callback URL for message delivery tracking
      statusCallback: process.env.VERCEL_URL 
        ? `https://${process.env.VERCEL_URL}/api/twilio/status`
        : process.env.NODE_ENV === 'production'
        ? `${process.env.NEXTAUTH_URL}/api/twilio/status`
        : 'http://localhost:3000/api/twilio/status'
    });

    console.log(`✅ WhatsApp message sent successfully via Twilio:`);
    console.log(`  Message SID: ${twilioMessage.sid}`);
    console.log(`  Status: ${twilioMessage.status}`);
    console.log(`  Direction: ${twilioMessage.direction}`);

    return {
      success: true,
      messageSid: twilioMessage.sid,
      messageId: twilioMessage.sid,
      sid: twilioMessage.sid,
      status: twilioMessage.status
    };

  } catch (error: any) {
    console.error('❌ Failed to send WhatsApp message via Twilio:', error);
    
    // Extract Twilio error information if available
    const errorCode = error.code || 'UNKNOWN_ERROR';
    const errorMessage = error.message || 'Unknown error occurred';
    const moreInfo = error.moreInfo || null;

    console.error(`  Error Code: ${errorCode}`);
    console.error(`  Error Message: ${errorMessage}`);
    if (moreInfo) console.error(`  More Info: ${moreInfo}`);

    return {
      success: false,
      error: errorMessage,
      errorCode: errorCode
    };
  }
}

/**
 * Test Twilio configuration and account status
 */
export async function testConfiguration(): Promise<TwilioTestResult> {
  try {
    if (!client || !accountSid) {
      return {
        success: false,
        error: 'Twilio client not configured - missing credentials'
      };
    }

    // Test by fetching account information
    const account = await client.api.v2010.accounts(accountSid).fetch();

    return {
      success: true,
      details: {
        accountSid: account.sid,
        accountStatus: account.status,
        friendlyName: account.friendlyName
      }
    };
  } catch (error: any) {
    console.error('❌ Twilio configuration test failed:', error);
    return {
      success: false,
      error: error.message || 'Configuration test failed'
    };
  }
}

/**
 * Mask phone number for logging privacy
 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  const cleaned = phone.replace('whatsapp:', '');
  return cleaned.slice(0, -4).replace(/./g, '*') + cleaned.slice(-4);
}

/**
 * Twilio client object with sendWhatsAppMessage method for compatibility
 */
export const twilioClient = {
  // Twilio SDK methods
  messages: client?.messages || {
    create: async () => {
      throw new Error('Twilio client not configured');
    }
  },

  // Custom methods
  sendWhatsAppMessage,
  testConfiguration,

  // Status helpers
  isConfigured: () => !!client && !!whatsappFrom,
  getFromNumber: () => whatsappFrom
};

// Default export for require() compatibility
export default twilioClient;