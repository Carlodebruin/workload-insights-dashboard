import { NextRequest, NextResponse } from 'next/server';

const VERIFY_TOKEN = (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || 'my_verify_token_123').trim();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('Webhook verified successfully');
    return new NextResponse(challenge);
  } else {
    console.log('Webhook verification failed');
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    console.log('🔥 WhatsApp Webhook received:', JSON.stringify(body, null, 2));

    // Process webhook payload
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              await processSimpleMessage(change.value);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

// Import prisma
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function processSimpleMessage(messageData: any) {
  try {
    console.log('📱 Processing message data:', JSON.stringify(messageData, null, 2));

    const { messages, contacts } = messageData;

    if (!messages || messages.length === 0) {
      console.log('ℹ️ No messages to process');
      return;
    }

    for (const message of messages) {
      console.log(`📨 Processing message from ${message.from}:`, message);

      // Extract message content based on type
      let content = '';
      switch (message.type) {
        case 'text':
          content = message.text?.body || '';
          break;
        case 'image':
          content = message.image?.caption || `[Image: ${message.image?.id}]`;
          break;
        case 'location':
          content = `[Location: ${message.location?.latitude}, ${message.location?.longitude}]`;
          break;
        case 'document':
          content = `[Document: ${message.document?.filename || message.document?.id}]`;
          break;
        case 'voice':
          content = `[Voice message: ${message.voice?.id}]`;
          break;
        default:
          content = `[${message.type} message: ${message.id}]`;
      }

      // Get contact info
      const contact = contacts?.find((c: any) => c.wa_id === message.from);
      const senderName = contact?.profile?.name || `Unknown (${message.from})`;

      console.log(`👤 Message from ${senderName}: "${content}"`);

      // Create or get WhatsApp user
      let whatsappUser;
      try {
        whatsappUser = await prisma.whatsAppUser.upsert({
          where: { phoneNumber: message.from },
          update: { 
            lastMessageAt: new Date(),
            displayName: contact?.profile?.name || undefined
          },
          create: {
            phoneNumber: message.from,
            displayName: contact?.profile?.name,
            profileName: contact?.profile?.name,
            isVerified: false,
            lastMessageAt: new Date(),
            messagesInWindow: 1,
            windowStartTime: new Date()
          }
        });
        console.log(`✅ WhatsApp user handled: ${whatsappUser.id}`);
      } catch (userError) {
        console.error('❌ Error handling WhatsApp user:', userError);
        // Continue processing even if user creation fails
      }

      // Store the message for visibility
      try {
        const storedMessage = await prisma.whatsAppMessage.create({
          data: {
            waId: message.id,
            from: message.from,
            to: messageData.metadata?.phone_number_id || 'unknown',
            type: message.type,
            content: JSON.stringify({
              text: content,
              raw: message,
              contact: contact
            }),
            timestamp: new Date(parseInt(message.timestamp) * 1000),
            direction: 'inbound',
            status: 'delivered',
            isFreeMessage: true,
            processed: false
          }
        });
        
        console.log(`✅ Message stored successfully: ${storedMessage.id}`);
        console.log(`📄 Content: "${content}"`);

      } catch (dbError) {
        console.error('❌ Error storing message in database:', dbError);
      }
    }

  } catch (error) {
    console.error('❌ Error processing simple message:', error);
  }
}