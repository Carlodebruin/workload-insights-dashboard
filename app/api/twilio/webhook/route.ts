import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { parseWhatsAppMessage, parseWhatsAppMessageSimple } from '../../../../lib/whatsapp-ai-processor';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { sendTwilioMessage } from '../../../../lib/twilio';

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

    // Handle commands first
    if (body.startsWith('/')) {
      const commandResponse = await handleCommand(body, fromPhone);
      return createTwiMLResponse(commandResponse);
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

    const reference = activity.id.slice(-6).toUpperCase();
    const issueTitle = parsedData.subcategory !== 'General Issue' ? parsedData.subcategory : body.substring(0, 30);
    const confirmationMessage = `✅ Your incident "${issueTitle}" is logged and will be assigned.\n\nReference: ${reference}\nCategory: ${activity.category.name}\nLocation: ${activity.location}\nStatus: ${activity.status}\n\nYou'll receive updates as it gets processed.`;

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
            return `🔧 *WhatsApp Bot Help*\n\n*Available Commands:*\n• /help - Show this help message\n• /status - Check your recent reports\n\n*Reporting Issues:*
Simply send a message describing the problem (e.g., \"Broken desk in classroom A\").`;
        case '/status':
            const user = await prisma.user.findFirst({ where: { phone_number: fromPhone } });
            if (!user) return 'No reports found for your phone number.';

            const activities = await prisma.activity.findMany({
                where: { user_id: user.id },
                orderBy: { timestamp: 'desc' },
                take: 5,
                include: { category: true },
            });

            if (activities.length === 0) return 'You have no open reports.';

            let statusMessage = 'Your recent reports:\n';
            activities.forEach(act => {
                statusMessage += `\n- Ref ${act.id.slice(-6).toUpperCase()}: ${act.subcategory} (${act.status})`;
            });
            return statusMessage;
        default:
            return `Unknown command: ${command}. Type /help for available commands.`;
    }
}