import { NextRequest, NextResponse } from 'next/server';
import { whatsappMessaging, SendMessageOptions } from '../../../../lib/whatsapp/messaging-service';
import { withAuth } from '../../../../lib/auth-context';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { z } from 'zod';

/**
 * WhatsApp Messaging API Endpoints
 */

// Validation schemas
const sendMessageSchema = z.object({
  to: z.string().min(1, 'Recipient phone number is required'),
  type: z.enum(['text', 'template', 'media']),
  content: z.any(), // Content depends on type
  forceImmediate: z.boolean().optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional()
});

const quickResponseSchema = z.object({
  to: z.string().min(1, 'Recipient phone number is required'),
  message: z.string().min(1, 'Message is required'),
  replyToMessageId: z.string().optional()
});

const bulkMessageSchema = z.object({
  recipients: z.array(z.string()).min(1, 'At least one recipient is required'),
  template: z.object({
    templateName: z.string().min(1, 'Template name is required'),
    languageCode: z.string().min(1, 'Language code is required'),
    parameters: z.array(z.object({
      type: z.enum(['text', 'currency', 'date_time']),
      text: z.string()
    })).optional()
  }),
  respectOptimization: z.boolean().optional(),
  maxCost: z.number().optional()
});

/**
 * POST - Send a single WhatsApp message
 */
export const POST = withAuth(async (request: NextRequest) => {
  const requestContext = createRequestContext('send_whatsapp_message', 'POST');
  
  try {
    const body = await request.json();
    
    // Check if this is a quick response
    if (body.messageType === 'quick_response') {
      return await handleQuickResponse(body, requestContext);
    }

    // Check if this is a bulk message
    if (body.messageType === 'bulk') {
      return await handleBulkMessage(body, requestContext);
    }

    // Validate single message request
    const validatedData = sendMessageSchema.safeParse(body);
    if (!validatedData.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data',
          details: validatedData.error.issues.map(issue => issue.message)
        },
        { status: 400 }
      );
    }

    // Send single message
    const result = await whatsappMessaging.sendMessage(validatedData.data);

    if (result.success) {
      logSecureInfo('WhatsApp message sent successfully', {
        ...requestContext,
        statusCode: 200
      }, {
        messageId: result.messageId,
        scheduled: result.scheduled,
        cost: result.cost
      });

      return NextResponse.json({
        success: true,
        messageId: result.messageId,
        scheduled: result.scheduled,
        scheduledTime: result.scheduledTime,
        optimization: result.optimization,
        cost: result.cost
      });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send message' },
        { status: 400 }
      );
    }
  } catch (error) {
    logSecureError('Failed to send WhatsApp message', {
      ...requestContext,
      statusCode: 500
    }, error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
});

/**
 * Handle quick response messages
 */
async function handleQuickResponse(body: any, requestContext: any) {
  const validatedData = quickResponseSchema.safeParse(body);
  if (!validatedData.success) {
    return NextResponse.json(
      { 
        error: 'Invalid quick response data',
        details: validatedData.error.issues.map(issue => issue.message)
      },
      { status: 400 }
    );
  }

  const { to, message, replyToMessageId } = validatedData.data;
  const result = await whatsappMessaging.sendQuickResponse(to, message);

  if (result.success) {
    logSecureInfo('WhatsApp quick response sent', {
      ...requestContext,
      statusCode: 200
    }, {
      messageId: result.messageId,
      cost: result.cost
    });

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      cost: result.cost
    });
  } else {
    return NextResponse.json(
      { error: result.error || 'Failed to send quick response' },
      { status: 400 }
    );
  }
}

/**
 * Handle bulk messages
 */
async function handleBulkMessage(body: any, requestContext: any) {
  const validatedData = bulkMessageSchema.safeParse(body);
  if (!validatedData.success) {
    return NextResponse.json(
      { 
        error: 'Invalid bulk message data',
        details: validatedData.error.issues.map(issue => issue.message)
      },
      { status: 400 }
    );
  }

  // Transform bulk message data to individual SendMessageOptions
  const messages: SendMessageOptions[] = validatedData.data.recipients.map(recipient => ({
    to: recipient,
    type: 'template' as const,
    content: validatedData.data.template
  }));

  const results = await whatsappMessaging.sendBulkMessages(messages);

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logSecureInfo('WhatsApp bulk messages processed', {
    ...requestContext,
    statusCode: 200
  }, {
    totalRecipients: results.length,
    successful,
    failed,
    results: results.map(r => ({ success: r.success, messageId: r.messageId, error: r.error }))
  });

  return NextResponse.json({
    success: true,
    summary: {
      totalRecipients: results.length,
      successful,
      failed,
      estimatedCost: 0 // Template messages don't have cost estimation in simplified implementation
    },
    results: results
  });
}