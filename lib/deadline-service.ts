import { withDb } from './db-wrapper';
import { whatsappMessaging } from './whatsapp/messaging-service';
import { logSecureInfo, logSecureError, logSecureWarning, createRequestContext } from './secure-logger';

export interface DeadlineCheckResult {
  totalActivities: number;
  overdueCount: number;
  overdueActivities: string[];
  notificationsSent: number;
  errors: string[];
}

/**
 * Deadline Service
 * Handles deadline management, monitoring, and notifications for activities
 */
export class DeadlineService {
  private static instance: DeadlineService;

  private constructor() {}

  public static getInstance(): DeadlineService {
    if (!DeadlineService.instance) {
      DeadlineService.instance = new DeadlineService();
    }
    return DeadlineService.instance;
  }

  /**
   * Set deadline for an activity
   * @param activityId - Activity ID
   * @param deadlineDate - Deadline date (or null to set daily deadline)
   * @param deadlineType - Type: 'daily', 'custom', or 'none'
   */
  public async setDeadline(
    activityId: string,
    deadlineDate: Date | null = null,
    deadlineType: 'daily' | 'custom' | 'none' = 'daily'
  ): Promise<{ success: boolean; deadline?: Date; error?: string }> {
    const requestContext = createRequestContext('set_deadline', 'PUT', undefined, activityId);

    try {
      // If no deadline date provided and type is daily, set to end of today
      let finalDeadlineDate = deadlineDate;
      if (!deadlineDate && deadlineType === 'daily') {
        finalDeadlineDate = new Date();
        finalDeadlineDate.setHours(23, 59, 59, 999); // End of day
      }

      const updatedActivity = await withDb(async (prisma) => {
        return prisma.activity.update({
          where: { id: activityId },
          data: {
            deadline_date: finalDeadlineDate,
            deadline_type: deadlineType,
            is_overdue: false, // Reset overdue status when deadline is set
            overdue_notified: false // Reset notification status
          },
          select: { 
            id: true, 
            deadline_date: true, 
            deadline_type: true,
            subcategory: true,
            location: true
          }
        });
      });

      logSecureInfo('Deadline set for activity', requestContext, {
        deadlineDate: finalDeadlineDate?.toISOString(),
        deadlineType,
        subcategory: updatedActivity.subcategory
      });

      return {
        success: true,
        deadline: updatedActivity.deadline_date
      };
    } catch (error) {
      logSecureError('Failed to set deadline', requestContext, 
        error instanceof Error ? error : undefined);
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check for overdue activities and update status
   */
  public async checkOverdueActivities(): Promise<DeadlineCheckResult> {
    const requestContext = createRequestContext('check_overdue', 'GET');
    const result: DeadlineCheckResult = {
      totalActivities: 0,
      overdueCount: 0,
      overdueActivities: [],
      notificationsSent: 0,
      errors: []
    };

    try {
      const now = new Date();
      
      // Find activities with deadlines that are now overdue
      const overdueActivities = await withDb(async (prisma) => {
        return prisma.activity.findMany({
          where: {
            deadline_date: { lte: now },
            status: { not: 'Resolved' },
            is_overdue: false // Only get newly overdue items
          },
          include: {
            user: { select: { name: true, phone_number: true } },
            assignedTo: { select: { name: true, phone_number: true } },
            category: { select: { name: true } }
          }
        });
      });

      result.totalActivities = overdueActivities.length;
      result.overdueCount = overdueActivities.length;
      result.overdueActivities = overdueActivities.map(a => a.id);

      // Update overdue status for these activities
      if (overdueActivities.length > 0) {
        await withDb(async (prisma) => {
          return prisma.activity.updateMany({
            where: { id: { in: overdueActivities.map(a => a.id) } },
            data: { is_overdue: true }
          });
        });

        logSecureWarning(`Found ${overdueActivities.length} newly overdue activities`, requestContext, {
          overdueCount: overdueActivities.length
        });

        // Send notifications for overdue activities
        for (const activity of overdueActivities) {
          try {
            await this.sendOverdueNotification(activity);
            result.notificationsSent++;
          } catch (notificationError) {
            const errorMsg = notificationError instanceof Error ? 
              notificationError.message : 'Notification failed';
            result.errors.push(`${activity.id}: ${errorMsg}`);
            
            logSecureError('Failed to send overdue notification', requestContext, 
              notificationError instanceof Error ? notificationError : undefined);
          }
        }
      }

      logSecureInfo('Overdue check completed', requestContext, {
        totalOverdue: result.overdueCount,
        notificationsSent: result.notificationsSent,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logSecureError('Failed to check overdue activities', requestContext, 
        error instanceof Error ? error : undefined);
      
      result.errors.push(error instanceof Error ? error.message : 'Unknown error');
      return result;
    }
  }

  /**
   * Send overdue notification to relevant parties
   */
  private async sendOverdueNotification(activity: any): Promise<void> {
    const referenceNumber = `${activity.category.name.substring(0,4).toUpperCase()}-${activity.id.slice(-4)}`;
    
    const overdueMessage = `⚠️ *OVERDUE TASK ALERT*

📋 **Reference:** ${referenceNumber}
🏷️ **Task:** ${activity.category.name} - ${activity.subcategory}
📍 **Location:** ${activity.location}
⏰ **Deadline Passed:** ${activity.deadline_date?.toLocaleString()}

🚨 This task is now overdue and requires immediate attention.

${activity.assignedTo ? 
  `👤 **Assigned to:** ${activity.assignedTo.name}\n\nPlease complete this task as soon as possible.` :
  `⚡ **Status:** Unassigned\n\nThis task needs to be assigned immediately.`
}`;

    // Notify assigned staff member if exists
    if (activity.assignedTo?.phone_number) {
      await whatsappMessaging.sendQuickResponse(
        activity.assignedTo.phone_number, 
        overdueMessage
      );
    }

    // Also notify original reporter
    if (activity.user?.phone_number && activity.user.phone_number !== activity.assignedTo?.phone_number) {
      const reporterMessage = `⚠️ *Task Update: ${referenceNumber}*

Your reported task is now overdue:
🏷️ **Task:** ${activity.subcategory}
📍 **Location:** ${activity.location}

${activity.assignedTo ? 
  `👤 **Assigned to:** ${activity.assignedTo.name}` :
  `⚡ **Status:** Unassigned - escalating to management`
}

We're working to resolve this as soon as possible.`;

      await whatsappMessaging.sendQuickResponse(
        activity.user.phone_number,
        reporterMessage
      );
    }

    // Mark as notified
    await withDb(async (prisma) => {
      return prisma.activity.update({
        where: { id: activity.id },
        data: { overdue_notified: true }
      });
    });
  }

  /**
   * Get overdue activities for a specific user
   */
  public async getOverdueActivitiesForUser(userId: string): Promise<any[]> {
    const requestContext = createRequestContext('get_user_overdue', 'GET', userId);

    try {
      return await withDb(async (prisma) => {
        return prisma.activity.findMany({
          where: {
            assigned_to_user_id: userId,
            is_overdue: true,
            status: { not: 'Resolved' }
          },
          include: {
            category: { select: { name: true } },
            user: { select: { name: true } }
          },
          orderBy: { deadline_date: 'asc' }
        });
      });
    } catch (error) {
      logSecureError('Failed to get overdue activities for user', requestContext, 
        error instanceof Error ? error : undefined);
      return [];
    }
  }

  /**
   * Get deadline statistics
   */
  public async getDeadlineStats(): Promise<{
    totalWithDeadlines: number;
    overdue: number;
    dueSoon: number; // Due within 24 hours
    onTime: number;
  }> {
    try {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const stats = await withDb(async (prisma) => {
        const [totalWithDeadlines, overdue, dueSoon, onTime] = await Promise.all([
          // Total activities with deadlines
          prisma.activity.count({
            where: { 
              deadline_date: { not: null },
              status: { not: 'Resolved' }
            }
          }),
          
          // Overdue activities
          prisma.activity.count({
            where: { 
              is_overdue: true,
              status: { not: 'Resolved' }
            }
          }),
          
          // Due soon (within 24 hours)
          prisma.activity.count({
            where: { 
              deadline_date: { lte: tomorrow, gte: now },
              status: { not: 'Resolved' },
              is_overdue: false
            }
          }),
          
          // On time (future deadlines)
          prisma.activity.count({
            where: { 
              deadline_date: { gt: tomorrow },
              status: { not: 'Resolved' }
            }
          })
        ]);

        return { totalWithDeadlines, overdue, dueSoon, onTime };
      });

      return stats;
    } catch (error) {
      logSecureError('Failed to get deadline statistics', 
        createRequestContext('get_deadline_stats', 'GET'),
        error instanceof Error ? error : undefined);
      
      return { totalWithDeadlines: 0, overdue: 0, dueSoon: 0, onTime: 0 };
    }
  }

  /**
   * Auto-set daily deadlines for new activities based on category
   */
  public async autoSetDailyDeadline(activityId: string, categoryName: string): Promise<void> {
    // Define categories that should have daily deadlines
    const dailyCategories = ['Maintenance', 'Cleaning', 'Security', 'Safety'];
    
    if (dailyCategories.some(cat => categoryName.toLowerCase().includes(cat.toLowerCase()))) {
      await this.setDeadline(activityId, null, 'daily');
    }
  }
}

// Export singleton instance
export const deadlineService = DeadlineService.getInstance();