import twilio from 'twilio';

let client: twilio.Twilio | null = null;

function getClient(): twilio.Twilio {
  if (client) {
    return client;
  }
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  if (!accountSid || !authToken) {
    throw new Error('Twilio credentials (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) are not configured.');
  }

  client = twilio(accountSid, authToken);
  return client;
}

/**
 * Sends a WhatsApp message using the Twilio API.
 * @param to The recipient's phone number in E.164 format (e.g., '+14155238886').
 * @param body The message text to send.
 * @returns The message SID if successful.
 */
export async function sendTwilioMessage(to: string, body: string): Promise<string | null> {
  try {
    const twilioClient = getClient();
    const from = process.env.TWILIO_WHATSAPP_NUMBER;

    if (!from) {
      throw new Error('Twilio WhatsApp sender number (TWILIO_WHATSAPP_NUMBER) is not configured.');
    }

    console.log(`Sending Twilio message to ${to}`);

    const message = await twilioClient.messages.create({
      from,
      to: `whatsapp:${to}`,
      body,
    });

    console.log(`Twilio message sent successfully: ${message.sid}`);
    return message.sid;

  } catch (error) {
    console.error('Failed to send Twilio message:', error);
    return null;
  }
}
