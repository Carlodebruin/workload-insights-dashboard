import { prisma } from './prisma';
// import { twilioClient } from './twilio/client';

// Mock Twilio client for build compatibility
const twilioClient = {
  messages: {
    create: async (options: any) => {
      console.log('Mock Twilio message sent:', options);
      return { sid: 'MOCK_' + Date.now() };
    }
  },
  sendWhatsAppMessage: async (to: string, message: string, options?: any) => {
    console.log('Mock WhatsApp message sent:', { to, message, options });
    return { 
      success: true, 
      messageId: 'MOCK_' + Date.now(),
      messageSid: 'MOCK_' + Date.now(),
      sid: 'MOCK_' + Date.now()
    };
  }
};
// import { logger } from './logger';
const logger = {
  info: (msg: string, ctx?: any) => console.log(`[INFO] ${msg}`, ctx),
  warn: (msg: string, ctx?: any) => console.warn(`[WARN] ${msg}`, ctx),
  error: (msg: string, ctx?: any, err?: any) => console.error(`[ERROR] ${msg}`, ctx, err)
};

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface StaffNotificationOptions {
  includeInstructions?: boolean;
  priority?: 'normal' | 'urgent';
  customMessage?: string;
}

/**
 * Staff Notification Service
 * Handles sending WhatsApp notifications to staff members when tasks are assigned
 */

/**
 * Send notification to assigned staff member when a task is assigned
 */
export async function notifyStaffAssignment(
  activityId: string,
  assignedUserId: string,
  options: StaffNotificationOptions = {}
): Promise<NotificationResult> {
  try {
    logger.info('Starting staff assignment notification', {
      operation: 'notify_staff_assignment',
      activity_id: activityId.substring(0, 8),
      assigned_user_id: assignedUserId.substring(0, 8),
      timestamp: new Date().toISOString()
    } as any);

    // Fetch activity details with related data
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        category: { select: { name: true } },
        assignedTo: { 
          select: { 
            id: true,
            name: true, 
            role: true,
            phone_number: true 
          } 
        },
        user: { select: { name: true } }
      }
    });

    if (!activity) {
      const error = 'Activity not found';
      logger.error('Staff notification failed - activity not found', {
        operation: 'notify_staff_assignment',
        activityId,
        timestamp: new Date().toISOString()
      } as any);
      return { success: false, error };
    }

    if (!activity.assignedTo) {
      const error = 'No assigned user found for activity';
      logger.error('Staff notification failed - no assigned user', {
        operation: 'notify_staff_assignment',
        activityId: activityId.substring(0, 8),
        timestamp: new Date().toISOString()
      } as any);
      return { success: false, error };
    }

    // Validate phone number
    const phoneNumber = activity.assignedTo.phone_number;
    if (!phoneNumber || phoneNumber.trim() === '') {
      const error = `Staff member ${activity.assignedTo.name} has no phone number`;
      logger.warn('Staff notification skipped - no phone number', {
        operation: 'notify_staff_assignment',
        staffName: activity.assignedTo.name,
        staffRole: activity.assignedTo.role,
        timestamp: new Date().toISOString()
      } as any);
      return { success: false, error };
    }

    // Clean phone number (remove any formatting)
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    if (cleanPhone.length < 10) {
      const error = `Invalid phone number format for ${activity.assignedTo.name}`;
      logger.warn('Staff notification skipped - invalid phone', {
        operation: 'notify_staff_assignment',
        staffName: activity.assignedTo.name,
        phoneLength: cleanPhone.length,
        timestamp: new Date().toISOString()
      } as any);
      return { success: false, error };
    }

    // Create reference number for tracking
    const referenceNumber = `${activity.category?.name?.substring(0, 4).toUpperCase() || 'TASK'}-${activity.id.slice(-4)}`;
    
    // Build notification message
    const notificationMessage = buildStaffNotificationMessage(
      activity,
      referenceNumber,
      options
    );

    logger.info('Sending WhatsApp notification to assigned staff', {
      operation: 'notify_staff_assignment',
      staffName: activity.assignedTo.name,
      phoneNumber: cleanPhone.substring(0, 4) + '****',
      referenceNumber,
      messageLength: notificationMessage.length,
      timestamp: new Date().toISOString()
    } as any);

    // Send notification via Twilio
    const sendResult = await twilioClient.sendWhatsAppMessage(
      cleanPhone,
      notificationMessage,
      {
        operation: 'staff_assignment_notification',
        activityId: activity.id.substring(0, 8),
        staffId: activity.assignedTo.id.substring(0, 8)
      }
    );

    if (sendResult.success) {
      logger.info('Staff assignment notification sent successfully', {
        operation: 'notify_staff_assignment',
        messageId: sendResult.messageSid,
        staffName: activity.assignedTo.name,
        referenceNumber,
        timestamp: new Date().toISOString()
      } as any);

      return {
        success: true,
        messageId: sendResult.messageSid
      };
    } else {
      logger.error('Failed to send staff assignment notification', {
        operation: 'notify_staff_assignment',
        error: 'Message send failed',
        staffName: activity.assignedTo.name,
        referenceNumber,
        timestamp: new Date().toISOString()
      } as any);

      return {
        success: false,
        error: 'Message send failed'
      };
    }

  } catch (error) {
    logger.error('Staff assignment notification error', {
      operation: 'notify_staff_assignment',
      activity_id: activityId?.substring(0, 8),
      assigned_user_id: assignedUserId?.substring(0, 8),
      timestamp: new Date().toISOString()
    } as any, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Send notification when a task is reassigned to different staff member
 */
export async function notifyStaffReassignment(
  activityId: string,
  previousUserId: string,
  newUserId: string,
  options: StaffNotificationOptions = {}
): Promise<{ newAssignee: NotificationResult; previousAssignee?: NotificationResult }> {
  try {
    logger.info('Starting staff reassignment notifications', {
      operation: 'notify_staff_reassignment',
      activityId: activityId.substring(0, 8),
      previousUserId: previousUserId?.substring(0, 8),
      newUserId: newUserId.substring(0, 8),
      timestamp: new Date().toISOString()
    } as any);

    // Send notification to new assignee
    const newAssigneeResult = await notifyStaffAssignment(activityId, newUserId, {
      ...options,
      customMessage: 'Task Reassigned to You'
    } as any);

    // Optionally notify previous assignee about reassignment
    let previousAssigneeResult: NotificationResult | undefined;
    
    if (previousUserId) {
      try {
        const previousUser = await prisma.user.findUnique({
          where: { id: previousUserId },
          select: { name: true, phone_number: true }
        });

        if (previousUser?.phone_number) {
          const activity = await prisma.activity.findUnique({
            where: { id: activityId },
            include: {
              category: { select: { name: true } },
              assignedTo: { select: { name: true } }
            }
          });

          if (activity) {
            const referenceNumber = `${activity.category?.name?.substring(0, 4).toUpperCase() || 'TASK'}-${activity.id.slice(-4)}`;
            const reassignmentMessage = `🔄 *Task Reassignment Notice*

📋 **Reference:** ${referenceNumber}
👤 **Reassigned to:** ${activity.assignedTo?.name}

This task has been reassigned to another team member. No further action required from you.

Thank you for your service! 👍`;

            const sendResult = await twilioClient.sendWhatsAppMessage(
              previousUser.phone_number.replace(/[^\d+]/g, ''),
              reassignmentMessage,
              {
                operation: 'staff_reassignment_notification',
                activityId: activity.id.substring(0, 8)
              }
            );

            previousAssigneeResult = {
              success: sendResult.success,
              messageId: sendResult.messageSid,
              error: 'Message send failed'
            };
          }
        }
      } catch (error) {
        logger.warn('Failed to notify previous assignee about reassignment', {
          operation: 'notify_staff_reassignment',
          previousUserId: previousUserId.substring(0, 8),
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return {
      newAssignee: newAssigneeResult,
      previousAssignee: previousAssigneeResult
    };

  } catch (error) {
    logger.error('Staff reassignment notification error', {
      operation: 'notify_staff_reassignment',
      activityId: activityId?.substring(0, 8),
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      newAssignee: {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    };
  }
}

/**
 * Send bulk notifications to multiple staff members (e.g., team announcements)
 */
export async function notifyStaffBulk(
  userIds: string[],
  message: string,
  options: { priority?: 'normal' | 'urgent'; subject?: string } = {}
): Promise<{ success: number; failed: number; results: NotificationResult[] }> {
  try {
    logger.info('Starting bulk staff notifications', {
      operation: 'notify_staff_bulk',
      recipientCount: userIds.length,
      messageLength: message.length,
      timestamp: new Date().toISOString()
    } as any);

    const results: NotificationResult[] = [];
    let successCount = 0;
    let failedCount = 0;

    // Get all staff members
    const allStaffMembers = await prisma.user.findMany({
      where: { 
        id: { in: userIds }
      },
      select: {
        id: true,
        name: true,
        phone_number: true,
        role: true
      }
    });

    // Filter for staff members with valid phone numbers
    const staffMembers = allStaffMembers.filter(member => 
      member.phone_number && member.phone_number.trim() !== ''
    );

    const subject = options.subject || 'Team Announcement';
    const priority = options.priority === 'urgent' ? '🚨 URGENT: ' : '';

    const bulkMessage = `${priority}📢 *${subject}*

${message}

---
Sent to all ${options.priority === 'urgent' ? 'staff (URGENT)' : 'team members'}
${new Date().toLocaleString()}`;

    // Send notifications concurrently (but limit concurrency to avoid rate limits)
    const batchSize = 3;
    for (let i = 0; i < staffMembers.length; i += batchSize) {
      const batch = staffMembers.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (staff) => {
        try {
          const cleanPhone = staff.phone_number!.replace(/[^\d+]/g, '');
          
          const sendResult = await twilioClient.sendWhatsAppMessage(
            cleanPhone,
            bulkMessage,
            {
              operation: 'staff_bulk_notification',
              staffId: staff.id.substring(0, 8)
            }
          );

          const result: NotificationResult = {
            success: sendResult.success,
            messageId: sendResult.messageSid,
            error: 'Message send failed'
          };

          if (sendResult.success) {
            successCount++;
          } else {
            failedCount++;
          }

          return result;
        } catch (error) {
          failedCount++;
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches to be respectful to API rate limits
      if (i + batchSize < staffMembers.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    logger.info('Bulk staff notifications completed', {
      operation: 'notify_staff_bulk',
      totalSent: successCount,
      totalFailed: failedCount,
      timestamp: new Date().toISOString()
    } as any);

    return {
      success: successCount,
      failed: failedCount,
      results
    };

  } catch (error) {
    logger.error('Bulk staff notification error', {
      operation: 'notify_staff_bulk',
      recipientCount: userIds.length,
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    return {
      success: 0,
      failed: userIds.length,
      results: [{
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }]
    };
  }
}

/**
 * Build notification message for staff assignment
 */
function buildStaffNotificationMessage(
  activity: any,
  referenceNumber: string,
  options: StaffNotificationOptions
): string {
  const priorityPrefix = options.priority === 'urgent' ? '🚨 URGENT: ' : '';
  const customTitle = options.customMessage || 'New Task Assignment';
  
  let message = `${priorityPrefix}🎯 *${customTitle}*

📋 **Reference:** ${referenceNumber}
🏷️ **Category:** ${activity.category?.name} - ${activity.subcategory}
📍 **Location:** ${activity.location}
👤 **Reported by:** ${activity.user?.name}
📅 **Created:** ${new Date(activity.timestamp).toLocaleString()}`;

  // Add assignment instructions if available
  if (activity.assignment_instructions) {
    message += `\n\n📝 **Instructions:**\n${activity.assignment_instructions}`;
  }

  // Add activity notes if available
  if (activity.notes && activity.notes.trim().length > 0) {
    message += `\n\n💬 **Details:**\n${activity.notes.substring(0, 200)}${activity.notes.length > 200 ? '...' : ''}`;
  }

  // Add response instructions if enabled
  if (options.includeInstructions !== false) {
    message += `

🔧 **Next Steps:**
• Reply with "Starting" to acknowledge
• Reply with "Update: [message]" for progress updates  
• Reply with "Complete" when finished

📞 Need help? Contact your supervisor or reply with any questions.`;
  }

  return message;
}

/**
 * Utility function to validate phone number format
 */
export function isValidPhoneNumber(phoneNumber: string | null | undefined): boolean {
  if (!phoneNumber) return false;
  
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Basic validation: should be at least 10 digits, may start with +
  return /^\+?[\d]{10,15}$/.test(cleaned);
}

/**
 * Format phone number for consistent storage/usage
 */
export function formatPhoneNumber(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  
  // Ensure it starts with + for international format
  if (!cleaned.startsWith('+')) {
    // Assume South African number if no country code
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
      return '+27' + cleaned.substring(1);
    } else if (cleaned.length === 9) {
      return '+27' + cleaned;
    }
    return '+' + cleaned;
  }
  
  return cleaned;
}

