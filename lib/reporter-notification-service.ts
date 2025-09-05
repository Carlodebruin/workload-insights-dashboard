import { withDb } from './db-wrapper';
import { whatsappMessaging } from './whatsapp/messaging-service';
import { logSecureInfo, logSecureError, createRequestContext } from './secure-logger';
import { isValidPhoneNumber, formatPhoneNumber } from './staff-notification-service';
interface ActivityWithRelations {
  id: string;
  user_id: string;
  category_id: string;
  subcategory: string;
  location: string;
  timestamp: Date;
  notes?: string | null;
  photo_url?: string | null;
  status: string;
  assigned_to_user_id?: string | null;
  category?: { name: string };
  user?: { id: string; name: string; phone_number: string; role: string };
  assignedTo?: { id: string; name: string; role: string } | null;
}

export interface ReporterNotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  reporterInfo?: {
    name: string;
    phoneNumber: string;
    isLinkedUser: boolean;
  };
}

export interface ReporterNotificationOptions {
  includeAssignmentDetails?: boolean;
  includeEstimatedTime?: boolean;
  customMessage?: string;
  priority?: 'normal' | 'urgent';
}

/**
 * Get activity with reporter information
 */
async function getActivityWithReporter(activityId: string): Promise<ActivityWithRelations | null> {
  return withDb(async (prisma) => {
    return prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        category: { select: { name: true } },
        user: {
          select: {
            id: true,
            name: true,
            phone_number: true,
            role: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        // assignments: { // Removed for now to avoid type issues
        //   include: {
        //     assignedUser: {
        //       select: {
        //         id: true,
        //         name: true,
        //         role: true
        //       }
        //     }
        //   }
        // }
      }
    });
  });
}

/**
 * Get reporter's WhatsApp contact number
 */
function getReporterWhatsAppNumber(activity: ActivityWithRelations | null): string | null {
  if (!activity?.user?.phone_number) {
    return null;
  }

  const phoneNumber = activity.user.phone_number;
  if (!isValidPhoneNumber(phoneNumber)) {
    return null;
  }

  return formatPhoneNumber(phoneNumber);
}

/**
 * Build reporter assignment notification message
 */
function buildReporterAssignmentMessage(
  activity: any,
  options: ReporterNotificationOptions = {}
): string {
  const priorityPrefix = options.priority === 'urgent' ? '🚨 URGENT: ' : '';
  const referenceNumber = `${activity.category?.name?.substring(0, 4).toUpperCase() || 'TASK'}-${activity.id.slice(-4)}`;
  
  let message = `${priorityPrefix}✅ *Your Task Has Been Assigned*\n\n`;
  message += `📋 **Reference:** ${referenceNumber}\n`;
  message += `🏷️ **Task:** ${activity.subcategory}\n`;
  message += `📍 **Location:** ${activity.location}\n`;
  message += `⏰ **Submitted:** ${new Date(activity.timestamp).toLocaleString()}\n\n`;

  // Add assignment details
  if (options.includeAssignmentDetails !== false && activity.assignments?.length > 0) {
    const primaryAssignment = activity.assignments.find((a: any) => a.assignment_type === 'primary');
    if (primaryAssignment) {
      message += `👤 **Assigned To:** ${primaryAssignment.assignedUser?.name || 'Team Member'}\n`;
      message += `🎯 **Role:** ${primaryAssignment.assignedUser?.role || 'Specialist'}\n\n`;
    }
  }

  // Add custom message or default
  if (options.customMessage) {
    message += `💬 **Message:** ${options.customMessage}\n\n`;
  } else {
    message += `🎯 **Status:** Your task has been assigned to our team and is now being worked on.\n\n`;
  }

  // Add estimated time if requested
  if (options.includeEstimatedTime) {
    message += `⏱️ **Estimated Completion:** Within 24-48 hours\n\n`;
  }

  // Add follow-up instructions
  message += `📞 **Need to Update?**\n`;
  message += `• Reply to this message with any additional details\n`;
  message += `• We'll keep you updated on progress\n`;
  message += `• Contact us if you have urgent questions\n\n`;
  message += `Thank you for your patience!`;

  return message;
}

/**
 * Notify reporter when their task is assigned
 */
export async function notifyReporterOfAssignment(
  activityId: string,
  assignedUserId: string,
  options: ReporterNotificationOptions = {}
): Promise<ReporterNotificationResult> {
  const requestContext = createRequestContext('notify_reporter_assignment', 'POST', assignedUserId, activityId);

  try {
    // Get activity with reporter information
    const activity = await getActivityWithReporter(activityId);
    if (!activity) {
      logSecureError('Reporter notification failed - activity not found', requestContext);
      return { success: false, error: 'Activity not found' };
    }

    // Get reporter's WhatsApp contact
    const reporterPhone = getReporterWhatsAppNumber(activity);
    if (!reporterPhone) {
      logSecureError('Reporter notification skipped - no valid WhatsApp number', requestContext, undefined, {
        reporterName: activity.user?.name,
        hasPhone: !!activity.user?.phone_number,
        phoneValid: isValidPhoneNumber(activity.user?.phone_number)
      });
      return { 
        success: false, 
        error: 'No valid WhatsApp contact for reporter',
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: activity.user?.phone_number || '',
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    // Build assignment notification message
    const message = buildReporterAssignmentMessage(activity, options);

    // Send via existing WhatsApp infrastructure
    const result = await whatsappMessaging.sendMessage({
      to: reporterPhone,
      type: 'text',
      content: message
    });

    if (result.success) {
      logSecureInfo('Reporter assignment notification sent successfully', requestContext, {
        reporterName: activity.user?.name,
        messageId: result.messageId,
        messageLength: message.length
      });

      return { 
        success: true, 
        messageId: result.messageId,
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: reporterPhone,
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    logSecureError('Reporter assignment notification failed - message send error', requestContext, undefined, {
      reporterName: activity.user?.name,
      error: result.error
    });

    return { 
      success: false, 
      error: result.error || 'Message send failed',
      reporterInfo: {
        name: activity.user?.name || 'Unknown',
        phoneNumber: reporterPhone,
        isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
      }
    };

  } catch (error) {
    logSecureError('Reporter assignment notification failed', requestContext, error instanceof Error ? error : undefined);
    
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Notify reporter when their task is completed
 */
export async function notifyReporterOfCompletion(
  activityId: string,
  completedByUserId: string,
  resolutionNotes?: string
): Promise<ReporterNotificationResult> {
  const requestContext = createRequestContext('notify_reporter_completion', 'POST', completedByUserId, activityId);

  try {
    const activity = await getActivityWithReporter(activityId);
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    const reporterPhone = getReporterWhatsAppNumber(activity);
    if (!reporterPhone) {
      return { 
        success: false, 
        error: 'No WhatsApp contact for reporter',
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: activity.user?.phone_number || '',
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    const referenceNumber = `${activity.category?.name?.substring(0, 4).toUpperCase() || 'TASK'}-${activity.id.slice(-4)}`;
    
    let message = `✅ *Task Completed: ${referenceNumber}*\n\n`;
    message += `🏷️ **Task:** ${activity.subcategory}\n`;
    message += `📍 **Location:** ${activity.location}\n`;
    message += `⏰ **Completed:** ${new Date().toLocaleString()}\n\n`;

    if (resolutionNotes) {
      message += `💡 **Resolution:** ${resolutionNotes}\n\n`;
    }

    message += `🎉 **Thank you!** Your issue has been resolved.\n\n`;
    message += `📞 Need further assistance? Reply to this message.`;

    const result = await whatsappMessaging.sendMessage({
      to: reporterPhone,
      type: 'text',
      content: message
    });

    if (result.success) {
      logSecureInfo('Reporter completion notification sent', requestContext, {
        reporterName: activity.user?.name,
        messageId: result.messageId
      });

      return { 
        success: true, 
        messageId: result.messageId,
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: reporterPhone,
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    return { 
      success: false, 
      error: result.error,
      reporterInfo: {
        name: activity.user?.name || 'Unknown',
        phoneNumber: reporterPhone,
        isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
      }
    };

  } catch (error) {
    logSecureError('Reporter completion notification failed', requestContext, error instanceof Error ? error : undefined);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Notify reporter of task status updates
 */
export async function notifyReporterOfStatusUpdate(
  activityId: string,
  updatedByUserId: string,
  updateNotes: string,
  status: string
): Promise<ReporterNotificationResult> {
  const requestContext = createRequestContext('notify_reporter_status_update', 'POST', updatedByUserId, activityId);

  try {
    const activity = await getActivityWithReporter(activityId);
    if (!activity) {
      return { success: false, error: 'Activity not found' };
    }

    const reporterPhone = getReporterWhatsAppNumber(activity);
    if (!reporterPhone) {
      return { 
        success: false, 
        error: 'No WhatsApp contact for reporter',
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: activity.user?.phone_number || '',
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    const referenceNumber = `${activity.category?.name?.substring(0, 4).toUpperCase() || 'TASK'}-${activity.id.slice(-4)}`;
    
    let message = `📋 *Task Update: ${referenceNumber}*\n\n`;
    message += `🏷️ **Task:** ${activity.subcategory}\n`;
    message += `📍 **Location:** ${activity.location}\n`;
    message += `📊 **Status:** ${status}\n`;
    message += `⏰ **Updated:** ${new Date().toLocaleString()}\n\n`;
    message += `💬 **Update:** ${updateNotes}\n\n`;
    message += `We'll keep you informed of further progress.`;

    const result = await whatsappMessaging.sendMessage({
      to: reporterPhone,
      type: 'text',
      content: message
    });

    if (result.success) {
      logSecureInfo('Reporter status update notification sent', requestContext, {
        reporterName: activity.user?.name,
        status,
        messageId: result.messageId
      });

      return { 
        success: true, 
        messageId: result.messageId,
        reporterInfo: {
          name: activity.user?.name || 'Unknown',
          phoneNumber: reporterPhone,
          isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
        }
      };
    }

    return { 
      success: false, 
      error: result.error,
      reporterInfo: {
        name: activity.user?.name || 'Unknown',
        phoneNumber: reporterPhone,
        isLinkedUser: false // WhatsApp verification handled through WhatsAppUser model
      }
    };

  } catch (error) {
    logSecureError('Reporter status update notification failed', requestContext, error instanceof Error ? error : undefined);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Helper function for secure logging with warning level
function logSecureWarning(message: string, context: any, additionalData?: any) {
  logSecureError(message, context, undefined, additionalData);
}