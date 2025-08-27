import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { whatsappMessaging } from '../../../../lib/whatsapp/messaging-service';
import { whatsappConfig } from '../../../../lib/whatsapp/config';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('twilio_webhook', 'POST');
  
  try {
    // Initialize WhatsApp configuration
    whatsappConfig.initialize();
    
    console.log('📞 Twilio webhook received');
    logSecureInfo('Twilio webhook received', requestContext);

    // Get form data from Twilio webhook
    const formData = await request.formData();
    const twilioData = {
      MessageSid: formData.get('MessageSid') as string,
      From: formData.get('From') as string,
      To: formData.get('To') as string,
      Body: formData.get('Body') as string,
      ProfileName: formData.get('ProfileName') as string,
      WaId: formData.get('WaId') as string,
    };

    console.log('📞 Twilio webhook data:', {
      MessageSid: twilioData.MessageSid,
      From: maskPhone(twilioData.From || 'unknown'),
      To: maskPhone(twilioData.To || 'unknown'),
      Body: twilioData.Body?.substring(0, 50) + '...',
      ProfileName: twilioData.ProfileName
    });

    logSecureInfo('Twilio webhook data received', requestContext, {
      messageSid: twilioData.MessageSid,
      hasBody: !!twilioData.Body,
      bodyLength: twilioData.Body?.length || 0
    });

    // Extract phone number from WhatsApp format (remove "whatsapp:" prefix)
    const fromPhone = twilioData.From?.replace('whatsapp:', '') || '';
    const toPhone = twilioData.To?.replace('whatsapp:', '') || '';
    const messageContent = twilioData.Body || '';
    const senderName = twilioData.ProfileName || `User ${fromPhone}`;

    console.log(`👤 Processing message from ${senderName}: "${messageContent}"`);

    // Handle commands first
    if (messageContent.startsWith('/')) {
      await handleCommand(messageContent, fromPhone, senderName, twilioData, requestContext);
      return NextResponse.json({ success: true, type: 'command_processed' });
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
          waId: twilioData.MessageSid,
          from: fromPhone,
          to: toPhone,
          type: 'text',
          content: JSON.stringify({
            text: messageContent,
            profileName: senderName,
            twilioData: twilioData
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

    return NextResponse.json({ success: true, type: 'message_processed' });

  } catch (error) {
    logSecureError('Twilio webhook processing error', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Twilio webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
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

      logSecureInfo('Activity created from Twilio message', requestContext, {
        activityId: activity.id,
        category: activity.category?.name,
        subcategory: activity.subcategory,
        location: activity.location
      });

    } catch (activityError) {
      logSecureError('Failed to create activity from Twilio message', requestContext, activityError instanceof Error ? activityError : undefined);
      console.error('❌ Error creating activity:', activityError);
      
      // Send error message to user
      await sendErrorMessage(fromPhone, 'Failed to create activity from your message. Please try again or contact support.');
    }

  } catch (error) {
    logSecureError('Error processing Twilio incident message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error in Twilio incident processing:', error);
  }
}

async function handleCommand(command: string, fromPhone: string, senderName: string, twilioData: any, requestContext: any) {
  try {
    console.log(`🔧 Processing Twilio command: ${command}`);
    
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
    
    logSecureInfo('Twilio command processed', requestContext, { command: cmd });
  } catch (error) {
    logSecureError('Error processing Twilio command', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error processing Twilio command:', error);
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
    
    logSecureInfo('Twilio confirmation message sent', requestContext, {
      toPhone: maskPhone(toPhone),
      activityId: activity.id,
      referenceNumber
    });
    
    console.log(`✅ Twilio confirmation sent for activity ${activity.id}`);
  } catch (error) {
    logSecureError('Failed to send Twilio confirmation message', requestContext, error instanceof Error ? error : undefined);
    console.error('❌ Error sending Twilio confirmation:', error);
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
  console.log(`✅ Twilio help message sent to ${toPhone}`);
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
    console.log(`✅ Twilio status message sent to ${toPhone}`);
  } catch (error) {
    console.error('❌ Error sending Twilio status message:', error);
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
      
      // Fallback to storing mock message for audit trail
      const fallbackId = `FALLBACK_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      await prisma.whatsAppMessage.create({
        data: {
          waId: fallbackId,
          from: process.env.WHATSAPP_PHONE_NUMBER_ID || '739347359265753',
          to: toPhone,
          type: 'text',
          content: message,
          direction: 'outbound',
          status: 'failed',
          timestamp: new Date(),
          isFreeMessage: true
        }
      });
      
      return { success: false, error: result.error };
    }
  } catch (error: any) {
    console.error('❌ Error in sendMessage function:', error);
    
    // Fallback to storing mock message for audit trail
    try {
      const fallbackId = `ERROR_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      await prisma.whatsAppMessage.create({
        data: {
          waId: fallbackId,
          from: process.env.WHATSAPP_PHONE_NUMBER_ID || '739347359265753',
          to: toPhone,
          type: 'text',
          content: message,
          direction: 'outbound',
          status: 'error',
          timestamp: new Date(),
          isFreeMessage: true
        }
      });
    } catch (dbError) {
      console.error('❌ Failed to store fallback message:', dbError);
    }
    
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

/**
 * GET - Webhook info (for debugging)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Twilio WhatsApp Webhook Endpoint',
    status: 'active',
    endpoint: '/api/twilio/webhook',
    purpose: 'Receives WhatsApp messages from Twilio',
    accepts: ['POST'],
    format: 'application/x-www-form-urlencoded (FormData)',
    fields: ['MessageSid', 'From', 'To', 'Body', 'ProfileName', 'WaId']
  });
}