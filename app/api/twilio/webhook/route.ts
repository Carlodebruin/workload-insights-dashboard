import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { sendTwilioMessage } from '../../../../lib/twilio';
import { WhatsAppCommandSystem } from '../../../../lib/whatsapp-command-system';
import { generateReferenceNumber } from '../../../../lib/reference-number-service';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('twilio_webhook', 'POST');
  
  try {
    const formData = await request.formData();
    const from = formData.get('From') as string;
    const body = formData.get('Body') as string;
    const messageSid = formData.get('MessageSid') as string;
    const profileName = formData.get('ProfileName') as string;

    const fromPhone = from.replace('whatsapp:', '');
    const senderName = profileName || `User ${fromPhone}`;

    logSecureInfo('Twilio webhook received', requestContext, { messageSid });

    // Handle commands first using enhanced command system
    if (body.startsWith('/')) {
      const commandContext = {
        fromPhone,
        senderName,
        messageContent: body,
        requestContext
      };
      
      try {
        logSecureInfo('Processing command with enhanced system', requestContext, { command: body.substring(0, 20) });
        const result = await WhatsAppCommandSystem.processCommand(commandContext);
        logSecureInfo('Enhanced command result', requestContext, { success: result.success });
        return createTwiMLResponse(result.message);
      } catch (error) {
        logSecureError('Enhanced command processing failed, falling back to basic', requestContext, error instanceof Error ? error : undefined);
        const commandResponse = await handleCommand(body, fromPhone);
        return createTwiMLResponse(commandResponse);
      }
    }

    // Check if this might be a session response or task reference using enhanced system
    try {
      const commandContext = {
        fromPhone,
        senderName,
        messageContent: body,
        requestContext
      };
      
      const result = await WhatsAppCommandSystem.processCommand(commandContext);
      if (result.success || result.requiresFollowup) {
        return createTwiMLResponse(result.message);
      }
    } catch (enhancedError) {
      // If enhanced processing fails, continue with regular incident processing
      console.log('📝 Not an enhanced command, processing as regular incident');
    }

    // Standard message processing
    const categories = await prisma.category.findMany();
    if (categories.length === 0) {
      return createTwiMLResponse('System not ready. No categories configured.');
    }

    let parsedData;
    try {
      parsedData = await parseWhatsAppMessage(body, categories);
    } catch (aiError) {
      parsedData = parseWhatsAppMessageSimple(body, categories);
    }

    const reporterUser = await prisma.user.upsert({
      where: { phone_number: fromPhone },
      update: { name: senderName },
      create: { name: senderName, phone_number: fromPhone, role: 'User' },
    });

    const activity = await prisma.activity.create({
      data: {
        category_id: parsedData.category_id,
        subcategory: parsedData.subcategory,
        location: parsedData.location,
        notes: parsedData.notes,
        user_id: reporterUser.id,
        status: 'Open',
      },
      include: { category: { select: { name: true } } },
    });

    await prisma.whatsAppMessage.create({
        data: {
            waId: messageSid,
            from: fromPhone,
            to: (formData.get('To') as string).replace('whatsapp:', ''),
            type: 'text',
            content: JSON.stringify({ text: body }),
            timestamp: new Date(),
            direction: 'inbound',
            status: 'received',
            relatedActivityId: activity.id,
            processed: true,
        },
    });

    // Use smart reference number system
    const reference = generateReferenceNumber({
      categoryName: activity.category.name,
      activityId: activity.id
    });
    
    const confirmationMessage = `✅ *Incident Logged Successfully*

📋 **Reference:** ${reference}
🏷️ **Category:** ${activity.category.name} - ${parsedData.subcategory}
📍 **Location:** ${parsedData.location}
📅 **Status:** ${activity.status}
👤 **Reported by:** ${senderName}

Your incident has been recorded and will be reviewed by our team. You will receive updates on progress.

Reply /status to check all your reports.`;

    // Log the outgoing confirmation message
    await prisma.whatsAppMessage.create({
        data: {
            waId: `conf_${messageSid}`,
            from: (formData.get('To') as string).replace('whatsapp:', ''),
            to: fromPhone,
            type: 'text',
            content: JSON.stringify({ text: confirmationMessage }),
            timestamp: new Date(),
            direction: 'outbound',
            status: 'sending',
            relatedActivityId: activity.id,
        },
    });

    return createTwiMLResponse(confirmationMessage);

  } catch (error) {
    logSecureError('Twilio webhook processing error', requestContext, error instanceof Error ? error : undefined);
    const errorMessage = 'We couldn\'t process your message. Please try again later.';
    return createTwiMLResponse(errorMessage);
  }
}

function createTwiMLResponse(message: string): NextResponse {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`;
  return new NextResponse(twiml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml' },
  });
}

async function handleCommand(command: string, fromPhone: string): Promise<string> {
    const cmd = command.toLowerCase().trim();
    switch (cmd) {
        case '/help':
            return `🔧 **WhatsApp Bot Help**

**📋 Task Commands:**
• /assigned - View your assigned tasks
• /update - Update task progress
• /complete - Mark tasks complete
• /status - Check your reports

**📝 Updating Tasks:**
1. Type /update
2. Select task by number
3. Provide progress update
4. Send photos if helpful

**🎯 Quick Actions:**
• Send task reference (e.g., ELEC-00001)
• Reply "complete" during updates
• Include photos with updates

**📞 Need Help?**
Contact your supervisor or school office directly.`;

        case '/status':
            const user = await prisma.user.findFirst({ where: { phone_number: fromPhone } });
            if (!user) return 'No reports found for your phone number. Send a message describing any issues to create your first report.';

            const activities = await prisma.activity.findMany({
                where: { user_id: user.id },
                orderBy: { timestamp: 'desc' },
                take: 5,
                include: { 
                    category: { select: { name: true } },
                    assignedTo: { select: { name: true } }
                },
            });

            if (activities.length === 0) return 'No reports found. Send a message describing any issues to create your first report.';

            let statusMessage = `📊 *Your Recent Reports*\n\n`;
            
            activities.forEach((activity, index) => {
                const ref = generateReferenceNumber({
                    categoryName: activity.category?.name,
                    activityId: activity.id
                });
                const statusIcon = activity.status === 'Resolved' ? '✅' :
                                  activity.status === 'In Progress' ? '🔄' : '⏳';
                
                statusMessage += `${index + 1}. ${statusIcon} **${ref}**\n`;
                statusMessage += `   ${activity.subcategory} - ${activity.location}\n`;
                statusMessage += `   Status: ${activity.status}\n`;
                if (activity.assignedTo) {
                    statusMessage += `   Assigned to: ${activity.assignedTo.name}\n`;
                }
                statusMessage += `   Created: ${activity.timestamp.toLocaleDateString()}\n\n`;
            });

            statusMessage += `Reply with any new issues to create additional reports.`;
            return statusMessage;

        case '/assigned':
            const staffUser = await prisma.user.findFirst({ where: { phone_number: fromPhone } });
            if (!staffUser) return "No account found for your phone number. Contact your supervisor if you should have access to assigned tasks.";

            const assignedActivities = await prisma.activity.findMany({
                where: {
                    assigned_to_user_id: staffUser.id,
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

            let message = `📋 *Your Assigned Tasks*\n\nHere are your current tasks:\n\n`;
            
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
            return message;

        case '/update':
            return "📝 *Update Task Progress*\n\nTo update a task:\n1. Type /update\n2. Select task by number\n3. Provide your progress update\n\nThe enhanced update system is processing your request...";

        case '/complete':
            return "🎯 **Complete Tasks**\n\nTo mark a task as complete:\n\n1️⃣ **Method 1:** Type /update and select your task\n2️⃣ **Method 2:** Reply with task reference (e.g., ELEC-00001)\n\n💡 **Tip:** Use /assigned to see all your tasks with reference numbers.";

        default:
            return `Unknown command: ${command}. Type /help for available commands.`;
    }
}