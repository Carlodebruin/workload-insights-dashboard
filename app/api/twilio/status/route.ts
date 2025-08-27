import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';

/**
 * Twilio Status Callback Endpoint
 * Handles message status updates from Twilio (delivered, read, failed, etc.)
 */

export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('twilio_status_callback', 'POST');
  
  try {
    console.log('📞 [STATUS] Twilio status callback received');
    logSecureInfo('Twilio status callback received', requestContext);

    // Get form data from Twilio status callback
    const formData = await request.formData();
    const statusData = {
      MessageSid: formData.get('MessageSid') as string,
      MessageStatus: formData.get('MessageStatus') as string,
      ErrorCode: formData.get('ErrorCode') as string || null,
      ErrorMessage: formData.get('ErrorMessage') as string || null,
      To: formData.get('To') as string,
      From: formData.get('From') as string,
      AccountSid: formData.get('AccountSid') as string,
      ApiVersion: formData.get('ApiVersion') as string,
    };

    console.log('📞 [STATUS] Status data:', {
      MessageSid: statusData.MessageSid,
      MessageStatus: statusData.MessageStatus,
      ErrorCode: statusData.ErrorCode,
      To: statusData.To?.substring(0, 10) + '...',
      From: statusData.From?.substring(0, 10) + '...'
    });

    logSecureInfo('Twilio status callback data', requestContext, {
      messageSid: statusData.MessageSid,
      status: statusData.MessageStatus,
      hasError: !!statusData.ErrorCode,
      errorCode: statusData.ErrorCode
    });

    // Update message status in database if we have this message
    if (statusData.MessageSid) {
      try {
        const updateResult = await prisma.whatsAppMessage.updateMany({
          where: { waId: statusData.MessageSid },
          data: { 
            status: statusData.MessageStatus as any,
            ...(statusData.ErrorCode && { 
              processingError: `${statusData.ErrorCode}: ${statusData.ErrorMessage}` 
            })
          }
        });

        if (updateResult.count > 0) {
          console.log('📞 [STATUS] Updated message status in database:', statusData.MessageSid);
          logSecureInfo('Message status updated in database', requestContext, {
            messageSid: statusData.MessageSid,
            newStatus: statusData.MessageStatus,
            updatedCount: updateResult.count
          });
        } else {
          console.log('📞 [STATUS] Message not found in database:', statusData.MessageSid);
        }
      } catch (dbError) {
        logSecureError('Failed to update message status', requestContext, 
          dbError instanceof Error ? dbError : undefined);
        console.log('📞 [STATUS] Database update failed:', dbError);
      }
    }

    // Always return 200 OK to Twilio to acknowledge receipt
    console.log('📞 [STATUS] Sending 200 OK response to Twilio');
    return NextResponse.json({
      success: true,
      message: 'Status callback received'
    });

  } catch (error) {
    logSecureError('Twilio status callback error', requestContext, 
      error instanceof Error ? error : undefined);
    
    console.log('📞 [STATUS] Error processing status callback:', error);
    
    // Still return 200 to prevent Twilio retries
    return NextResponse.json({
      success: false,
      error: 'Internal error processing status callback'
    });
  }
}

/**
 * GET - Status endpoint info (for debugging)
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Twilio Status Callback Endpoint',
    status: 'active',
    endpoint: '/api/twilio/status',
    purpose: 'Receives message status updates from Twilio',
    accepts: ['POST'],
    statusTypes: ['queued', 'sent', 'received', 'delivered', 'read', 'failed', 'undelivered']
  });
}