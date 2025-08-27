import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../lib/secure-logger';

const prisma = new PrismaClient();
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
  const requestContext = createRequestContext('whatsapp_webhook', 'POST');
  
  try {
    const body = await request.json();
    console.log('🔥 WhatsApp Webhook received:', JSON.stringify(body, null, 2));
    
    logSecureInfo('WhatsApp webhook received', requestContext, {
      hasEntry: !!body.entry,
      entryCount: body.entry?.length || 0
    });

    // Process webhook payload
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value) {
              await processWhatsAppMessage(change.value, requestContext);
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logSecureError('Webhook processing error', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Webhook error:', error);
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

async function processWhatsAppMessage(messageData: any, requestContext: any) {
  try {
    console.log('📱 Processing message data:', JSON.stringify(messageData, null, 2));
    logSecureInfo('Processing WhatsApp message', requestContext);

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

      // Handle commands first
      if (content.startsWith('/')) {
        await handleCommand(content, message.from, senderName, messageData, requestContext);
        continue;
      }

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
      }

      // Store the message
      let storedMessage;
      try {
        storedMessage = await prisma.whatsAppMessage.create({
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
        
        console.log(`✅ Message stored: ${storedMessage.id}`);
      } catch (dbError) {
        console.error('❌ Error storing message:', dbError);
        continue;
      }

      // Process message for incident creation
      await processIncidentMessage(content, message.from, senderName, storedMessage.id, requestContext);
    }

  } catch (error) {
    logSecureError('Error processing WhatsApp message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error processing message:', error);
  }
}

async function processIncidentMessage(content: string, fromPhone: string, senderName: string, messageId: string, requestContext: any) {
  try {
    console.log('🤖 Starting AI processing for incident message');
    
    // Get categories for AI parsing
    const categories = await prisma.category.findMany();
    
    if (categories.length === 0) {
      console.log('⚠️ No categories available for AI parsing');
      return;
    }

    // Parse message using AI
    let parsedData;
    try {
      parsedData = await parseWhatsAppMessage(content, categories);
      console.log('✅ AI parsing successful:', parsedData);
    } catch (aiError) {
      console.log('⚠️ AI parsing failed, using simple parsing:', aiError);
      parsedData = parseWhatsAppMessageSimple(content, categories);
      console.log('✅ Simple parsing result:', parsedData);
    }

    // Get or create reporter user
    let reporterUser;
    try {
      // Try to find user by phone number first
      reporterUser = await prisma.user.findFirst({
        where: { phone_number: fromPhone }
      });

      if (!reporterUser) {
        // Create new user if not found
        reporterUser = await prisma.user.create({
          data: {
            name: senderName,
            phone_number: fromPhone,
            role: 'User'
          }
        });
        console.log(`✅ Created new reporter user: ${reporterUser.id}`);
      } else {
        console.log(`✅ Found existing reporter user: ${reporterUser.id}`);
      }
    } catch (userError) {
      console.error('❌ Error handling reporter user:', userError);
      return;
    }

    // Create activity from parsed data
    try {
      const activity = await prisma.activity.create({
        data: {
          category_id: parsedData.category_id,
          subcategory: parsedData.subcategory,
          location: parsedData.location,
          notes: parsedData.notes,
          user_id: reporterUser.id,
          status: 'Open'
        },
        include: {
          category: { select: { name: true } },
          user: { select: { name: true } }
        }
      });

      console.log(`🎯 Activity created successfully: ${activity.id}`);
      
      // Link message to activity
      await prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: { 
          relatedActivityId: activity.id,
          processed: true
        }
      });

      // Send confirmation message
      await sendConfirmationMessage(fromPhone, activity, requestContext);

      logSecureInfo('Activity created from WhatsApp message', requestContext, {
        activityId: activity.id,
        category: activity.category?.name,
        subcategory: activity.subcategory,
        location: activity.location
      });

    } catch (activityError) {
      logSecureError('Failed to create activity', requestContext, activityError instanceof Error ? activityError : undefined);
      console.error('❌ Error creating activity:', activityError);
      
      // Send error message to user
      await sendErrorMessage(fromPhone, 'Failed to create activity from your message. Please try again or contact support.');
    }

  } catch (error) {
    logSecureError('Error processing incident message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in incident processing:', error);
  }
}

async function handleCommand(command: string, fromPhone: string, senderName: string, messageData: any, requestContext: any) {
  try {
    console.log(`🔧 Processing command: ${command}`);
    
    const cmd = command.toLowerCase().trim();
    
    switch (cmd) {
      case '/help':
        await sendHelpMessage(fromPhone);
        break;
        
      case '/status':
        await sendStatusMessage(fromPhone, senderName);
        break;
        
      default:
        await sendMessage(fromPhone, `Unknown command: ${command}. Type /help for available commands.`);
    }
    
    logSecureInfo('WhatsApp command processed', requestContext, { command: cmd });
  } catch (error) {
    logSecureError('Error processing command', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error processing command:', error);
  }
}

async function sendConfirmationMessage(toPhone: string, activity: any, requestContext: any) {
  try {
    const referenceNumber = activity.id.substring(0, 8).toUpperCase();
    
    const message = `✅ *Incident Logged Successfully*

📋 **Reference:** ${referenceNumber}
🏷️ **Category:** ${activity.category?.name || 'Unknown'} - ${activity.subcategory}
📍 **Location:** ${activity.location}
📅 **Status:** ${activity.status}
👤 **Reported by:** ${activity.user?.name}

Your incident has been recorded and will be reviewed by our team. You will receive updates on progress.

Reply /status to check all your reports.`;

    await sendMessage(toPhone, message);
    
    logSecureInfo('Confirmation message sent', requestContext, {
      toPhone: maskPhone(toPhone),
      activityId: activity.id,
      referenceNumber
    });
    
    console.log(`✅ Confirmation sent for activity ${activity.id}`);
  } catch (error) {
    logSecureError('Failed to send confirmation message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error sending confirmation:', error);
  }
}

async function sendHelpMessage(toPhone: string) {
  const message = `🔧 *WhatsApp Bot Help*

*Available Commands:*
• /help - Show this help message
• /status - Check your recent reports

*Reporting Issues:*
Simply send a message describing the problem:
• "Broken desk in classroom A"
• "Leaking pipe in main corridor"
• "Lights not working in lab 2"

The system will automatically create an incident report and send you a confirmation with a reference number.

*Need more help?* Contact the school office directly.`;

  await sendMessage(toPhone, message);
  console.log(`✅ Help message sent to ${toPhone}`);
}

async function sendStatusMessage(toPhone: string, senderName: string) {
  try {
    // Find user's recent activities
    const user = await prisma.user.findFirst({
      where: { phone_number: toPhone }
    });

    if (!user) {
      await sendMessage(toPhone, "No reports found for your phone number. Send a message describing any issues to create your first report.");
      return;
    }

    const recentActivities = await prisma.activity.findMany({
      where: { user_id: user.id },
      orderBy: { timestamp: 'desc' },
      take: 5,
      include: {
        category: { select: { name: true } },
        assignedTo: { select: { name: true } }
      }
    });

    if (recentActivities.length === 0) {
      await sendMessage(toPhone, "No reports found. Send a message describing any issues to create your first report.");
      return;
    }

    let message = `📊 *Your Recent Reports*\n\n`;
    
    recentActivities.forEach((activity, index) => {
      const ref = activity.id.substring(0, 8).toUpperCase();
      const statusIcon = activity.status === 'Resolved' ? '✅' : 
                        activity.status === 'In Progress' ? '🔄' : '⏳';
      
      message += `${index + 1}. ${statusIcon} **${ref}**\n`;
      message += `   ${activity.subcategory} - ${activity.location}\n`;
      message += `   Status: ${activity.status}\n`;
      if (activity.assignedTo) {
        message += `   Assigned to: ${activity.assignedTo.name}\n`;
      }
      message += `   Created: ${activity.timestamp.toLocaleDateString()}\n\n`;
    });

    message += `Reply with any new issues to create additional reports.`;

    await sendMessage(toPhone, message);
    console.log(`✅ Status message sent to ${toPhone}`);
  } catch (error) {
    console.error('❌ Error sending status message:', error);
    await sendErrorMessage(toPhone, 'Failed to retrieve your status. Please try again later.');
  }
}

async function sendMessage(toPhone: string, message: string) {
  try {
    console.log(`📤 Sending message to ${toPhone}: ${message.substring(0, 50)}...`);
    
    // For now, just log the message (implement actual sending later)
    const mockMessageId = `MOCK_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Store outbound message in database
    await prisma.whatsAppMessage.create({
      data: {
        waId: mockMessageId,
        from: process.env.WHATSAPP_PHONE_NUMBER_ID || 'system',
        to: toPhone,
        type: 'text',
        content: message,
        direction: 'outbound',
        status: 'sent',
        timestamp: new Date(),
        isFreeMessage: true
      }
    });
    
    console.log(`✅ Message logged as sent: ${mockMessageId}`);
    return { success: true, messageId: mockMessageId };
  } catch (error) {
    console.error('❌ Error sending message:', error);
    return { success: false, error: error.message };
  }
}

async function sendErrorMessage(toPhone: string, errorMessage: string) {
  await sendMessage(toPhone, `❌ Error: ${errorMessage}`);
}

function maskPhone(phone: string): string {
  if (phone.length < 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}