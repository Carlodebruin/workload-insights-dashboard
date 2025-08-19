import { NextRequest, NextResponse } from 'next/server';
import { whatsappConfig } from '../../../../lib/whatsapp/config';
import { WhatsAppWebhookPayload, WhatsAppInboundMessage } from '../../../../lib/whatsapp/types';
import { WhatsAppMessageOptimizer } from '../../../../lib/whatsapp/message-optimizer';
import { prisma } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, logSecureWarning, createRequestContext } from '../../../../lib/secure-logger';
import crypto from 'crypto';

/**
 * WhatsApp Webhook Handler
 * Handles incoming webhooks from Meta WhatsApp Business API
 */

// WhatsApp configuration will be initialized when first used

/**
 * GET - Webhook verification
 * Meta sends a GET request to verify the webhook URL
 */
export async function GET(request: NextRequest) {
  const requestContext = createRequestContext('whatsapp_webhook_verify', 'GET');
  
  try {
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get('hub.mode');
    const token = searchParams.get('hub.verify_token');
    const challenge = searchParams.get('hub.challenge');

    try {
      whatsappConfig.initialize();
    } catch (error) {
      // Configuration not available during build
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 });
    }
    const config = whatsappConfig.getConfig();

    // Verify the webhook
    if (mode === 'subscribe' && token === config.webhookVerifyToken) {
      logSecureInfo('WhatsApp webhook verified successfully', {
        ...requestContext,
        statusCode: 200
      });
      
      return new NextResponse(challenge, { 
        status: 200,
        headers: { 'Content-Type': 'text/plain' }
      });
    } else {
      logSecureWarning('WhatsApp webhook verification failed', {
        ...requestContext,
        statusCode: 403
      }, {
        mode,
        tokenProvided: !!token,
        challengeProvided: !!challenge
      });
      
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }
  } catch (error) {
    logSecureError('WhatsApp webhook verification error', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST - Process incoming WhatsApp messages and status updates
 */
export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('whatsapp_webhook_message', 'POST');
  
  try {
    try {
      whatsappConfig.initialize();
    } catch (error) {
      // Configuration not available during build
      return NextResponse.json({ error: 'WhatsApp not configured' }, { status: 503 });
    }

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(request, signature)) {
      logSecureWarning('WhatsApp webhook signature verification failed', {
        ...requestContext,
        statusCode: 401
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const payload: WhatsAppWebhookPayload = await request.json();

    logSecureInfo('WhatsApp webhook received', {
      ...requestContext,
      statusCode: 200
    }, {
      entryCount: payload.entry?.length || 0,
      object: payload.object
    });

    // Process each entry
    for (const entry of payload.entry || []) {
      await processWebhookEntry(entry, requestContext);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logSecureError('WhatsApp webhook processing error', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Verify webhook signature for security
 */
function verifyWebhookSignature(request: NextRequest, signature: string | null): boolean {
  if (!signature) return false;

  try {
    const config = whatsappConfig.getConfig();
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', config.appSecret)
      .update(JSON.stringify(request.body))
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logSecureError('Webhook signature verification failed', {
      operation: 'verify_signature',
      timestamp: new Date().toISOString()
    }, error instanceof Error ? error : undefined);
    return false;
  }
}

/**
 * Process a single webhook entry
 */
async function processWebhookEntry(entry: any, requestContext: any) {
  for (const change of entry.changes || []) {
    if (change.field === 'messages') {
      await processMessagesChange(change.value, requestContext);
    }
  }
}

/**
 * Process messages from webhook
 */
async function processMessagesChange(value: any, requestContext: any) {
  const { messages, statuses, contacts } = value;

  // Process incoming messages
  if (messages) {
    for (const message of messages) {
      await processIncomingMessage(message, contacts, value, requestContext);
    }
  }

  // Process message status updates
  if (statuses) {
    for (const status of statuses) {
      await processMessageStatus(status, requestContext);
    }
  }
}

/**
 * Process a single incoming message
 */
async function processIncomingMessage(
  message: WhatsAppInboundMessage,
  contacts: any[],
  value: any,
  requestContext: any
) {
  try {
    const phoneNumber = message.from;
    const contact = contacts?.find(c => c.wa_id === phoneNumber);

    // Get or create WhatsApp user
    let whatsappUser = await prisma.whatsAppUser.findUnique({
      where: { phoneNumber },
      include: { linkedUser: true }
    });

    if (!whatsappUser) {
      whatsappUser = await prisma.whatsAppUser.create({
        data: {
          phoneNumber,
          displayName: contact?.profile?.name,
          profileName: contact?.profile?.name,
          isVerified: false,
          lastMessageAt: new Date(),
          messagesInWindow: 0,
          windowStartTime: new Date(),
        },
        include: { linkedUser: true }
      });

      logSecureInfo('New WhatsApp user created', requestContext, {
        phoneNumber: maskPhoneNumber(phoneNumber),
        hasProfile: !!contact?.profile?.name
      });
    }

    // Update window tracker for free message optimization
    const windowTracker = {
      phoneNumber,
      windowStart: whatsappUser.windowStartTime || new Date(),
      messageCount: whatsappUser.messagesInWindow,
      lastMessage: whatsappUser.lastMessageAt || new Date(),
      isWindowActive: true
    };

    const updatedTracker = WhatsAppMessageOptimizer.updateWindowTracker(
      windowTracker,
      true, // User initiated message
      'inbound'
    );

    // Update user with new window info
    await prisma.whatsAppUser.update({
      where: { id: whatsappUser.id },
      data: {
        lastMessageAt: new Date(),
        messagesInWindow: updatedTracker.messageCount,
        windowStartTime: updatedTracker.windowStart,
        displayName: contact?.profile?.name || whatsappUser.displayName,
        profileName: contact?.profile?.name || whatsappUser.profileName,
      }
    });

    // Store the message
    const messageContent = extractMessageContent(message);
    
    const storedMessage = await prisma.whatsAppMessage.create({
      data: {
        waId: message.id,
        from: phoneNumber,
        to: value.metadata.phone_number_id,
        type: message.type,
        content: JSON.stringify(messageContent),
        timestamp: new Date(parseInt(message.timestamp) * 1000),
        direction: 'inbound',
        status: 'delivered',
        isFreeMessage: true, // Incoming messages are always free
        context: message.context ? JSON.stringify(message.context) : null,
        processed: false
      }
    });

    logSecureInfo('WhatsApp message stored', requestContext, {
      messageId: message.id,
      phoneNumber: maskPhoneNumber(phoneNumber),
      type: message.type,
      hasLinkedUser: !!whatsappUser.linkedUser
    });

    // Process the message content for commands or activity creation
    await processMessageContent(message, whatsappUser, storedMessage.id, requestContext);

  } catch (error) {
    logSecureError('Failed to process incoming WhatsApp message', requestContext, 
      error instanceof Error ? error : undefined);
  }
}

/**
 * Extract content from different message types
 */
function extractMessageContent(message: WhatsAppInboundMessage) {
  switch (message.type) {
    case 'text':
      return { text: message.text?.body };
    
    case 'image':
    case 'video':
    case 'document':
    case 'audio':
    case 'voice':
      return {
        mediaId: message[message.type]?.id,
        mimeType: message[message.type]?.mime_type,
        sha256: message[message.type]?.sha256,
        caption: message[message.type]?.caption,
        filename: message[message.type]?.filename
      };
    
    case 'location':
      return {
        latitude: message.location?.latitude,
        longitude: message.location?.longitude,
        name: message.location?.name,
        address: message.location?.address
      };
    
    default:
      return { raw: message };
  }
}

/**
 * Process message content for commands and activity creation
 */
async function processMessageContent(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  messageId: string,
  requestContext: any
) {
  try {
    // Mark message as being processed
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: { processed: true }
    });

    // Check if it's a command (starts with /)
    if (message.type === 'text' && message.text?.body.startsWith('/')) {
      await processCommand(message, whatsappUser, requestContext);
      return;
    }

    // Check if it's incident reporting based on keywords or media
    if (isIncidentReport(message)) {
      await processIncidentReport(message, whatsappUser, requestContext);
      return;
    }

    // Send appropriate response based on user state
    await sendContextualResponse(message, whatsappUser, requestContext);

  } catch (error) {
    // Mark message as failed
    await prisma.whatsAppMessage.update({
      where: { id: messageId },
      data: { 
        processed: true,
        processingError: error instanceof Error ? error.message : 'Processing failed'
      }
    });

    logSecureError('Failed to process message content', requestContext,
      error instanceof Error ? error : undefined);
  }
}

/**
 * Determine if message is an incident report
 */
function isIncidentReport(message: WhatsAppInboundMessage): boolean {
  if (message.type === 'location' || message.type === 'image') {
    return true;
  }

  if (message.type === 'text') {
    const text = message.text?.body.toLowerCase() || '';
    const incidentKeywords = [
      'report', 'incident', 'problem', 'issue', 'emergency',
      'broken', 'damage', 'maintenance', 'repair', 'help'
    ];
    
    return incidentKeywords.some(keyword => text.includes(keyword));
  }

  return false;
}

/**
 * Process WhatsApp commands
 */
async function processCommand(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  requestContext: any
) {
  // This will be implemented in the command system
  logSecureInfo('WhatsApp command received', requestContext, {
    command: message.text?.body,
    phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
  });
}

/**
 * Process incident reports from WhatsApp
 */
async function processIncidentReport(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  requestContext: any
) {
  // This will be implemented with activity creation
  logSecureInfo('WhatsApp incident report received', requestContext, {
    type: message.type,
    phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
    hasLinkedUser: !!whatsappUser.linkedUser
  });
}

/**
 * Send contextual response based on message
 */
async function sendContextualResponse(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  requestContext: any
) {
  // Send appropriate response - this will use the messaging service
  logSecureInfo('Sending contextual response', requestContext, {
    phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
    messageType: message.type
  });
}

/**
 * Process message status updates
 */
async function processMessageStatus(status: any, requestContext: any) {
  try {
    await prisma.whatsAppMessage.updateMany({
      where: { waId: status.id },
      data: { status: status.status }
    });

    logSecureInfo('WhatsApp message status updated', requestContext, {
      messageId: status.id,
      status: status.status,
      recipientId: maskPhoneNumber(status.recipient_id)
    });
  } catch (error) {
    logSecureError('Failed to update message status', requestContext,
      error instanceof Error ? error : undefined);
  }
}

/**
 * Mask phone number for logging
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 4) return '****';
  return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
}