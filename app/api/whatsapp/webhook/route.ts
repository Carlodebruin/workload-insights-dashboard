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
  try {
    const commandText = message.text?.body || '';
    const [command, ...args] = commandText.split(' ');
    const commandName = command.toLowerCase();

    logSecureInfo('Processing WhatsApp command', requestContext, {
      command: commandName,
      argsCount: args.length,
      phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
    });

    switch (commandName) {
      case '/help':
        await handleHelpCommand(whatsappUser, args, requestContext);
        break;
      
      case '/status':
        await handleStatusCommand(whatsappUser, args, requestContext);
        break;
      
      case '/report':
        await handleReportCommand(whatsappUser, args, requestContext);
        break;
      
      case '/list':
        await handleListCommand(whatsappUser, args, requestContext);
        break;
      
      case '/link':
        await handleLinkCommand(whatsappUser, args, requestContext);
        break;
      
      default:
        await handleUnknownCommand(whatsappUser, commandName, requestContext);
    }

  } catch (error) {
    logSecureError('Failed to process WhatsApp command', requestContext,
      error instanceof Error ? error : undefined);
    
    await sendErrorResponse(whatsappUser, 'Failed to process your command. Please try again.', requestContext);
  }
}

/**
 * Handle /help command
 */
async function handleHelpCommand(
  whatsappUser: any,
  args: string[],
  requestContext: any
) {
  let helpMessage = `📚 *Available Commands*

🔧 *Basic Commands:*
• /help - Show this help message
• /status [reference] - Check task status
• /list - Show your open tasks
• /link [phone] - Link your account

📝 *Reporting:*
• /report [details] - Quick incident report
• Just send a message describing the issue

💬 *Examples:*
• "Broken window in Room 10A"
• /status MAINT-1234
• /list open

Need help? Just describe any issue and I'll create a task for you! 😊`;

  // If specific help topic requested
  if (args.length > 0) {
    const topic = args[0].toLowerCase();
    switch (topic) {
      case 'report':
      case 'reporting':
        helpMessage = `📝 *Incident Reporting Help*

🔹 *Quick Report:* /report [details]
   Example: /report "Leaking pipe in bathroom 2B"

🔹 *Detailed Report:* Send a regular message
   Include: location, problem description, urgency

🔹 *With Location:* Share your location + description

🔹 *With Photo:* Send image + caption describing issue

📋 *What happens next:*
1. AI processes your report
2. Task created automatically  
3. You get reference number
4. Team gets notified
5. Track progress with /status [reference]`;
        break;
      
      case 'status':
        helpMessage = `📊 *Status Checking Help*

🔹 *Check specific task:* /status MAINT-1234
🔹 *List your tasks:* /list
🔹 *List open tasks:* /list open

📋 *Status types:*
• Unassigned - Waiting for assignment
• Assigned - Someone is working on it
• In Progress - Work has started
• Completed - Task is done
• On Hold - Temporarily paused`;
        break;
    }
  }

  await sendWhatsAppMessage(whatsappUser.phoneNumber, helpMessage, requestContext);
}

/**
 * Handle /status command
 */
async function handleStatusCommand(
  whatsappUser: any,
  args: string[],
  requestContext: any
) {
  if (args.length === 0) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `📊 *Status Check*\n\nPlease provide a reference number:\n• /status MAINT-1234\n\nOr use /list to see all your tasks.`, 
      requestContext);
    return;
  }

  const reference = args[0].toUpperCase();
  
  try {
    // Extract activity ID from reference (assumes format like MAINT-1234)
    const activityIdPart = reference.split('-')[1];
    
    const activity = await prisma.activity.findFirst({
      where: {
        id: {
          endsWith: activityIdPart
        },
        user_id: whatsappUser.linkedUserId
      },
      select: {
        id: true,
        category_id: true,
        subcategory: true,
        location: true,
        timestamp: true,
        status: true,
        assigned_to_user_id: true,
        resolution_notes: true,
        category: {
          select: { name: true }
        },
        assignedUser: {
          select: { name: true }
        },
        updates: {
          select: {
            timestamp: true,
            notes: true,
            author_id: true
          },
          orderBy: { timestamp: 'desc' },
          take: 3
        }
      }
    });

    if (!activity) {
      await sendWhatsAppMessage(whatsappUser.phoneNumber, 
        `❌ Task ${reference} not found or not assigned to you.\n\nUse /list to see your tasks.`, 
        requestContext);
      return;
    }

    const statusMessage = `📋 *Task Status: ${reference}*

🏷️ **Category:** ${activity.category.name} - ${activity.subcategory}
📍 **Location:** ${activity.location}
📊 **Status:** ${activity.status}
⏰ **Reported:** ${new Date(activity.timestamp).toLocaleString()}
${activity.assignedUser ? `👤 **Assigned to:** ${activity.assignedUser.name}` : ''}

${activity.updates.length > 0 ? 
  `📝 **Recent Updates:**\n${activity.updates.map((update, i) => 
    `${i + 1}. ${new Date(update.timestamp).toLocaleDateString()}: ${update.notes}`
  ).join('\n')}` : 
  '📝 **No updates yet**'}

${activity.resolution_notes ? `✅ **Resolution:** ${activity.resolution_notes}` : ''}`;

    await sendWhatsAppMessage(whatsappUser.phoneNumber, statusMessage, requestContext);

  } catch (error) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `❌ Error checking status for ${reference}. Please verify the reference number.`, 
      requestContext);
  }
}

/**
 * Handle /report command
 */
async function handleReportCommand(
  whatsappUser: any,
  args: string[],
  requestContext: any
) {
  if (args.length === 0) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `📝 *Quick Report*\n\nUsage: /report [description]\n\nExample:\n/report "Broken window in classroom 5A, glass on floor, urgent"`, 
      requestContext);
    return;
  }

  const description = args.join(' ');
  
  // Create a synthetic message to process as incident report
  const syntheticMessage: WhatsAppInboundMessage = {
    from: whatsappUser.phoneNumber,
    id: `synthetic_${Date.now()}`,
    timestamp: String(Math.floor(Date.now() / 1000)),
    type: 'text',
    text: { body: description }
  };

  await processIncidentReport(syntheticMessage, whatsappUser, requestContext);
}

/**
 * Handle /list command
 */
async function handleListCommand(
  whatsappUser: any,
  args: string[],
  requestContext: any
) {
  if (!whatsappUser.linkedUserId) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `❌ Account not linked. Use /link to connect your account first.`, 
      requestContext);
    return;
  }

  const filter = args.length > 0 ? args[0].toLowerCase() : 'all';
  
  let whereClause: any = { user_id: whatsappUser.linkedUserId };
  
  if (filter === 'open') {
    whereClause.status = { not: 'Completed' };
  } else if (filter === 'completed') {
    whereClause.status = 'Completed';
  }

  const activities = await prisma.activity.findMany({
    where: whereClause,
    select: {
      id: true,
      category_id: true,
      subcategory: true,
      location: true,
      timestamp: true,
      status: true,
      category: {
        select: { name: true }
      }
    },
    orderBy: { timestamp: 'desc' },
    take: 10
  });

  if (activities.length === 0) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `📋 No ${filter === 'all' ? '' : filter + ' '}tasks found.`, 
      requestContext);
    return;
  }

  const listMessage = `📋 *Your ${filter === 'all' ? 'Recent' : filter.charAt(0).toUpperCase() + filter.slice(1)} Tasks*

${activities.map((activity, i) => {
    const ref = `${activity.category.name.substring(0,4).toUpperCase()}-${activity.id.slice(-4)}`;
    return `${i + 1}. **${ref}**
   ${activity.category.name} - ${activity.subcategory}
   📍 ${activity.location}
   📊 ${activity.status}
   ⏰ ${new Date(activity.timestamp).toLocaleDateString()}`;
  }).join('\n\n')}

Use /status [reference] for details on any task.`;

  await sendWhatsAppMessage(whatsappUser.phoneNumber, listMessage, requestContext);
}

/**
 * Handle /link command
 */
async function handleLinkCommand(
  whatsappUser: any,
  args: string[],
  requestContext: any
) {
  if (whatsappUser.linkedUserId) {
    await sendWhatsAppMessage(whatsappUser.phoneNumber, 
      `✅ Your account is already linked.\n\nUse /list to see your tasks.`, 
      requestContext);
    return;
  }

  // For now, just show instructions - full implementation would require verification
  const linkMessage = `🔗 *Account Linking*

To link your WhatsApp to your user account:

1. Contact your administrator
2. Provide your phone number: ${whatsappUser.phoneNumber}
3. They can link your account in the admin panel

Once linked, you can:
✅ See all your assigned tasks
✅ Create reports that are automatically assigned to you
✅ Get status updates

For now, you can still report incidents - they'll be created as unassigned tasks.`;

  await sendWhatsAppMessage(whatsappUser.phoneNumber, linkMessage, requestContext);
}

/**
 * Handle unknown commands
 */
async function handleUnknownCommand(
  whatsappUser: any,
  command: string,
  requestContext: any
) {
  const response = `❓ Unknown command: ${command}

Available commands:
• /help - Show help
• /status [reference] - Check task
• /list - Show your tasks
• /report [details] - Quick report

Or just describe any issue to report it! 📝`;

  await sendWhatsAppMessage(whatsappUser.phoneNumber, response, requestContext);
}

/**
 * Process incident reports from WhatsApp
 */
async function processIncidentReport(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  requestContext: any
) {
  try {
    logSecureInfo('Processing WhatsApp incident report', requestContext, {
      type: message.type,
      phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
      hasLinkedUser: !!whatsappUser.linkedUser
    });

    // Get categories for AI parsing
    const categories = await prisma.category.findMany({
      select: { id: true, name: true, isSystem: true }
    });

    // Extract message content for AI parsing
    let messageContent = '';
    let photoUrl = null;
    let locationData = null;

    switch (message.type) {
      case 'text':
        messageContent = message.text?.body || '';
        break;
      
      case 'image':
        messageContent = message.image?.caption || 'Image attachment for incident report';
        try {
          photoUrl = await downloadWhatsAppMedia(message.image?.id || '');
        } catch (error) {
          logSecureWarning('Failed to download WhatsApp image', requestContext, {
            mediaId: message.image?.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
        break;
      
      case 'location':
        messageContent = `Location-based incident report at ${message.location?.name || 'specified location'}`;
        locationData = {
          latitude: message.location?.latitude,
          longitude: message.location?.longitude,
          address: message.location?.address
        };
        break;
      
      default:
        messageContent = `${message.type} attachment for incident report`;
    }

    // Use AI to parse the incident report
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_VERCEL_URL 
      || 'http://localhost:3000';
      
    const aiResponse = await fetch(`${baseUrl}/api/ai/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageContent,
        categories: categories,
        source: 'whatsapp'
      })
    });

    if (!aiResponse.ok) {
      throw new Error('AI parsing failed');
    }

    const parsedData = await aiResponse.json();

    // Find or create linked user
    let userId = whatsappUser.linkedUserId;
    
    if (!userId) {
      // Create a new user linked to this WhatsApp user
      const newUser = await prisma.user.create({
        data: {
          name: whatsappUser.displayName || whatsappUser.profileName || `WhatsApp User (${whatsappUser.phoneNumber.slice(-4)})`,
          phone_number: whatsappUser.phoneNumber,
          role: 'Staff' // Default role for WhatsApp users
        }
      });
      
      // Link the WhatsApp user to the new user
      await prisma.whatsAppUser.update({
        where: { id: whatsappUser.id },
        data: { linkedUserId: newUser.id }
      });
      
      userId = newUser.id;
      
      logSecureInfo('Created new user for WhatsApp incident', requestContext, {
        userId: newUser.id,
        phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
      });
    }

    // Create activity with parsed data
    const activityData = {
      user_id: userId,
      category_id: parsedData.category_id,
      subcategory: parsedData.subcategory,
      location: locationData?.address || parsedData.location,
      notes: parsedData.notes + `\n\n[Created via WhatsApp from ${maskPhoneNumber(whatsappUser.phoneNumber)}]`,
      photo_url: photoUrl,
      latitude: locationData?.latitude,
      longitude: locationData?.longitude,
      status: 'Unassigned'
    };

    const newActivity = await prisma.activity.create({
      data: activityData,
      select: {
        id: true,
        user_id: true,
        category_id: true,
        subcategory: true,
        location: true,
        timestamp: true,
        notes: true,
        status: true,
        category: {
          select: { name: true }
        }
      }
    });

    // Link the WhatsApp message to the created activity
    await prisma.whatsAppMessage.updateMany({
      where: { 
        from: whatsappUser.phoneNumber,
        waId: message.id
      },
      data: { 
        relatedActivityId: newActivity.id,
        processed: true 
      }
    });

    // Generate reference number
    const referenceNumber = `${newActivity.category.name.substring(0,4).toUpperCase()}-${newActivity.id.slice(-4)}`;

    logSecureInfo('WhatsApp incident report processed successfully', requestContext, {
      activityId: newActivity.id,
      categoryId: newActivity.category_id,
      userId: userId,
      phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
      referenceNumber
    });

    // Send confirmation response
    await sendIncidentConfirmation(whatsappUser, newActivity, referenceNumber, requestContext);

  } catch (error) {
    logSecureError('Failed to process WhatsApp incident report', requestContext, 
      error instanceof Error ? error : undefined);
    
    // Send error response to user
    await sendErrorResponse(whatsappUser, 'Failed to process your incident report. Please try again or contact support.', requestContext);
  }
}

/**
 * Send contextual response based on message
 */
async function sendContextualResponse(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  requestContext: any
) {
  try {
    let responseMessage = '';
    
    // Determine appropriate response based on message content and user state
    if (message.type === 'text') {
      const messageText = message.text?.body?.toLowerCase() || '';
      
      // Check for greetings
      if (messageText.match(/(hi|hello|hey|good morning|good afternoon)/)) {
        responseMessage = `Hello! 👋\n\nI can help you report incidents and check task status.\n\nSend me details about any issues you'd like to report, or type /help for available commands.`;
      }
      // Check for thanks
      else if (messageText.match(/(thank|thanks|cheers)/)) {
        responseMessage = `You're welcome! 😊\n\nIs there anything else you need help with?`;
      }
      // Default response for unrecognized messages
      else {
        responseMessage = `I received your message but couldn't process it as an incident report.\n\n📝 To report an incident, please provide:\n• Location of the issue\n• Description of the problem\n• Any relevant details\n\nOr type /help for available commands.`;
      }
    }
    // Response for location messages
    else if (message.type === 'location') {
      responseMessage = `📍 Thank you for sharing the location.\n\nPlease also provide a description of the issue at this location so I can create a proper incident report.`;
    }
    // Response for media messages
    else if (['image', 'video', 'document'].includes(message.type)) {
      responseMessage = `📎 I received your ${message.type}.\n\nIf this is an incident report, please also include a description of the issue so I can process it properly.`;
    }
    // Default response
    else {
      responseMessage = `I received your ${message.type} but need more information to help you.\n\nType /help for available commands or provide details about any issues you'd like to report.`;
    }

    await sendWhatsAppMessage(whatsappUser.phoneNumber, responseMessage, requestContext);

    logSecureInfo('Contextual response sent', requestContext, {
      phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
      messageType: message.type,
      responseLength: responseMessage.length
    });

  } catch (error) {
    logSecureError('Failed to send contextual response', requestContext,
      error instanceof Error ? error : undefined);
  }
}

/**
 * Send incident confirmation message
 */
async function sendIncidentConfirmation(
  whatsappUser: any,
  activity: any,
  referenceNumber: string,
  requestContext: any
) {
  const confirmationMessage = `✅ *Incident Report Logged*

📋 **Reference:** ${referenceNumber}
🏷️ **Category:** ${activity.category.name} - ${activity.subcategory}
📍 **Location:** ${activity.location}
⏰ **Reported:** ${new Date(activity.timestamp).toLocaleString()}
📊 **Status:** ${activity.status}

Your incident has been successfully recorded and will be addressed by the appropriate team.

Type /status ${referenceNumber} to check updates.`;

  await sendWhatsAppMessage(whatsappUser.phoneNumber, confirmationMessage, requestContext);
}

/**
 * Send error response to user
 */
async function sendErrorResponse(
  whatsappUser: any,
  errorMessage: string,
  requestContext: any
) {
  const response = `❌ *Error*

${errorMessage}

Please try again or contact support if the problem persists.

Type /help for available commands.`;

  await sendWhatsAppMessage(whatsappUser.phoneNumber, response, requestContext);
}

/**
 * Send WhatsApp message using the Business API
 */
async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  requestContext: any
) {
  try {
    // Initialize WhatsApp config
    whatsappConfig.initialize();
    const config = whatsappConfig.getConfig();

    const apiUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    
    const requestBody = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`WhatsApp API error: ${errorData.error?.message || response.statusText}`);
    }

    const result = await response.json();

    // Store outbound message in database
    await prisma.whatsAppMessage.create({
      data: {
        waId: result.messages[0]?.id || 'unknown',
        from: config.phoneNumberId,
        to: phoneNumber,
        type: 'text',
        content: JSON.stringify({ text: message }),
        timestamp: new Date(),
        direction: 'outbound',
        status: 'sent',
        isFreeMessage: false, // Outbound messages may be charged
        processed: true
      }
    });

    logSecureInfo('WhatsApp message sent successfully', requestContext, {
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageId: result.messages[0]?.id,
      messageLength: message.length
    });

  } catch (error) {
    logSecureError('Failed to send WhatsApp message', requestContext,
      error instanceof Error ? error : undefined);
    throw error; // Re-throw to handle in calling function
  }
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
 * Download WhatsApp media file and return public URL
 */
async function downloadWhatsAppMedia(mediaId: string): Promise<string | null> {
  try {
    // Initialize WhatsApp config
    whatsappConfig.initialize();
    const config = whatsappConfig.getConfig();

    // Step 1: Get media URL from WhatsApp API
    const mediaResponse = await fetch(`https://graph.facebook.com/${config.apiVersion}/${mediaId}`, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });

    if (!mediaResponse.ok) {
      throw new Error(`Failed to get media info: ${mediaResponse.statusText}`);
    }

    const mediaInfo = await mediaResponse.json();

    // Step 2: Download the actual media file
    const fileResponse = await fetch(mediaInfo.url, {
      headers: {
        'Authorization': `Bearer ${config.accessToken}`
      }
    });

    if (!fileResponse.ok) {
      throw new Error(`Failed to download media: ${fileResponse.statusText}`);
    }

    const fileBuffer = await fileResponse.arrayBuffer();
    const fileName = `whatsapp_media_${mediaId}_${Date.now()}.${mediaInfo.mime_type?.split('/')[1] || 'jpg'}`;

    // TODO: Upload to your file storage (S3, Cloudinary, etc.)
    // For now, return a placeholder URL
    // In a real implementation, you would:
    // 1. Upload fileBuffer to your file storage service
    // 2. Return the public URL
    
    return `https://your-storage.com/whatsapp-media/${fileName}`;

  } catch (error) {
    console.error('Failed to download WhatsApp media:', error);
    return null;
  }
}

/**
 * Mask phone number for logging
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 4) return '****';
  return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
}