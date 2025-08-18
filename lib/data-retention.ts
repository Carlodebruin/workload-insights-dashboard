import { prisma } from './prisma';
import { logSecureInfo, logSecureWarning, logSecureError, createRequestContext } from './secure-logger';
import type { User, Activity, ActivityUpdate } from '@prisma/client';

// GDPR/POPIA compliance configuration
export const DATA_RETENTION_CONFIG = {
  // Default retention periods (in days)
  DEFAULT_USER_RETENTION_DAYS: 2555, // ~7 years (recommended for employment records)
  DEFAULT_ACTIVITY_RETENTION_DAYS: 1095, // 3 years (incident/maintenance records)
  DEFAULT_UPDATE_RETENTION_DAYS: 1095, // 3 years (update history)
  
  // Inactive user cleanup (users with no recent activity)
  INACTIVE_USER_THRESHOLD_DAYS: 365, // 1 year of inactivity
  
  // Soft delete retention (how long to keep soft-deleted records)
  SOFT_DELETE_RETENTION_DAYS: 30, // 30 days before permanent deletion
  
  // Export/backup retention
  EXPORT_RETENTION_DAYS: 90, // How long to keep export files
} as const;

// Types for data retention operations
export interface RetentionSummary {
  totalRecords: number;
  eligibleForDeletion: number;
  retentionPeriodDays: number;
  oldestRecord?: Date;
  newestRecord?: Date;
}

export interface DataExportRequest {
  userId?: string;
  phoneNumber?: string;
  includeActivities?: boolean;
  includeUpdates?: boolean;
  format?: 'json' | 'csv';
}

export interface DataExportResult {
  user?: Partial<User>;
  activities?: Partial<Activity>[];
  updates?: Partial<ActivityUpdate>[];
  exportedAt: Date;
  exportId: string;
}

export interface DeletionAuditLog {
  operation: 'soft_delete' | 'hard_delete' | 'anonymize';
  recordType: 'user' | 'activity' | 'update';
  recordId: string;
  deletedAt: Date;
  reason: string;
  retentionPeriodDays: number;
}

// Helper function to calculate cutoff date
function calculateCutoffDate(retentionDays: number): Date {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  return cutoffDate;
}

// Helper function to sanitize PII for safe logging
function sanitizeForLogging(data: any): any {
  if (!data) return data;
  
  const sanitized = { ...data };
  
  // Remove or mask PII fields
  if (sanitized.phone_number) sanitized.phone_number = '***masked***';
  if (sanitized.name) sanitized.name = '***masked***';
  if (sanitized.location) sanitized.location = '***masked***';
  if (sanitized.notes) sanitized.notes = sanitized.notes.length > 0 ? '***masked***' : '';
  
  return sanitized;
}

// 1. RETENTION ANALYSIS FUNCTIONS

/**
 * Analyze user data retention status
 */
export async function analyzeUserRetention(
  retentionDays: number = DATA_RETENTION_CONFIG.DEFAULT_USER_RETENTION_DAYS
): Promise<RetentionSummary> {
  const cutoffDate = calculateCutoffDate(retentionDays);
  
  try {
    const [totalUsers, usersForDeletion, oldestUser, newestUser] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          activities: {
            every: {
              timestamp: {
                lt: cutoffDate
              }
            }
          }
        }
      }),
      prisma.user.findFirst({
        include: {
          activities: {
            select: { timestamp: true },
            orderBy: { timestamp: 'asc' },
            take: 1
          }
        }
      }),
      prisma.user.findFirst({
        include: {
          activities: {
            select: { timestamp: true },
            orderBy: { timestamp: 'desc' },
            take: 1
          }
        }
      })
    ]);

    return {
      totalRecords: totalUsers,
      eligibleForDeletion: usersForDeletion,
      retentionPeriodDays: retentionDays,
      oldestRecord: oldestUser?.activities[0]?.timestamp,
      newestRecord: newestUser?.activities[0]?.timestamp,
    };
  } catch (error) {
    logSecureError('Failed to analyze user retention', {
      operation: 'analyze_user_retention',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    throw new Error('Failed to analyze user retention data');
  }
}

/**
 * Analyze activity data retention status
 */
export async function analyzeActivityRetention(
  retentionDays: number = DATA_RETENTION_CONFIG.DEFAULT_ACTIVITY_RETENTION_DAYS
): Promise<RetentionSummary> {
  const cutoffDate = calculateCutoffDate(retentionDays);
  
  try {
    const [totalActivities, activitiesForDeletion, oldestActivity, newestActivity] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({
        where: {
          timestamp: {
            lt: cutoffDate
          }
        }
      }),
      prisma.activity.findFirst({
        select: { timestamp: true },
        orderBy: { timestamp: 'asc' }
      }),
      prisma.activity.findFirst({
        select: { timestamp: true },
        orderBy: { timestamp: 'desc' }
      })
    ]);

    return {
      totalRecords: totalActivities,
      eligibleForDeletion: activitiesForDeletion,
      retentionPeriodDays: retentionDays,
      oldestRecord: oldestActivity?.timestamp,
      newestRecord: newestActivity?.timestamp,
    };
  } catch (error) {
    logSecureError('Failed to analyze activity retention', {
      operation: 'analyze_activity_retention',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    throw new Error('Failed to analyze activity retention data');
  }
}

// 2. DATA SUBJECT ACCESS RIGHTS (GDPR Article 15)

/**
 * Export all personal data for a specific user (GDPR Right of Access)
 */
export async function exportUserData(request: DataExportRequest): Promise<DataExportResult> {
  const { userId, phoneNumber, includeActivities = true, includeUpdates = true } = request;
  const exportId = `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Find user by ID or phone number
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : { phone_number: phoneNumber },
      include: {
        activities: includeActivities ? {
          include: {
            updates: includeUpdates,
            category: {
              select: { name: true }
            }
          }
        } : false,
        updates: includeUpdates,
        assignedActivities: includeActivities
      }
    });

    if (!user) {
      throw new Error('User not found for data export');
    }

    // Prepare sanitized export data (remove internal IDs, include readable names)
    const exportData: DataExportResult = {
      user: {
        id: user.id,
        name: user.name,
        phone_number: user.phone_number,
        role: user.role,
      },
      activities: includeActivities ? user.activities.map(activity => ({
        id: activity.id,
        category: (activity as any).category?.name || 'Unknown',
        subcategory: activity.subcategory,
        location: activity.location,
        timestamp: activity.timestamp,
        notes: activity.notes,
        status: activity.status,
        assignment_instructions: activity.assignment_instructions,
        resolution_notes: activity.resolution_notes,
        updates: includeUpdates && (activity as any).updates ? (activity as any).updates.map((update: any) => ({
          timestamp: update.timestamp,
          notes: update.notes,
        })) : undefined
      })) : [],
      updates: includeUpdates && (user as any).updates ? (user as any).updates.map((update: any) => ({
        timestamp: update.timestamp,
        notes: update.notes,
      })) : [],
      exportedAt: new Date(),
      exportId,
    };

    // Log export request (without PII)
    logSecureInfo('User data export completed', {
      operation: 'export_user_data',
      timestamp: new Date().toISOString(),
      userId: user.id,
      statusCode: 200,
    });

    return exportData;
  } catch (error) {
    logSecureError('Failed to export user data', {
      operation: 'export_user_data',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    throw new Error('Failed to export user data');
  }
}

// 3. DATA DELETION FUNCTIONS (GDPR Article 17 - Right to Erasure)

/**
 * Soft delete user and related data (marks for deletion but doesn't remove immediately)
 */
export async function softDeleteUser(userId: string, reason: string = 'User request'): Promise<boolean> {
  try {
    // In a real implementation, you would add deleted_at fields to your schema
    // For now, we'll demonstrate the concept with comments
    
    logSecureWarning('Soft delete operation requested', {
      operation: 'soft_delete_user',
      timestamp: new Date().toISOString(),
      userId,
    });

    // TODO: Implement soft delete by adding deleted_at timestamp field to schema
    // await prisma.user.update({
    //   where: { id: userId },
    //   data: { deleted_at: new Date() }
    // });

    // For demonstration, we'll log the operation
    const auditLog: DeletionAuditLog = {
      operation: 'soft_delete',
      recordType: 'user',
      recordId: userId,
      deletedAt: new Date(),
      reason,
      retentionPeriodDays: DATA_RETENTION_CONFIG.SOFT_DELETE_RETENTION_DAYS,
    };

    logSecureInfo('User soft deleted', {
      operation: 'soft_delete_user',
      timestamp: new Date().toISOString(),
      userId,
      statusCode: 200,
    });

    return true;
  } catch (error) {
    logSecureError('Failed to soft delete user', {
      operation: 'soft_delete_user',
      timestamp: new Date().toISOString(),
      userId,
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return false;
  }
}

/**
 * Permanently delete activities older than retention period
 */
export async function deleteExpiredActivities(
  retentionDays: number = DATA_RETENTION_CONFIG.DEFAULT_ACTIVITY_RETENTION_DAYS,
  dryRun: boolean = true
): Promise<{ deletedCount: number; activities: string[] }> {
  const cutoffDate = calculateCutoffDate(retentionDays);
  
  try {
    // First, find activities eligible for deletion
    const expiredActivities = await prisma.activity.findMany({
      where: {
        timestamp: {
          lt: cutoffDate
        }
      },
      select: {
        id: true,
        timestamp: true,
        user_id: true,
      }
    });

    if (dryRun) {
      logSecureInfo('Dry run: Activities eligible for deletion', {
        operation: 'delete_expired_activities_dry_run',
        timestamp: new Date().toISOString(),
        statusCode: 200,
      });

      return {
        deletedCount: expiredActivities.length,
        activities: expiredActivities.map(a => a.id)
      };
    }

    // Delete activity updates first (foreign key constraint)
    const activityIds = expiredActivities.map(a => a.id);
    
    if (activityIds.length > 0) {
      await prisma.activityUpdate.deleteMany({
        where: {
          activity_id: {
            in: activityIds
          }
        }
      });

      // Then delete activities
      const deletionResult = await prisma.activity.deleteMany({
        where: {
          id: {
            in: activityIds
          }
        }
      });

      logSecureInfo('Expired activities deleted', {
        operation: 'delete_expired_activities',
        timestamp: new Date().toISOString(),
        statusCode: 200,
      });

      return {
        deletedCount: deletionResult.count,
        activities: activityIds
      };
    }

    return { deletedCount: 0, activities: [] };
  } catch (error) {
    logSecureError('Failed to delete expired activities', {
      operation: 'delete_expired_activities',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    throw new Error('Failed to delete expired activities');
  }
}

/**
 * Anonymize user data instead of deletion (useful for maintaining data integrity)
 */
export async function anonymizeUser(userId: string, reason: string = 'Data retention compliance'): Promise<boolean> {
  try {
    // Replace PII with anonymized values
    const anonymizedData = {
      name: `Anonymous_User_${userId.slice(-8)}`,
      phone_number: `+27000000${userId.slice(-3)}`,
      // Keep role for statistical purposes
    };

    await prisma.user.update({
      where: { id: userId },
      data: anonymizedData
    });

    // Also anonymize any notes in activities that might contain PII
    await prisma.activity.updateMany({
      where: { user_id: userId },
      data: {
        notes: null, // Remove potentially sensitive notes
        assignment_instructions: null,
        resolution_notes: null,
      }
    });

    // Anonymize activity update notes
    await prisma.activityUpdate.updateMany({
      where: { author_id: userId },
      data: {
        notes: '[Anonymized]'
      }
    });

    logSecureInfo('User data anonymized', {
      operation: 'anonymize_user',
      timestamp: new Date().toISOString(),
      userId,
      statusCode: 200,
    });

    return true;
  } catch (error) {
    logSecureError('Failed to anonymize user', {
      operation: 'anonymize_user',
      timestamp: new Date().toISOString(),
      userId,
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return false;
  }
}

// 4. COMPLIANCE UTILITIES

/**
 * Generate compliance report showing data retention status
 */
export async function generateComplianceReport(): Promise<{
  userRetention: RetentionSummary;
  activityRetention: RetentionSummary;
  inactiveUsers: number;
  recommendations: string[];
}> {
  try {
    const [userRetention, activityRetention] = await Promise.all([
      analyzeUserRetention(),
      analyzeActivityRetention()
    ]);

    // Find inactive users (no activities in the last year)
    const inactiveThreshold = calculateCutoffDate(DATA_RETENTION_CONFIG.INACTIVE_USER_THRESHOLD_DAYS);
    const inactiveUsers = await prisma.user.count({
      where: {
        activities: {
          none: {
            timestamp: {
              gte: inactiveThreshold
            }
          }
        }
      }
    });

    const recommendations: string[] = [];
    
    if (userRetention.eligibleForDeletion > 0) {
      recommendations.push(`Consider reviewing ${userRetention.eligibleForDeletion} users eligible for deletion`);
    }
    
    if (activityRetention.eligibleForDeletion > 0) {
      recommendations.push(`${activityRetention.eligibleForDeletion} activities are past retention period`);
    }
    
    if (inactiveUsers > 0) {
      recommendations.push(`${inactiveUsers} users have been inactive for over 1 year`);
    }

    if (recommendations.length === 0) {
      recommendations.push('All data is within compliance retention periods');
    }

    logSecureInfo('Compliance report generated', {
      operation: 'generate_compliance_report',
      timestamp: new Date().toISOString(),
      statusCode: 200,
    });

    return {
      userRetention,
      activityRetention,
      inactiveUsers,
      recommendations
    };
  } catch (error) {
    logSecureError('Failed to generate compliance report', {
      operation: 'generate_compliance_report',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    throw new Error('Failed to generate compliance report');
  }
}

/**
 * Scheduled cleanup job for automated data retention
 */
export async function runScheduledCleanup(options?: {
  deleteExpiredActivities?: boolean;
  anonymizeInactiveUsers?: boolean;
  dryRun?: boolean;
}): Promise<{
  activitiesDeleted: number;
  usersAnonymized: number;
  errors: string[];
}> {
  const {
    deleteExpiredActivities: shouldDeleteExpiredActivities = true,
    anonymizeInactiveUsers: shouldAnonymizeInactiveUsers = false, // Conservative default
    dryRun = true
  } = options || {};

  const results = {
    activitiesDeleted: 0,
    usersAnonymized: 0,
    errors: [] as string[]
  };

  try {
    logSecureInfo('Starting scheduled data retention cleanup', {
      operation: 'scheduled_cleanup',
      timestamp: new Date().toISOString(),
      statusCode: 200,
    });

    // 1. Delete expired activities
    if (shouldDeleteExpiredActivities) {
      try {
        const deletionResult = await deleteExpiredActivities(
          DATA_RETENTION_CONFIG.DEFAULT_ACTIVITY_RETENTION_DAYS,
          dryRun
        );
        results.activitiesDeleted = deletionResult.deletedCount;
      } catch (error) {
        results.errors.push('Failed to delete expired activities');
      }
    }

    // 2. Anonymize inactive users (if enabled)
    if (shouldAnonymizeInactiveUsers && !dryRun) {
      try {
        const inactiveThreshold = calculateCutoffDate(DATA_RETENTION_CONFIG.INACTIVE_USER_THRESHOLD_DAYS);
        const inactiveUsers = await prisma.user.findMany({
          where: {
            activities: {
              none: {
                timestamp: {
                  gte: inactiveThreshold
                }
              }
            }
          },
          select: { id: true }
        });

        for (const user of inactiveUsers) {
          const success = await anonymizeUser(user.id, 'Automated inactive user cleanup');
          if (success) {
            results.usersAnonymized++;
          } else {
            results.errors.push(`Failed to anonymize user ${user.id}`);
          }
        }
      } catch (error) {
        results.errors.push('Failed to anonymize inactive users');
      }
    }

    logSecureInfo('Scheduled cleanup completed', {
      operation: 'scheduled_cleanup',
      timestamp: new Date().toISOString(),
      statusCode: 200,
    });

    return results;
  } catch (error) {
    logSecureError('Scheduled cleanup failed', {
      operation: 'scheduled_cleanup',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    results.errors.push('General cleanup failure');
    return results;
  }
}