import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { whatsappMessaging } from '../../../../lib/whatsapp/messaging-service';
import { whatsappConfig } from '../../../../lib/whatsapp/config';

const prisma = new PrismaClient();

export async function GET() {
  return NextResponse.json({ status: 'WhatsApp webhook endpoint active' });
}

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('whatsapp_webhook', 'POST');
  
  try {
    // Initialize WhatsApp configuration
    whatsappConfig.initialize();
    
    console.log('🔥 Real WhatsApp webhook received');
    logSecureInfo('Real WhatsApp webhook received', requestContext);

    // Parse WhatsApp Business API webhook payload
    const body = await request.json();
    console.log('🔥 WhatsApp webhook body:', JSON.stringify(body, null, 2));

    // Process webhook verification
    if (body.hub && body.hub.mode === 'subscribe') {
      const verifyToken = body.hub.verify_token;
      const challenge = body.hub.challenge;
      
      if (verifyToken === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('✅ WhatsApp webhook verification successful');
        return new Response(challenge, { status: 200 });
      } else {
        console.log('❌ WhatsApp webhook verification failed');
        return new Response('Forbidden', { status: 403 });
      }
    }

    // Process incoming messages
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value && change.value.messages) {
              for (const message of change.value.messages) {
                await processWhatsAppMessage(message, change.value, requestContext);
              }
            }
          }
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logSecureError('WhatsApp webhook processing error', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ WhatsApp webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function processWhatsAppMessage(message: any, webhookValue: any, requestContext: any) {
  try {
    console.log('📱 Processing WhatsApp message:', message);

    const fromPhone = message.from;
    const messageId = message.id;
    const messageType = message.type;
    let messageContent = '';
    let senderName = 'WhatsApp User';

    // Extract message content based on type
    if (messageType === 'text' && message.text) {
      messageContent = message.text.body;
    } else if (messageType === 'interactive' && message.interactive) {
      if (message.interactive.button_reply) {
        messageContent = message.interactive.button_reply.title;
      } else if (message.interactive.list_reply) {
        messageContent = message.interactive.list_reply.title;
      }
    } else {
      console.log(`⚠️ Unsupported message type: ${messageType}`);
      return;
    }

    // Get sender name from contacts
    if (webhookValue.contacts && webhookValue.contacts.length > 0) {
      const contact = webhookValue.contacts.find((c: any) => c.wa_id === fromPhone);
      if (contact && contact.profile && contact.profile.name) {
        senderName = contact.profile.name;
      }
    }

    console.log(`👤 Processing message from ${senderName} (${fromPhone}): "${messageContent}"`);

    // Handle commands first
    if (messageContent.startsWith('/')) {
      await handleCommand(messageContent, fromPhone, senderName, requestContext);
      return;
    }

    // Create or get WhatsApp user
    let whatsappUser;
    try {
      whatsappUser = await prisma.whatsAppUser.upsert({
        where: { phoneNumber: fromPhone },
        update: { 
          lastMessageAt: new Date(),
          displayName: senderName
        },
        create: {
          phoneNumber: fromPhone,
          displayName: senderName,
          profileName: senderName,
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
          waId: messageId,
          from: fromPhone,
          to: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
          type: messageType,
          content: JSON.stringify({
            text: messageContent,
            profileName: senderName,
            whatsappData: message
          }),
          timestamp: new Date(),
          direction: 'inbound',
          status: 'received',
          isFreeMessage: true,
          processed: false
        }
      });
      
      console.log(`✅ Message stored: ${storedMessage.id}`);
    } catch (dbError) {
      console.error('❌ Error storing message:', dbError);
      logSecureError('Failed to store message', requestContext, dbError instanceof Error ? dbError : undefined);
    }

    // Process message for incident creation
    if (storedMessage) {
      await processIncidentMessage(messageContent, fromPhone, senderName, storedMessage.id, requestContext);
    }

  } catch (error) {
    logSecureError('Error processing WhatsApp message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in WhatsApp message processing:', error);
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
      logSecureError('Failed to create activity from WhatsApp message', requestContext, activityError instanceof Error ? activityError : undefined);
      console.error('❌ Error creating activity:', activityError);
      
      // Send error message to user
      await sendErrorMessage(fromPhone, 'Failed to create activity from your message. Please try again or contact support.');
    }

  } catch (error) {
    logSecureError('Error processing WhatsApp incident message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in WhatsApp incident processing:', error);
  }
}

async function handleCommand(command: string, fromPhone: string, senderName: string, requestContext: any) {
  try {
    console.log(`🔧 Processing WhatsApp command: ${command}`);
    
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
    logSecureError('Error processing WhatsApp command', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error processing WhatsApp command:', error);
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
    
    logSecureInfo('WhatsApp confirmation message sent', requestContext, {
      toPhone: maskPhone(toPhone),
      activityId: activity.id,
      referenceNumber
    });
    
    console.log(`✅ WhatsApp confirmation sent for activity ${activity.id}`);
  } catch (error) {
    logSecureError('Failed to send WhatsApp confirmation message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error sending WhatsApp confirmation:', error);
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
  console.log(`✅ WhatsApp help message sent to ${toPhone}`);
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

    let message = `📊 *Your Recent Reports*\\n\\n`;
    
    recentActivities.forEach((activity, index) => {
      const ref = activity.id.substring(0, 8).toUpperCase();
      const statusIcon = activity.status === 'Resolved' ? '✅' : 
                        activity.status === 'In Progress' ? '🔄' : '⏳';
      
      message += `${index + 1}. ${statusIcon} **${ref}**\\n`;
      message += `   ${activity.subcategory} - ${activity.location}\\n`;
      message += `   Status: ${activity.status}\\n`;
      if (activity.assignedTo) {
        message += `   Assigned to: ${activity.assignedTo.name}\\n`;
      }
      message += `   Created: ${activity.timestamp.toLocaleDateString()}\\n\\n`;
    });

    message += `Reply with any new issues to create additional reports.`;

    await sendMessage(toPhone, message);
    console.log(`✅ WhatsApp status message sent to ${toPhone}`);
  } catch (error) {
    console.error('❌ Error sending WhatsApp status message:', error);
    await sendErrorMessage(toPhone, 'Failed to retrieve your status. Please try again later.');
  }
}

async function sendMessage(toPhone: string, message: string) {
  try {
    console.log(`📤 Sending REAL WhatsApp message to ${maskPhone(toPhone)}: ${message.substring(0, 50)}...`);
    
    // Send real WhatsApp message via Meta Business API
    const result = await whatsappMessaging.sendMessage({
      to: toPhone,
      type: 'text',
      content: message,
      forceImmediate: true,
      priority: 'normal'
    });
    
    if (result.success) {
      console.log(`✅ Real WhatsApp message sent successfully: ${result.messageId}`);
      return { success: true, messageId: result.messageId };
    } else {
      console.error(`❌ Failed to send real WhatsApp message: ${result.error}`);
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('❌ Error in sendMessage function:', error);
    return { success: false, error: error.message || 'Unknown error' };
  }
}

async function sendErrorMessage(toPhone: string, errorMessage: string) {
  await sendMessage(toPhone, `❌ Error: ${errorMessage}`);
}

function maskPhone(phone: string): string {
  if (!phone || phone.length < 4) return '****';
  return phone.slice(0, -4).replace(/./g, '*') + phone.slice(-4);
}