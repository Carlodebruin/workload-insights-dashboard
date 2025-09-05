import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { whatsappMessaging } from '../../../../lib/whatsapp/messaging-service';
import { whatsappConfig } from '../../../../lib/whatsapp/config';
import { withDb } from '../../../../lib/db-wrapper';

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
    let responseMessage = 'Message received successfully.';
    if (body.entry && body.entry.length > 0) {
      for (const entry of body.entry) {
        if (entry.changes && entry.changes.length > 0) {
          for (const change of entry.changes) {
            if (change.field === 'messages' && change.value && change.value.messages) {
              for (const message of change.value.messages) {
                responseMessage = await processWhatsAppMessage(message, change.value, requestContext);
              }
            }
          }
        }
      }
    }

    // Return TwiML response instead of JSON
    return createTwiMLResponse(responseMessage);
  } catch (error) {
    logSecureError('WhatsApp webhook processing error', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ WhatsApp webhook error:', error);
    return createTwiMLResponse('We couldn\'t process your message. Please try again later.');
  }
}

// TwiML Response Function
function createTwiMLResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message><Body>${message}</Body></Message></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

async function processWhatsAppMessage(message: any, webhookValue: any, requestContext: any): Promise<string> {
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
      return `Message type "${messageType}" is not supported yet. Please send text messages.`;
    }

    // Get sender name from contacts
    if (webhookValue.contacts && webhookValue.contacts.length > 0) {
      const contact = webhookValue.contacts.find((c: any) => c.wa_id === fromPhone);
      if (contact && contact.profile && contact.profile.name) {
        senderName = contact.profile.name;
      }
    }

    console.log(`👤 Processing message from ${senderName} (${fromPhone}): "${messageContent}"`);

    // Handle commands and enhanced interactions
    if (messageContent.startsWith('/')) {
      return await handleCommand(messageContent, fromPhone, senderName, requestContext);
    }
    
    // Check if this might be a session response or task reference
    const { WhatsAppCommandSystem } = await import('../../../../lib/whatsapp-command-system');
    const commandContext = {
      fromPhone,
      senderName,
      messageContent,
      requestContext
    };
    
    // Try processing as enhanced command (could be task reference, session response, etc.)
    try {
      const result = await WhatsAppCommandSystem.processCommand(commandContext);
      if (result.success || result.requiresFollowup) {
        return result.message;
      }
    } catch (enhancedError) {
      // If enhanced processing fails, continue with regular incident processing
      console.log('📝 Not an enhanced command, processing as regular incident');
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

    // Process message for incident creation and get response
    let responseMessage = 'Your message has been received and logged.';
    if (storedMessage) {
      responseMessage = await processIncidentMessage(messageContent, fromPhone, senderName, storedMessage.id, requestContext);
    }
    
    return responseMessage;

  } catch (error) {
    logSecureError('Error processing WhatsApp message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in WhatsApp message processing:', error);
    return 'Sorry, there was an error processing your message. Please try again later.';
  }
}

async function processIncidentMessage(content: string, fromPhone: string, senderName: string, messageId: string, requestContext: any): Promise<string> {
  try {
    console.log('🤖 Starting AI processing for incident message');
    
    // Get categories for AI parsing
    const categories = await prisma.category.findMany();
    
    if (categories.length === 0) {
      console.log('⚠️ No categories available for AI parsing');
      return 'System configuration error. Please contact support.';
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
      return 'Error processing user information. Please try again later.';
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

      // Get confirmation message for TwiML response
      const confirmationMessage = await sendConfirmationMessage(fromPhone, activity, requestContext);

      logSecureInfo('Activity created from WhatsApp message', requestContext, {
        activityId: activity.id,
        category: activity.category?.name,
        subcategory: activity.subcategory,
        location: activity.location
      });

      return confirmationMessage;

    } catch (activityError) {
      logSecureError('Failed to create activity from WhatsApp message', requestContext, activityError instanceof Error ? activityError : undefined);
      console.error('❌ Error creating activity:', activityError);
      
      return 'Failed to create activity from your message. Please try again or contact support.';
    }

  } catch (error) {
    logSecureError('Error processing WhatsApp incident message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in WhatsApp incident processing:', error);
    return 'Sorry, there was an error processing your message. Please try again later.';
  }
}

async function handleCommand(command: string, fromPhone: string, senderName: string, requestContext: any): Promise<string> {
  try {
    console.log(`🔧 Processing WhatsApp command: ${command}`);
    
    // Import the enhanced command system
    const { WhatsAppCommandSystem } = await import('../../../../lib/whatsapp-command-system');
    
    // Create command context
    const commandContext = {
      fromPhone,
      senderName,
      messageContent: command,
      requestContext
    };
    
    // Process command through enhanced system
    const result = await WhatsAppCommandSystem.processCommand(commandContext);
    
    logSecureInfo('WhatsApp enhanced command processed', requestContext, {
      command: command.toLowerCase().trim(),
      success: result.success
    });
    
    return result.message;
  } catch (error) {
    logSecureError('Error processing WhatsApp command', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error processing WhatsApp command:', error);
    return 'Sorry, there was an error processing your command. Please try again or type /help for available commands.';
  }
}

async function sendConfirmationMessage(toPhone: string, activity: any, requestContext: any): Promise<string> {
  try {
    // Import reference number service
    const { generateReferenceNumber } = await import('../../../../lib/reference-number-service');
    
    const referenceNumber = generateReferenceNumber({
      categoryName: activity.category?.name,
      activityId: activity.id
    });
    
    const message = `✅ *Incident Logged Successfully*

📋 **Reference:** ${referenceNumber}
🏷️ **Category:** ${activity.category?.name || 'Unknown'} - ${activity.subcategory}
📍 **Location:** ${activity.location}
📅 **Status:** ${activity.status}
👤 **Reported by:** ${activity.user?.name}

Your incident has been recorded and will be reviewed by our team. You will receive updates on progress.

Reply /status to check all your reports.`;

    // Log the message but don't send via WhatsApp messaging service
    // Instead, return the message for TwiML response
    logSecureInfo('WhatsApp confirmation message prepared for TwiML response', requestContext, {
      toPhone: maskPhone(toPhone),
      activityId: activity.id,
      referenceNumber
    });
    
    console.log(`✅ WhatsApp confirmation prepared for TwiML response - activity ${activity.id}`);
    return message;
  } catch (error) {
    logSecureError('Failed to prepare WhatsApp confirmation message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error preparing WhatsApp confirmation:', error);
    return 'Your incident has been logged successfully. You will receive updates on progress.';
  }
}

async function sendHelpMessage(toPhone: string): Promise<string> {
  const message = `🔧 *WhatsApp Bot Help*

*Available Commands:*
• /help - Show this help message
• /status - Check your recent reports
• /assigned - View your assigned tasks
• /update - Update task progress

*Reporting Issues:*
Simply send a message describing the problem:
• "Broken desk in classroom A"
• "Leaking pipe in main corridor"
• "Lights not working in lab 2"

The system will automatically create an incident report and send you a confirmation with a reference number.

*For Staff - Task Updates:*
• Use /assigned to see your tasks
• Use /update to provide progress updates
• Include photos when helpful

*Need more help?* Contact the school office directly.`;

  console.log(`✅ WhatsApp help message prepared for TwiML response to ${maskPhone(toPhone)}`);
  return message;
}

async function sendStatusMessage(toPhone: string, senderName: string): Promise<string> {
  try {
    const { generateReferenceNumber } = await import('../../../../lib/reference-number-service');
    
    // Find user's recent activities
    const user = await prisma.user.findFirst({
      where: { phone_number: toPhone }
    });

    if (!user) {
      return "No reports found for your phone number. Send a message describing any issues to create your first report.";
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
      return "No reports found. Send a message describing any issues to create your first report.";
    }

    let message = `📊 *Your Recent Reports*\n\n`;
    
    recentActivities.forEach((activity, index) => {
      const ref = generateReferenceNumber({
        categoryName: activity.category?.name,
        activityId: activity.id
      });
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

    console.log(`✅ WhatsApp status message prepared for TwiML response to ${maskPhone(toPhone)}`);
    return message;
  } catch (error) {
    console.error('❌ Error preparing WhatsApp status message:', error);
    return 'Failed to retrieve your status. Please try again later.';
  }
}

async function sendAssignedTasksMessage(toPhone: string, senderName: string): Promise<string> {
  try {
    const { generateReferenceNumber } = await import('../../../../lib/reference-number-service');
    
    // Find user's assigned tasks
    const user = await prisma.user.findFirst({
      where: { phone_number: toPhone }
    });

    if (!user) {
      return "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks.";
    }

    // Get assigned activities
    const assignedActivities = await prisma.activity.findMany({
      where: {
        assigned_to_user_id: user.id,
        status: { in: ['Open', 'In Progress'] }
      },
      orderBy: { timestamp: 'desc' },
      take: 10,
      include: {
        category: { select: { name: true } },
        user: { select: { name: true } }
      }
    });

    if (assignedActivities.length === 0) {
      return "📋 *No Assigned Tasks*\n\nYou currently have no open tasks assigned to you.\n\nGreat job keeping up with your work! 👍";
    }

    let message = `📋 *Your Assigned Tasks*\n\nHi ${senderName}, here are your current tasks:\n\n`;
    
    assignedActivities.forEach((activity, index) => {
      const ref = generateReferenceNumber({
        categoryName: activity.category?.name,
        activityId: activity.id
      });
      const statusIcon = activity.status === 'In Progress' ? '🔄' : '⏳';
      
      message += `${index + 1}. ${statusIcon} **${ref}**\n`;
      message += `   ${activity.subcategory}\n`;
      message += `   📍 ${activity.location}\n`;
      message += `   👤 Reported by: ${activity.user?.name}\n`;
      message += `   📅 ${activity.timestamp.toLocaleDateString()}\n\n`;
    });

    message += `💡 *Quick Actions:*\n• Reply "/update" to update a task\n• Include photos when helpful\n• Reply "/help" for more commands`;

    console.log(`✅ WhatsApp assigned tasks message prepared for ${maskPhone(toPhone)}`);
    return message;
  } catch (error) {
    console.error('❌ Error preparing assigned tasks message:', error);
    return 'Failed to retrieve your assigned tasks. Please try again later.';
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