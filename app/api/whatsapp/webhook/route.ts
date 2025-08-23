import { NextRequest, NextResponse } from 'next/server';
import { whatsappConfig } from '../../../../lib/whatsapp/config';
import { WhatsAppWebhookPayload, WhatsAppInboundMessage } from '../../../../lib/whatsapp/types';
import { WhatsAppMessageOptimizer } from '../../../../lib/whatsapp/message-optimizer';
import { prisma } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, logSecureWarning, createRequestContext } from '../../../../lib/secure-logger';
import { getWorkingAIProvider } from '../../../../lib/ai-factory';
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

    // Get raw request body for signature verification
    const rawBody = await request.text();
    const payload: WhatsAppWebhookPayload = JSON.parse(rawBody);

    // Verify webhook signature
    const signature = request.headers.get('x-hub-signature-256');
    console.log('🔍 WEBHOOK SIGNATURE VERIFICATION:');
    console.log('  📝 Raw body length:', rawBody.length);
    console.log('  🔐 Signature header:', signature);
    console.log('  📄 Body preview:', rawBody.substring(0, 200) + '...');
    
    // Allow bypassing signature verification in development with special header
    const bypassSignature = request.headers.get('x-dev-bypass-signature') === 'true' && process.env.NODE_ENV === 'development';
    
    if (!bypassSignature && !(await verifyWebhookSignature(rawBody, signature))) {
      console.log('❌ Signature verification FAILED');
      logSecureWarning('WhatsApp webhook signature verification failed', {
        ...requestContext,
        statusCode: 401
      });
      
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    if (bypassSignature) {
      console.log('🔥 DEV MODE: Signature verification BYPASSED');
    } else {
      console.log('✅ Signature verification PASSED');
    }

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
 * Meta sends the signature as x-hub-signature-256: sha256=<signature>
 * We need to verify this against the raw request body using the app secret
 */
async function verifyWebhookSignature(rawBody: string, signature: string | null): Promise<boolean> {
  if (!signature) {
    console.log('❌ No signature provided in x-hub-signature-256 header');
    return false;
  }

  try {
    const config = whatsappConfig.getConfig();
    
    // Clean the app secret (remove any trailing newlines)
    const cleanAppSecret = config.appSecret.replace(/\\n$/, '').replace(/\n$/, '').trim();
    
    console.log('🔧 Signature verification details:');
    console.log('  🔑 App secret length:', cleanAppSecret.length);
    console.log('  🔑 App secret preview:', cleanAppSecret.substring(0, 10) + '...');
    console.log('  📝 Raw body length:', rawBody.length);
    console.log('  🔐 Received signature:', signature);
    
    // Compute expected signature
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', cleanAppSecret)
      .update(rawBody, 'utf8')
      .digest('hex');
    
    console.log('  🧮 Expected signature:', expectedSignature);
    console.log('  ⚙️ Signatures match:', signature === expectedSignature);

    // Use timing-safe comparison
    const signatureMatch = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
    
    if (!signatureMatch) {
      console.log('❌ Signature verification failed:');
      console.log('  Expected:', expectedSignature);
      console.log('  Received:', signature);
      console.log('  App Secret (first 20 chars):', cleanAppSecret.substring(0, 20));
    }
    
    return signatureMatch;
    
  } catch (error) {
    console.log('❌ Signature verification error:', error instanceof Error ? error.message : 'Unknown error');
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
      'broken', 'damage', 'maintenance', 'repair', 'help',
      'fix', 'clean', 'leak', 'window', 'door', 'light', 'toilet',
      'urgent', 'safety', 'hazard', 'fault', 'replace', 'install',
      'misbehav', 'behav', 'bullying', 'fight', 'classroom', 'discipline'
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
  console.log('🆘 HELP COMMAND: About to send help message to', maskPhoneNumber(whatsappUser.phoneNumber));
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

  console.log('🆘 HELP COMMAND: Calling sendWhatsAppMessage...');
  const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, helpMessage, requestContext);
  console.log('🆘 HELP COMMAND: sendWhatsAppMessage result:', result);
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
        assignedTo: {
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
${activity.assignedTo ? `👤 **Assigned to:** ${activity.assignedTo.name}` : ''}

${activity.updates.length > 0 ? 
  `📝 **Recent Updates:**\n${activity.updates.map((update: any, i: number) => 
    `${i + 1}. ${new Date(update.timestamp).toLocaleDateString()}: ${update.notes}`
  ).join('\n')}` : 
  '📝 **No updates yet**'}

${activity.resolution_notes ? `✅ **Resolution:** ${activity.resolution_notes}` : ''}`;

    console.log('📊 STATUS COMMAND: Calling sendWhatsAppMessage...');
    const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, statusMessage, requestContext);
    console.log('📊 STATUS COMMAND: sendWhatsAppMessage result:', result);

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

  console.log('📋 LIST COMMAND: Calling sendWhatsAppMessage...');
  const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, listMessage, requestContext);
  console.log('📋 LIST COMMAND: sendWhatsAppMessage result:', result);
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

  console.log('❓ UNKNOWN COMMAND: Calling sendWhatsAppMessage...');
  const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, response, requestContext);
  console.log('❓ UNKNOWN COMMAND: sendWhatsAppMessage result:', result);
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

    // 🔍 DIAGNOSTIC: Start AI processing
    logSecureInfo('🚀 Starting AI processing for incident', requestContext, {
      messageContent: messageContent.substring(0, 100) + '...',
      categoriesCount: categories.length,
      hasPhoto: !!photoUrl,
      hasLocation: !!locationData
    });

    // Use AI to parse the incident report with proper FormData format
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_VERCEL_URL 
      || 'http://localhost:3000';
    
    logSecureInfo('🔍 AI parsing URL constructed', requestContext, {
      baseUrl,
      endpoint: `${baseUrl}/api/ai/parse`
    });
    
    // Prepare FormData for AI parsing API
    const formData = new FormData();
    formData.append('message', messageContent);
    formData.append('categories', JSON.stringify(categories));
    
    // Add photo data if available
    if (photoUrl) {
      formData.append('photo', photoUrl);
    }
      
    logSecureInfo('📤 Calling AI parse endpoint', requestContext, {
      url: `${baseUrl}/api/ai/parse`,
      messageLength: messageContent.length
    });

    const aiResponse = await fetch(`${baseUrl}/api/ai/parse`, {
      method: 'POST',
      body: formData
    });

    logSecureInfo('📥 AI parse response received', requestContext, {
      status: aiResponse.status,
      statusText: aiResponse.statusText,
      ok: aiResponse.ok
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      logSecureError('❌ AI parsing failed', requestContext, 
        new Error(`AI parsing failed: ${aiResponse.status} - ${errorText}`), {
        status: aiResponse.status,
        error: errorText
      });
      throw new Error(`AI parsing failed: ${aiResponse.status} - ${errorText}`);
    }

    const parsedData = await aiResponse.json();
    logSecureInfo('✅ AI parsing successful', requestContext, {
      parsedData: {
        category_id: parsedData.category_id,
        subcategory: parsedData.subcategory,
        location: parsedData.location,
        hasNotes: !!parsedData.notes
      }
    });
    
    // Validate AI parsing result
    if (!parsedData.category_id || !parsedData.subcategory || !parsedData.location) {
      logSecureWarning('AI parsing returned incomplete data', requestContext, { parsedData });
      throw new Error('AI parsing returned incomplete data');
    }

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
    
    try {
      // Extract message content again for fallback
      let fallbackContent = '';
      switch (message.type) {
        case 'text':
          fallbackContent = message.text?.body || '';
          break;
        case 'image':
          fallbackContent = message.image?.caption || 'Image attachment for incident report';
          break;
        case 'location':
          fallbackContent = `Location-based incident report at ${message.location?.name || 'specified location'}`;
          break;
        default:
          fallbackContent = `${message.type} attachment for incident report`;
      }
      
      // Fallback: Create manual processing entry
      await createManualProcessingEntry(message, whatsappUser, fallbackContent, requestContext);
      
      // Send fallback response to user
      const fallbackMessage = `📝 *Message Received*

Your message has been received and added to our manual processing queue. A team member will review it shortly.

Message: "${fallbackContent.substring(0, 100)}${fallbackContent.length > 100 ? '...' : ''}"

You'll receive an update once it's been processed.

If this is urgent, please call our emergency number.`;

      const fallbackResult = await sendWhatsAppMessage(whatsappUser.phoneNumber, fallbackMessage, requestContext);
      
      if (!fallbackResult.success) {
        logSecureError('Failed to send fallback message', requestContext, undefined, {
          error: fallbackResult.error,
          phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
        });
      }
      
    } catch (fallbackError) {
      logSecureError('Failed to create manual processing entry', requestContext, 
        fallbackError instanceof Error ? fallbackError : undefined);
      
      // Send error response to user
      await sendErrorResponse(whatsappUser, 'Failed to process your incident report. Please try again or contact support.', requestContext);
    }
  }
}

/**
 * Create manual processing entry when AI processing fails
 */
async function createManualProcessingEntry(
  message: WhatsAppInboundMessage,
  whatsappUser: any,
  messageContent: string,
  requestContext: any
) {
  try {
    // Find or create a default "Manual Review" category
    let manualCategory = await prisma.category.findFirst({
      where: { name: 'Manual Review' }
    });
    
    if (!manualCategory) {
      manualCategory = await prisma.category.create({
        data: {
          name: 'Manual Review',
          isSystem: true
        }
      });
    }

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
      
      logSecureInfo('Created new user for manual processing', requestContext, {
        userId: newUser.id,
        phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
      });
    }

    // Create activity for manual review
    const manualActivity = await prisma.activity.create({
      data: {
        user_id: userId,
        category_id: manualCategory.id,
        subcategory: 'WhatsApp Message - Requires Review',
        location: 'Unknown - See Notes',
        notes: `Manual review required for WhatsApp message:\n\nOriginal message: "${messageContent}"\n\nMessage type: ${message.type}\nFrom: ${maskPhoneNumber(whatsappUser.phoneNumber)}\nReceived: ${new Date().toISOString()}\n\nAI processing failed - manual categorization needed.`,
        status: 'Unassigned'
      },
      select: {
        id: true,
        timestamp: true
      }
    });

    // Link the WhatsApp message to the manual processing activity
    await prisma.whatsAppMessage.updateMany({
      where: { 
        from: whatsappUser.phoneNumber,
        waId: message.id
      },
      data: { 
        relatedActivityId: manualActivity.id,
        processed: true,
        processingError: 'AI processing failed - created manual review task'
      }
    });

    logSecureInfo('Manual processing entry created', requestContext, {
      activityId: manualActivity.id,
      userId: userId,
      phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
    });

  } catch (error) {
    logSecureError('Failed to create manual processing entry', requestContext,
      error instanceof Error ? error : undefined);
    throw error;
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

    console.log('💬 CONTEXTUAL RESPONSE: Calling sendWhatsAppMessage...');
    const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, responseMessage, requestContext);
    console.log('💬 CONTEXTUAL RESPONSE: sendWhatsAppMessage result:', result);

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
 * Generate AI-powered confirmation response
 */
async function generateAIConfirmation(
  activity: any,
  referenceNumber: string,
  requestContext: any
): Promise<string> {
  try {
    // 🔍 DIAGNOSTIC: Start response generation
    logSecureInfo('🤖 Starting AI confirmation generation', requestContext, {
      referenceNumber,
      category: activity.category?.name,
      subcategory: activity.subcategory,
      location: activity.location?.substring(0, 50) + '...'
    });

    const ai = getWorkingAIProvider();
    logSecureInfo('🔧 AI provider obtained', requestContext, {
      providerName: ai.constructor.name
    });
    
    const prompt = `You are a helpful assistant for a school incident management system. Generate a professional but friendly WhatsApp confirmation message for an incident report that was just logged.

Context:
- Reference Number: ${referenceNumber}
- Category: ${activity.category.name} - ${activity.subcategory}
- Location: ${activity.location}
- Status: ${activity.status}
- Reported: ${new Date(activity.timestamp).toLocaleString()}

Requirements:
- Use appropriate emojis but keep it professional
- Mention expected timeline based on category (urgent: 1-2 hours, normal: 24-48 hours, maintenance: 2-5 days)
- Include reference number for tracking
- Keep message under 160 characters for SMS compatibility
- Use school-appropriate language
- Reassure that the issue will be addressed

Generate only the message text, no quotes or extra formatting.`;

    logSecureInfo('💬 Calling AI generateContent', requestContext, {
      promptLength: prompt.length
    });

    const response = await ai.generateContent(prompt, { 
      maxTokens: 200,
      temperature: 0.3 
    });
    
    logSecureInfo('✅ AI content generated successfully', requestContext, {
      responseLength: response.text?.length || 0,
      preview: response.text?.substring(0, 100) + '...'
    });

    return response.text.trim();
    
  } catch (error) {
    logSecureError('❌ AI confirmation generation failed, using fallback', requestContext, 
      error instanceof Error ? error : undefined, {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    
    // Fallback to standard message
    return `✅ Task ${referenceNumber} logged successfully! ${activity.category.name} issue at ${activity.location}. Track progress with /status ${referenceNumber}`;
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
  try {
    // Generate AI-powered confirmation
    const aiConfirmation = await generateAIConfirmation(activity, referenceNumber, requestContext);
    
    const confirmationMessage = `${aiConfirmation}

📋 **Details:**
🏷️ ${activity.category.name} - ${activity.subcategory}
📍 ${activity.location}
📊 ${activity.status}

Type /status ${referenceNumber} for updates.`;

    console.log('✅ INCIDENT CONFIRMATION: Calling sendWhatsAppMessage...');
    const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, confirmationMessage, requestContext);
    console.log('✅ INCIDENT CONFIRMATION: sendWhatsAppMessage result:', result);
    
    if (result.success) {
      logSecureInfo('AI-powered confirmation sent', requestContext, {
        referenceNumber,
        phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
        messageId: result.messageId,
        aiGenerated: true
      });
    } else {
      throw new Error(`Failed to send confirmation: ${result.error}`);
    }
    
  } catch (error) {
    logSecureError('Failed to send incident confirmation', requestContext,
      error instanceof Error ? error : undefined);
    
    // Fallback to basic confirmation
    const basicConfirmation = `✅ *Incident Report Logged*

📋 **Reference:** ${referenceNumber}
🏷️ **Category:** ${activity.category.name} - ${activity.subcategory}
📍 **Location:** ${activity.location}
⏰ **Reported:** ${new Date(activity.timestamp).toLocaleString()}
📊 **Status:** ${activity.status}

Your incident has been successfully recorded and will be addressed by the appropriate team.

Type /status ${referenceNumber} to check updates.`;

    console.log('🔄 FALLBACK CONFIRMATION: Calling sendWhatsAppMessage...');
    const fallbackResult = await sendWhatsAppMessage(whatsappUser.phoneNumber, basicConfirmation, requestContext);
    console.log('🔄 FALLBACK CONFIRMATION: sendWhatsAppMessage result:', fallbackResult);
    
    if (!fallbackResult.success) {
      logSecureError('Fallback confirmation also failed', requestContext, undefined, {
        error: fallbackResult.error,
        referenceNumber
      });
    }
  }
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

  console.log('❌ ERROR RESPONSE: Calling sendWhatsAppMessage...');
  const result = await sendWhatsAppMessage(whatsappUser.phoneNumber, response, requestContext);
  console.log('❌ ERROR RESPONSE: sendWhatsAppMessage result:', result);
}

/**
 * Send WhatsApp message using the Business API with enhanced deployment logging
 */
async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  requestContext: any,
  retryCount = 0
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const maxRetries = 2;
  
  try {
    // 🔍 ENHANCED DEPLOYMENT DIAGNOSTICS: Start WhatsApp send
    console.log('\n🚀 ===== WHATSAPP MESSAGE SEND START (ENHANCED DEPLOYMENT LOGGING) =====');
    console.log('🌍 Environment:', process.env.NODE_ENV || 'unknown');
    console.log('🏗️ Platform:', process.env.VERCEL ? 'Vercel' : 'Local');
    console.log('⏰ Timestamp:', new Date().toISOString());
    console.log('📞 Phone Number:', maskPhoneNumber(phoneNumber));
    console.log('📝 Message Length:', message.length);
    console.log('🔄 Retry Count:', retryCount);
    console.log('📄 Message Preview:', message.substring(0, 150) + (message.length > 150 ? '...' : ''));
    
    // 🔍 ENHANCED: Environment variable debugging
    console.log('\n🔧 ===== ENVIRONMENT VARIABLES ANALYSIS =====');
    const rawAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    const rawPhoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const rawBusinessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    const rawAppSecret = process.env.WHATSAPP_APP_SECRET;
    
    console.log('🔑 Raw Access Token Info:');
    console.log('  ✅ Exists:', !!rawAccessToken);
    console.log('  📏 Length:', rawAccessToken?.length || 0);
    console.log('  🔍 Preview (first 50 chars):', rawAccessToken?.substring(0, 50) + '...');
    console.log('  ⚠️ Has trailing chars:', rawAccessToken ? JSON.stringify(rawAccessToken.slice(-5)) : 'N/A');
    console.log('  📊 Type:', typeof rawAccessToken);
    
    console.log('📱 Raw Phone Number ID Info:');
    console.log('  ✅ Exists:', !!rawPhoneNumberId);
    console.log('  📏 Length:', rawPhoneNumberId?.length || 0);
    console.log('  🔍 Value:', rawPhoneNumberId || 'NOT SET');
    console.log('  ⚠️ Has trailing chars:', rawPhoneNumberId ? JSON.stringify(rawPhoneNumberId.slice(-3)) : 'N/A');
    console.log('  📊 Type:', typeof rawPhoneNumberId);
    
    console.log('🏢 Raw Business Account ID Info:');
    console.log('  ✅ Exists:', !!rawBusinessAccountId);
    console.log('  📏 Length:', rawBusinessAccountId?.length || 0);
    console.log('  🔍 Value:', rawBusinessAccountId || 'NOT SET');
    console.log('  ⚠️ Has trailing chars:', rawBusinessAccountId ? JSON.stringify(rawBusinessAccountId.slice(-3)) : 'N/A');
    
    console.log('🔐 Raw App Secret Info:');
    console.log('  ✅ Exists:', !!rawAppSecret);
    console.log('  📏 Length:', rawAppSecret?.length || 0);
    console.log('  🔍 Preview (first 20 chars):', rawAppSecret?.substring(0, 20) + '...');
    console.log('  ⚠️ Has trailing chars:', rawAppSecret ? JSON.stringify(rawAppSecret.slice(-3)) : 'N/A');
    
    logSecureInfo('📤 Starting WhatsApp message send with enhanced logging', requestContext, {
      environment: process.env.NODE_ENV,
      platform: process.env.VERCEL ? 'Vercel' : 'Local',
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageLength: message.length,
      retryCount,
      messagePreview: message.substring(0, 100) + '...'
    });

    // Initialize WhatsApp config with detailed logging
    console.log('\n🔧 ===== WHATSAPP CONFIG INITIALIZATION =====');
    console.log('🚀 Calling whatsappConfig.initialize()...');
    whatsappConfig.initialize();
    const config = whatsappConfig.getConfig();
    
    console.log('✅ Config loaded and processed:');
    console.log('  🔑 Has Access Token:', !!config.accessToken);
    console.log('  🔑 Access Token Length:', config.accessToken?.length || 0);
    console.log('  🔑 Access Token Type:', config.accessToken?.startsWith('EAA') ? 'User Access Token (EAA)' : config.accessToken?.startsWith('EAB') ? 'System User Token (EAB)' : 'Unknown Token Type');
    console.log('  🔑 Token Preview (first 50):', config.accessToken?.substring(0, 50) + '...');
    console.log('  🔑 Token suffix (last 10):', config.accessToken?.slice(-10));
    
    console.log('  📱 Has Phone Number ID:', !!config.phoneNumberId);
    console.log('  📱 Phone Number ID:', config.phoneNumberId);
    console.log('  📱 Phone Number ID Length:', config.phoneNumberId?.length || 0);
    console.log('  📱 Phone Number ID Type:', typeof config.phoneNumberId);
    
    console.log('  🏢 Business Account ID:', config.businessAccountId);
    console.log('  🏢 Business Account ID Length:', config.businessAccountId?.length || 0);
    
    console.log('  📊 API Version:', config.apiVersion);
    console.log('  🔐 App Secret Length:', config.appSecret?.length || 0);
    console.log('  🔐 App Secret Preview:', config.appSecret?.substring(0, 20) + '...');
    
    // Check for common configuration issues
    console.log('\n🔍 ===== CONFIG VALIDATION CHECKS =====');
    const configIssues = [];
    
    if (!config.accessToken) configIssues.push('❌ Access token is missing');
    else if (config.accessToken.length < 100) configIssues.push('⚠️ Access token seems too short');
    
    if (!config.phoneNumberId) configIssues.push('❌ Phone number ID is missing');
    else if (!/^\d+$/.test(config.phoneNumberId)) configIssues.push('⚠️ Phone number ID contains non-numeric characters');
    else if (config.phoneNumberId.length < 10) configIssues.push('⚠️ Phone number ID seems too short');
    
    if (!config.businessAccountId) configIssues.push('❌ Business account ID is missing');
    if (!config.appSecret) configIssues.push('❌ App secret is missing');
    
    if (configIssues.length > 0) {
      console.log('⚠️ Configuration Issues Found:');
      configIssues.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✅ All configuration validation checks passed');
    }
    
    logSecureInfo('🔧 WhatsApp config initialized with detailed analysis', requestContext, {
      hasAccessToken: !!config.accessToken,
      tokenLength: config.accessToken?.length || 0,
      tokenType: config.accessToken?.startsWith('EAA') ? 'User Access Token' : config.accessToken?.startsWith('EAB') ? 'System User Token' : 'Unknown',
      hasPhoneNumberId: !!config.phoneNumberId,
      phoneNumberIdLength: config.phoneNumberId?.length || 0,
      apiVersion: config.apiVersion,
      configIssuesCount: configIssues.length
    });

    // 🔍 ENHANCED: API URL Construction with detailed validation
    console.log('\n🌐 ===== API URL CONSTRUCTION =====');
    const apiUrl = `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
    
    console.log('🔗 URL Construction Details:');
    console.log('  🌐 Base URL: https://graph.facebook.com');
    console.log('  📊 API Version:', config.apiVersion);
    console.log('  📱 Phone Number ID (raw):', config.phoneNumberId);
    console.log('  📱 Phone Number ID (encoded):', encodeURIComponent(config.phoneNumberId || ''));
    console.log('  🔗 Complete URL:', apiUrl);
    console.log('  📏 URL Length:', apiUrl.length);
    
    // Validate URL format
    const urlValidation = [];
    if (apiUrl.includes('undefined')) urlValidation.push('❌ URL contains undefined values');
    if (apiUrl.includes('null')) urlValidation.push('❌ URL contains null values');
    if (apiUrl.includes('//messages')) urlValidation.push('❌ URL has double slashes before messages');
    if (apiUrl.includes('/messages/messages')) urlValidation.push('❌ URL has duplicate /messages path');
    if (!/\/v\d+\.\d+\/\d+\/messages$/.test(apiUrl.split('https://graph.facebook.com')[1])) {
      urlValidation.push('⚠️ URL format doesn\'t match expected pattern');
    }
    
    if (urlValidation.length > 0) {
      console.log('⚠️ URL Validation Issues:');
      urlValidation.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✅ URL format validation passed');
    }
    
    logSecureInfo('🔗 WhatsApp API URL constructed and validated', requestContext, {
      apiUrl,
      phoneNumberId: config.phoneNumberId,
      urlLength: apiUrl.length,
      urlValidationIssues: urlValidation.length
    });
    
    // 🔍 ENHANCED: Request body construction and validation
    console.log('\n📦 ===== REQUEST BODY CONSTRUCTION =====');
    const requestBody = {
      messaging_product: 'whatsapp',
      to: phoneNumber,
      type: 'text',
      text: {
        body: message
      }
    };
    
    const requestBodyJson = JSON.stringify(requestBody);
    const requestBodySize = requestBodyJson.length;
    
    console.log('📦 Request Body Details:');
    console.log('  📋 Messaging Product:', requestBody.messaging_product);
    console.log('  📞 To (masked):', maskPhoneNumber(requestBody.to));
    console.log('  🏷️ Type:', requestBody.type);
    console.log('  📝 Message Body Length:', requestBody.text.body.length);
    console.log('  📏 JSON Size:', requestBodySize, 'bytes');
    console.log('  📄 Complete JSON:', requestBodyJson);
    
    // Validate request body
    const bodyValidation = [];
    if (!requestBody.messaging_product) bodyValidation.push('❌ Missing messaging_product');
    if (!requestBody.to) bodyValidation.push('❌ Missing to field');
    if (!requestBody.type) bodyValidation.push('❌ Missing type field');
    if (!requestBody.text?.body) bodyValidation.push('❌ Missing message body');
    if (requestBodySize > 4096) bodyValidation.push('⚠️ Request body might be too large');
    
    if (bodyValidation.length > 0) {
      console.log('⚠️ Request Body Validation Issues:');
      bodyValidation.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✅ Request body validation passed');
    }

    // 🔍 ENHANCED: Headers construction and validation
    console.log('\n🔐 ===== REQUEST HEADERS CONSTRUCTION =====');
    const headers = {
      'Authorization': `Bearer ${config.accessToken}`,
      'Content-Type': 'application/json'
    };
    
    console.log('📋 Request Headers:');
    console.log('  🔐 Authorization: Bearer [TOKEN_PREVIEW]');
    console.log('  🔑 Token Length:', config.accessToken?.length || 0);
    console.log('  🔑 Token Prefix:', config.accessToken?.substring(0, 10) + '***');
    console.log('  🔑 Token Suffix:', '***' + config.accessToken?.slice(-10));
    console.log('  📄 Content-Type:', headers['Content-Type']);
    
    // Validate headers
    const headerValidation = [];
    if (!config.accessToken) headerValidation.push('❌ Access token is missing');
    if (config.accessToken && config.accessToken.length < 50) headerValidation.push('⚠️ Access token seems too short');
    if (!headers['Content-Type']) headerValidation.push('❌ Content-Type header missing');
    
    if (headerValidation.length > 0) {
      console.log('⚠️ Header Validation Issues:');
      headerValidation.forEach(issue => console.log(`  ${issue}`));
    } else {
      console.log('✅ Header validation passed');
    }

    logSecureInfo('🌐 WhatsApp API request prepared with comprehensive validation', requestContext, {
      method: 'POST',
      url: apiUrl,
      bodySize: requestBodySize,
      tokenLength: config.accessToken?.length || 0,
      validationIssues: [...urlValidation, ...bodyValidation, ...headerValidation].length
    });

    // 🔍 ENHANCED: Pre-flight check before API call
    console.log('\n🚀 ===== MAKING API CALL TO WHATSAPP =====');
    console.log('⏰ Call initiated at:', new Date().toISOString());
    console.log('🌐 Target URL:', apiUrl);
    console.log('📦 Request method: POST');
    console.log('📏 Payload size:', requestBodySize, 'bytes');
    console.log('⏱️ Timeout: 30000ms (30 seconds)');
    
    const startTime = Date.now();
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: requestBodyJson,
        signal: AbortSignal.timeout(30000) // 30 second timeout
      });
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      
      console.log('\n📥 ===== WHATSAPP API RESPONSE ANALYSIS =====');
      console.log('⏱️ Response time:', responseTime + 'ms');
      console.log('📊 Status Code:', response.status);
      console.log('📃 Status Text:', response.statusText);
      console.log('✅ Response OK:', response.ok);
      console.log('🏷️ Content Type:', response.headers.get('content-type'));
      console.log('📏 Content Length:', response.headers.get('content-length'));
      console.log('🔍 Server:', response.headers.get('server'));
      console.log('📅 Date:', response.headers.get('date'));
      console.log('🆔 X-FB-Trace-ID:', response.headers.get('x-fb-trace-id'));
      console.log('⚡ X-FB-Rev:', response.headers.get('x-fb-rev'));
      
      // Capture all response headers for debugging
      const allHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        allHeaders[key] = value;
      });
      console.log('📋 All Response Headers:', JSON.stringify(allHeaders, null, 2));
      
      logSecureInfo('📥 WhatsApp API response received with detailed analysis', requestContext, {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
        responseTime: responseTime,
        headers: allHeaders
      });

    if (!response.ok) {
      console.log('\n❌ ===== API CALL FAILED - ERROR ANALYSIS =====');
      
      let errorData;
      let errorText = '';
      
      try {
        console.log('📄 Attempting to parse JSON error response...');
        errorText = await response.text();
        console.log('📄 Raw error response text:', errorText);
        
        try {
          errorData = JSON.parse(errorText);
          console.log('✅ Successfully parsed JSON error response');
        } catch (parseError) {
          console.log('⚠️ Failed to parse error response as JSON:', parseError instanceof Error ? parseError.message : 'Unknown parse error');
          errorData = { rawResponse: errorText };
        }
      } catch (textError) {
        console.log('❌ Failed to read error response text:', textError instanceof Error ? textError.message : 'Unknown text error');
        errorData = { error: 'Failed to read response' };
      }
      
      const errorMessage = errorData.error?.message || response.statusText || 'Unknown error';
      
      console.log('\n💥 ===== COMPREHENSIVE ERROR DETAILS =====');
      console.log('📊 HTTP Status:', response.status, response.statusText);
      console.log('🔢 Error Code:', errorData.error?.code || 'Not provided');
      console.log('📝 Error Message:', errorMessage);
      console.log('🏷️ Error Type:', errorData.error?.type || 'Not provided');
      console.log('🆔 Error Subcode:', errorData.error?.error_subcode || 'Not provided');
      console.log('🔍 FB Trace ID:', errorData.error?.fbtrace_id || response.headers.get('x-fb-trace-id') || 'Not provided');
      console.log('📄 Error User Title:', errorData.error?.error_user_title || 'Not provided');
      console.log('📄 Error User Message:', errorData.error?.error_user_msg || 'Not provided');
      console.log('🔗 Error Data:', errorData.error?.error_data || 'Not provided');
      console.log('🌐 Is Transient:', errorData.error?.is_transient || 'Not provided');
      console.log('📄 Full Error Response:', JSON.stringify(errorData, null, 2));
      console.log('📄 Raw Response Text (first 500 chars):', errorText.substring(0, 500));
      
      // Enhanced error classification for debugging
      console.log('\n🔍 ===== ERROR CLASSIFICATION =====');
      const errorClassification = [];
      
      if (response.status === 401) {
        errorClassification.push('🔑 AUTHENTICATION ERROR - Token may be invalid, expired, or lack permissions');
      }
      if (response.status === 403) {
        errorClassification.push('🚫 AUTHORIZATION ERROR - Token valid but lacks required permissions');
      }
      if (response.status === 404) {
        errorClassification.push('❓ NOT FOUND ERROR - Phone Number ID or endpoint may be incorrect');
      }
      if (response.status === 429) {
        errorClassification.push('⏱️ RATE LIMIT ERROR - Too many requests, retry with backoff');
      }
      if (response.status >= 500) {
        errorClassification.push('🔥 SERVER ERROR - Meta/WhatsApp API issue, retry may help');
      }
      
      if (errorData.error?.code === 190) {
        errorClassification.push('🔑 ERROR 190 - Invalid access token (expired, revoked, or malformed)');
      }
      if (errorData.error?.code === 100) {
        errorClassification.push('❌ ERROR 100 - Invalid parameter (check phone number, message format, etc.)');
      }
      if (errorData.error?.code === 200) {
        errorClassification.push('🚫 ERROR 200 - Permission denied (insufficient permissions)');
      }
      
      if (errorMessage.toLowerCase().includes('token')) {
        errorClassification.push('🔑 TOKEN ISSUE - Error message mentions token problems');
      }
      if (errorMessage.toLowerCase().includes('phone')) {
        errorClassification.push('📱 PHONE ISSUE - Error message mentions phone number problems');
      }
      if (errorMessage.toLowerCase().includes('permission')) {
        errorClassification.push('🚫 PERMISSION ISSUE - Error message mentions permission problems');
      }
      
      console.log('🎯 Error Classification:');
      if (errorClassification.length > 0) {
        errorClassification.forEach(classification => console.log(`  ${classification}`));
      } else {
        console.log('  ❓ Unknown error type - review full error details above');
      }
      
      logSecureError('❌ WhatsApp API call failed with comprehensive analysis', requestContext, 
        new Error(`WhatsApp API error: ${errorMessage}`), {
        status: response.status,
        statusText: response.statusText,
        errorData,
        rawErrorText: errorText.substring(0, 500),
        retryCount,
        errorClassification
      });
      
      // Check if this is a retryable error
      const retryableErrors = ['temporarily_unavailable', 'rate_limit_hit', 'server_error'];
      const isRetryable = retryableErrors.some(err => errorMessage.toLowerCase().includes(err));
      
      if (isRetryable && retryCount < maxRetries) {
        logSecureWarning('WhatsApp API error, retrying', requestContext, {
          error: errorMessage,
          retryCount: retryCount + 1,
          phoneNumber: maskPhoneNumber(phoneNumber)
        });
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
        return sendWhatsAppMessage(phoneNumber, message, requestContext, retryCount + 1);
      }
      
      throw new Error(`WhatsApp API error: ${errorMessage}`);
    }

    console.log('✅ API call successful, parsing response...');
    const result = await response.json();
    const messageId = result.messages[0]?.id || 'unknown';
    
    console.log('🎉 WhatsApp API Success Response:');
    console.log('  📨 Message ID:', messageId);
    console.log('  📊 Status:', result.messages[0]?.message_status);
    console.log('  📄 Full Response:', JSON.stringify(result, null, 2));

    // Store outbound message in database
    console.log('💾 Storing message in database...');
    await prisma.whatsAppMessage.create({
      data: {
        waId: messageId,
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
    console.log('✅ Message stored in database successfully');

    logSecureInfo('WhatsApp message sent successfully', requestContext, {
      phoneNumber: maskPhoneNumber(phoneNumber),
      messageId: messageId,
      messageLength: message.length,
      retryCount
    });
    
    console.log('🏁 ===== WHATSAPP MESSAGE SEND SUCCESS =====\n');

    return { success: true, messageId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.log('💥 ===== WHATSAPP MESSAGE SEND FAILED =====');
    console.log('❌ Catch Block Error:', errorMessage);
    console.log('📞 Phone Number:', maskPhoneNumber(phoneNumber));
    console.log('🔄 Retry Count:', retryCount);
    console.log('📝 Message Length:', message.length);
    console.log('🔍 Error Stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    logSecureError('Failed to send WhatsApp message', requestContext, error instanceof Error ? error : undefined, {
      phoneNumber: maskPhoneNumber(phoneNumber),
      retryCount,
      messageLength: message.length
    });

    // Store failed message attempt
    try {
      await prisma.whatsAppMessage.create({
        data: {
          waId: `failed_${Date.now()}`,
          from: 'system',
          to: phoneNumber,
          type: 'text',
          content: JSON.stringify({ text: message }),
          timestamp: new Date(),
          direction: 'outbound',
          status: 'failed',
          isFreeMessage: false,
          processed: true,
          processingError: errorMessage
        }
      });
    } catch (dbError) {
      console.log('💾 Failed to store failed message in database:', dbError instanceof Error ? dbError.message : 'Unknown DB error');
      logSecureError('Failed to store failed message', requestContext, dbError instanceof Error ? dbError : undefined);
    }

    console.log('🏁 ===== WHATSAPP MESSAGE SEND FAILED =====\n');
    return { success: false, error: errorMessage };
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