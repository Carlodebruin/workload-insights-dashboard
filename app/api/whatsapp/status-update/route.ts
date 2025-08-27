import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';
import { whatsappConfig } from '../../../../lib/whatsapp/config';

/**
 * Send WhatsApp status update notifications
 * Called when activity status changes to notify the original reporter
 */
export async function POST(request: NextRequest) {
  const requestContext = createRequestContext('whatsapp_status_update', 'POST');
  
  try {
    const { activityId, newStatus, notes, assignedToUserId } = await request.json();

    if (!activityId) {
      return NextResponse.json({ error: 'Activity ID is required' }, { status: 400 });
    }

    // Get activity details with user information
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            whatsappUsers: {
              select: {
                phoneNumber: true,
                displayName: true
              }
            }
          }
        },
        category: {
          select: { name: true }
        },
        assignedTo: {
          select: { name: true }
        }
      }
    });

    if (!activity) {
      return NextResponse.json({ error: 'Activity not found' }, { status: 404 });
    }

    // Find WhatsApp user associated with the activity reporter
    const whatsappUser = activity.user.whatsappUsers.find(wu => 
      wu.phoneNumber === activity.user.phone_number
    );

    if (!whatsappUser) {
      // No WhatsApp user found, skip notification
      logSecureInfo('No WhatsApp user found for activity status update', requestContext, {
        activityId,
        userId: activity.user.id,
        phoneNumber: activity.user.phone_number
      });
      return NextResponse.json({ 
        success: true, 
        message: 'No WhatsApp user associated with this activity' 
      });
    }

    // Generate reference number
    const referenceNumber = `${activity.category.name.substring(0,4).toUpperCase()}-${activity.id.slice(-4)}`;

    // Create status update message
    const statusEmoji = getStatusEmoji(newStatus);
    const statusMessage = createStatusUpdateMessage({
      referenceNumber,
      newStatus,
      statusEmoji,
      category: activity.category.name,
      subcategory: activity.subcategory,
      location: activity.location,
      assignedToName: activity.assignedTo?.name,
      notes,
      reporterName: activity.user.name
    });

    // Send WhatsApp message
    const result = await sendWhatsAppStatusMessage(
      whatsappUser.phoneNumber, 
      statusMessage, 
      requestContext
    );

    if (result.success) {
      // Store the status notification in the database
      await prisma.whatsAppMessage.create({
        data: {
          waId: result.messageId || `status_${Date.now()}`,
          from: process.env.WHATSAPP_PHONE_NUMBER_ID || 'system',
          to: whatsappUser.phoneNumber,
          type: 'text',
          content: JSON.stringify({ text: statusMessage }),
          timestamp: new Date(),
          direction: 'outbound',
          status: 'sent',
          isFreeMessage: false,
          processed: true,
          relatedActivityId: activityId
        }
      });

      logSecureInfo('WhatsApp status update sent successfully', requestContext, {
        activityId,
        phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber),
        newStatus,
        referenceNumber,
        messageId: result.messageId
      });

      return NextResponse.json({ 
        success: true, 
        messageId: result.messageId,
        phoneNumber: maskPhoneNumber(whatsappUser.phoneNumber)
      });

    } else {
      logSecureError('Failed to send WhatsApp status update', requestContext, 
        new Error(result.error || 'Unknown error'));
      
      return NextResponse.json({ 
        error: 'Failed to send status update',
        details: result.error 
      }, { status: 500 });
    }

  } catch (error) {
    logSecureError('WhatsApp status update API error', requestContext, 
      error instanceof Error ? error : undefined);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * Get emoji for activity status
 */
function getStatusEmoji(status: string): string {
  const statusEmojis: Record<string, string> = {
    'Unassigned': '📋',
    'Open': '🟢',
    'Assigned': '👤',
    'In Progress': '🔄',
    'On Hold': '⏸️',
    'Resolved': '✅',
    'Completed': '✅',
    'Cancelled': '❌'
  };
  
  return statusEmojis[status] || '📊';
}

/**
 * Create formatted status update message
 */
function createStatusUpdateMessage({
  referenceNumber,
  newStatus,
  statusEmoji,
  category,
  subcategory,
  location,
  assignedToName,
  notes,
  reporterName
}: {
  referenceNumber: string;
  newStatus: string;
  statusEmoji: string;
  category: string;
  subcategory: string;
  location: string;
  assignedToName?: string;
  notes?: string;
  reporterName: string;
}): string {
  let message = `${statusEmoji} *Status Update: ${referenceNumber}*

📋 **Task:** ${category} - ${subcategory}
📍 **Location:** ${location}
📊 **New Status:** ${newStatus}`;

  if (assignedToName) {
    message += `\n👤 **Assigned to:** ${assignedToName}`;
  }

  if (notes) {
    message += `\n\n📝 **Update Notes:**\n${notes}`;
  }

  // Add contextual next steps based on status
  if (newStatus === 'In Progress') {
    message += `\n\n💪 **Good News!** Work has started on your report.`;
  } else if (newStatus === 'Resolved' || newStatus === 'Completed') {
    message += `\n\n🎉 **Great News!** Your reported issue has been resolved!`;
  } else if (newStatus === 'On Hold') {
    message += `\n\n⏳ **Note:** Work is temporarily paused. You'll be notified when it resumes.`;
  } else if (newStatus === 'Assigned') {
    message += `\n\n👍 **Update:** A team member has been assigned to handle this.`;
  }

  message += `\n\nReply /status ${referenceNumber} for full details.`;
  
  return message;
}

/**
 * Send WhatsApp message (simplified version for status updates)
 */
async function sendWhatsAppStatusMessage(
  phoneNumber: string,
  message: string,
  requestContext: any
): Promise<{ success: boolean; messageId?: string; error?: string }> {
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
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const messageId = result.messages[0]?.id || 'unknown';

    return { success: true, messageId };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: errorMessage };
  }
}

/**
 * Mask phone number for logging
 */
function maskPhoneNumber(phoneNumber: string): string {
  if (phoneNumber.length < 4) return '****';
  return phoneNumber.slice(0, -4).replace(/./g, '*') + phoneNumber.slice(-4);
}