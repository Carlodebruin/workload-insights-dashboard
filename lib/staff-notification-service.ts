import { withDb } from './db-wrapper';
import { whatsappMessaging } from './whatsapp/messaging-service';
import { logSecureInfo, logSecureError, logSecureWarning, createRequestContext } from './secure-logger';

// Enhanced logging for backward compatibility
const logger = {
  info: (msg: string, ctx?: any) => {
    const context = ctx?.timestamp ? ctx : { ...ctx, timestamp: new Date().toISOString() };
    logSecureInfo(msg, { operation: ctx?.operation || 'legacy_notification', timestamp: new Date().toISOString() }, context);
  },
  warn: (msg: string, ctx?: any) => {
    const context = ctx?.timestamp ? ctx : { ...ctx, timestamp: new Date().toISOString() };
    logSecureWarning(msg, { operation: ctx?.operation || 'legacy_notification', timestamp: new Date().toISOString() }, context);
  },
  error: (msg: string, ctx?: any, err?: any) => {
    const context = ctx?.timestamp ? ctx : { ...ctx, timestamp: new Date().toISOString() };
    logSecureError(msg, { operation: ctx?.operation || 'legacy_notification', timestamp: new Date().toISOString() }, err, context);
  }
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
    });

    // Fetch activity details with related data
    const activity = await withDb(async (prisma) => {
      return prisma.activity.findUnique({
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
    });

    if (!activity) {
      const error = 'Activity not found';
      logger.error('Staff notification failed - activity not found', {
        operation: 'notify_staff_assignment',
        activityId,
        timestamp: new Date().toISOString()
      });
      return { success: false, error };
    }

    if (!activity.assignedTo) {
      const error = 'No assigned user found for activity';
      logger.error('Staff notification failed - no assigned user', {
        operation: 'notify_staff_assignment',
        activityId: activityId.substring(0, 8),
        timestamp: new Date().toISOString()
      });
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
      });
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
      });
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
    });

    // Send notification via WhatsApp messaging service
    const sendResult = await whatsappMessaging.sendMessage({
      to: cleanPhone,
      type: 'text',
      content: notificationMessage
    });

    if (sendResult.success) {
      logger.info('Staff assignment notification sent successfully', {
        operation: 'notify_staff_assignment',
        messageId: sendResult.messageId,
        staffName: activity.assignedTo.name,
        referenceNumber,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        messageId: sendResult.messageId
      };
    } else {
      logger.error('Failed to send staff assignment notification', {
        operation: 'notify_staff_assignment',
        error: 'Message send failed',
        staffName: activity.assignedTo.name,
        referenceNumber,
        timestamp: new Date().toISOString()
      });

      return {
        success: false,
        error: sendResult.error || 'Message send failed'
      };
    }

  } catch (error) {
    logger.error('Staff assignment notification error', {
      operation: 'notify_staff_assignment',
      activity_id: activityId?.substring(0, 8),
      assigned_user_id: assignedUserId?.substring(0, 8),
      timestamp: new Date().toISOString()
    }, error);

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * NEW: Send bidirectional update notifications
 * Notifies both the original reporter and assigned staff when activity is updated
 */
export async function notifyActivityUpdate(
  activityId: string,
  updateAuthorId: string,
  updateNotes: string,
  updateType: 'progress' | 'status_change' | 'assignment' | 'completion' = 'progress'
): Promise<{ reporterNotification?: NotificationResult; assigneeNotification?: NotificationResult; errors: string[] }> {
  const requestContext = createRequestContext('notify_activity_update', 'POST', updateAuthorId, activityId);
  const result = {
    reporterNotification: undefined as NotificationResult | undefined,
    assigneeNotification: undefined as NotificationResult | undefined,
    errors: [] as string[]
  };

  try {
    // Get activity with all related users
    const activity = await withDb(async (prisma) => {
      return prisma.activity.findUnique({
        where: { id: activityId },
        include: {
          category: { select: { name: true } },
          user: { select: { id: true, name: true, phone_number: true } }, // Original reporter
          assignedTo: { select: { id: true, name: true, phone_number: true } }, // Assigned staff
          updates: {
            where: { author_id: updateAuthorId },
            orderBy: { timestamp: 'desc' },
            take: 1,
            select: { author_id: true, notes: true, update_type: true }
          }
        }
      });
    });

    if (!activity) {
      result.errors.push('Activity not found');
      return result;
    }

    const referenceNumber = `${activity.category.name.substring(0, 4).toUpperCase()}-${activity.id.slice(-4)}`;
    const updateAuthor = activity.user.id === updateAuthorId ? activity.user : 
                        activity.assignedTo?.id === updateAuthorId ? activity.assignedTo : null;

    // Prepare update message
    const updateMessage = `📋 *Update: ${referenceNumber}*\n\n🏷️ **Task:** ${activity.subcategory}\n📍 **Location:** ${activity.location}\n👤 **Updated by:** ${updateAuthor?.name || 'System'}\n⏰ **Time:** ${new Date().toLocaleString()}\n\n💬 **Update:**\n${updateNotes}\n\n${updateType === 'completion' ? '✅ **Status:** Task completed' : '🔄 **Status:** In progress'}`;

    // Notify original reporter if update is from assigned staff
    if (activity.assignedTo && updateAuthorId === activity.assignedTo.id && 
        activity.user.phone_number && activity.user.id !== updateAuthorId) {
      
      const reporterMessage = `${updateMessage}\n\nThank you for your patience. We'll keep you updated on progress.`;
      
      try {
        const reporterResult = await whatsappMessaging.sendQuickResponse(
          activity.user.phone_number, 
          reporterMessage
        );
        result.reporterNotification = reporterResult;
        
        logSecureInfo('Reporter notified of activity update', requestContext, {
          reporterId: activity.user.id.substring(0, 8),
          updateType
        });
      } catch (error) {
        const errorMsg = `Failed to notify reporter: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logSecureError('Failed to notify reporter of update', requestContext, error instanceof Error ? error : undefined);
      }
    }

    // Notify assigned staff if update is from reporter  
    if (activity.assignedTo && updateAuthorId === activity.user.id && 
        activity.assignedTo.phone_number && activity.assignedTo.id !== updateAuthorId) {
      
      const assigneeMessage = `${updateMessage}\n\nThe reporter has provided additional information. Please review and update accordingly.`;
      
      try {
        const assigneeResult = await whatsappMessaging.sendQuickResponse(
          activity.assignedTo.phone_number,
          assigneeMessage
        );
        result.assigneeNotification = assigneeResult;
        
        logSecureInfo('Assigned staff notified of activity update', requestContext, {
          assigneeId: activity.assignedTo.id.substring(0, 8),
          updateType
        });
      } catch (error) {
        const errorMsg = `Failed to notify assigned staff: ${error instanceof Error ? error.message : 'Unknown error'}`;
        result.errors.push(errorMsg);
        logSecureError('Failed to notify assigned staff of update', requestContext, error instanceof Error ? error : undefined);
      }
    }

    return result;

  } catch (error) {
    const errorMsg = `Activity update notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logSecureError('Activity update notification failed', requestContext, error instanceof Error ? error : undefined);
    return result;
  }
}

/**
 * NEW: Send status change notifications to all relevant parties
 */
export async function notifyStatusChange(
  activityId: string,
  oldStatus: string,
  newStatus: string,
  changedBy: string,
  resolutionNotes?: string
): Promise<{ reporterNotification?: NotificationResult; assigneeNotification?: NotificationResult; errors: string[] }> {
  const requestContext = createRequestContext('notify_status_change', 'PUT', changedBy, activityId);
  const result = {
    reporterNotification: undefined as NotificationResult | undefined,
    assigneeNotification: undefined as NotificationResult | undefined,
    errors: [] as string[]
  };

  try {
    const activity = await withDb(async (prisma) => {
      return prisma.activity.findUnique({
        where: { id: activityId },
        include: {
          category: { select: { name: true } },
          user: { select: { id: true, name: true, phone_number: true } },
          assignedTo: { select: { id: true, name: true, phone_number: true } }
        }
      });
    });

    if (!activity) {
      result.errors.push('Activity not found');
      return result;
    }

    const referenceNumber = `${activity.category.name.substring(0, 4).toUpperCase()}-${activity.id.slice(-4)}`;
    
    let statusMessage = `📊 *Status Update: ${referenceNumber}*\n\n🏷️ **Task:** ${activity.subcategory}\n📍 **Location:** ${activity.location}\n📈 **Status:** ${oldStatus} → **${newStatus}**\n⏰ **Updated:** ${new Date().toLocaleString()}\n\n`;

    // Add context based on status change
    if (newStatus === 'Resolved') {
      statusMessage += '✅ **Task Completed!**\n';
      if (resolutionNotes) {
        statusMessage += `💡 **Resolution:** ${resolutionNotes}\n`;
      }
      statusMessage += '\nThank you for your patience. The issue has been resolved.';
    } else if (newStatus === 'In Progress') {
      statusMessage += '🔄 **Work Started**\n\nOur team is now working on this issue. You\'ll receive updates as progress is made.';
    } else if (newStatus === 'Open') {
      statusMessage += '📋 **Task Opened**\n\nThis issue has been logged and will be assigned to a team member soon.';
    }

    // Notify original reporter
    if (activity.user.phone_number && activity.user.id !== changedBy) {
      try {
        const reporterResult = await whatsappMessaging.sendQuickResponse(
          activity.user.phone_number,
          statusMessage
        );
        result.reporterNotification = reporterResult;
        
        logSecureInfo('Reporter notified of status change', requestContext, {
          reporterId: activity.user.id.substring(0, 8),
          oldStatus,
          newStatus
        });
      } catch (error) {
        result.errors.push(`Failed to notify reporter: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Notify assigned staff if different from person who changed status
    if (activity.assignedTo?.phone_number && activity.assignedTo.id !== changedBy) {
      try {
        const assigneeMessage = newStatus === 'Resolved' ? 
          `✅ **Task Marked Complete: ${referenceNumber}**\n\n🏷️ **Task:** ${activity.subcategory}\n📍 **Location:** ${activity.location}\n\n${resolutionNotes ? `💡 **Resolution:** ${resolutionNotes}\n\n` : ''}Great work completing this task!` :
          statusMessage;

        const assigneeResult = await whatsappMessaging.sendQuickResponse(
          activity.assignedTo.phone_number,
          assigneeMessage
        );
        result.assigneeNotification = assigneeResult;
        
        logSecureInfo('Assigned staff notified of status change', requestContext, {
          assigneeId: activity.assignedTo.id.substring(0, 8),
          oldStatus,
          newStatus
        });
      } catch (error) {
        result.errors.push(`Failed to notify assigned staff: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return result;

  } catch (error) {
    const errorMsg = `Status change notification failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    result.errors.push(errorMsg);
    logSecureError('Status change notification failed', requestContext, error instanceof Error ? error : undefined);
    return result;
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
  
  let message = `${priorityPrefix}🎯 *${customTitle}*\n\n📋 **Reference:** ${referenceNumber}\n🏷️ **Category:** ${activity.category?.name} - ${activity.subcategory}\n📍 **Location:** ${activity.location}\n👤 **Reported by:** ${activity.user?.name}\n📅 **Created:** ${new Date(activity.timestamp).toLocaleString()}`;

  // Add deadline info if present
  if (activity.deadline_date) {
    const deadline = new Date(activity.deadline_date);
    const isOverdue = activity.is_overdue;
    message += `\n⏰ **Deadline:** ${deadline.toLocaleString()}${isOverdue ? ' ⚠️ OVERDUE' : ''}`;
  }

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
    message += `\n\n🔧 **Next Steps:**\n• Reply with "Starting" to acknowledge\n• Reply with "Update: [message]" for progress updates\n• Reply with "Complete" when finished\n\n📞 Need help? Contact your supervisor or reply with any questions.`;
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
