import { PrismaClient } from '@prisma/client';
import type { Activity, User, ActivityUpdate, Category } from '@prisma/client';
import { cacheHelpers } from './database-optimization';

// Types for optimized query results
export interface ActivityFilters {
  status?: string;
  categoryId?: string;
  userId?: string;
  assignedToUserId?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
  limit?: number;
  offset?: number;
}

export interface WorkloadData {
  activeCount: number;
  completedCount: number;
  overdueCount: number;
  averageCompletionTime: number;
  completionRate: number;
}

export interface DateRange {
  start: Date;
  end: Date;
}

export interface UserWorkloadResult {
  userWorkloads: Array<{
    userId: string;
    userName: string;
    userRole: string;
    workloadMetrics: {
      activeAssignments: number;
      completedThisWeek: number;
      overdueAssignments: number;
      averageCompletionTime: number;
      completionRate: number;
      workloadScore: number;
      capacityUtilization: number;
    };
    categoryExpertise: Array<{
      categoryId: string;
      categoryName: string;
      assignmentCount: number;
      successRate: number;
    }>;
  }>;
  teamSummary: {
    totalActive: number;
    totalCompleted: number;
    totalOverdue: number;
    averageWorkloadScore: number;
    busiestUsers: Array<{
      userId: string;
      userName: string;
      activeCount: number;
    }>;
  };
}

/**
 * Advanced query optimization layer for database operations
 * Implements strategic query patterns and performance optimizations
 */
export class OptimizedQueries {
  /**
   * Optimize existing activity fetching with strategic SELECT and filtering
   */
  static async getActivitiesOptimized(
    prisma: PrismaClient,
    filters: ActivityFilters
  ): Promise<any[]> {
    const whereClause = this.buildOptimizedWhere(filters);
    
    return prisma.activity.findMany({
      select: {
        id: true,
        user_id: true,
        category_id: true,
        subcategory: true,
        location: true,
        timestamp: true,
        status: true,
        assigned_to_user_id: true,
        // Only select needed fields, not all
        notes: true,
        photo_url: true,
        latitude: true,
        longitude: true,
        assignment_instructions: true,
        resolution_notes: true,
        deadline_date: true,
        deadline_type: true,
        is_overdue: true,
        overdue_notified: true,
      },
      where: whereClause,
      orderBy: { timestamp: 'desc' },
      // Use cursor-based pagination for better performance
      take: filters.limit || 50,
      skip: filters.offset || 0,
    });
  }

  /**
   * Build optimized WHERE clause for activity queries
   */
  private static buildOptimizedWhere(filters: ActivityFilters): any {
    const where: any = {};

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.categoryId) {
      where.category_id = filters.categoryId;
    }

    if (filters.userId) {
      where.user_id = filters.userId;
    }

    if (filters.assignedToUserId) {
      where.assigned_to_user_id = filters.assignedToUserId;
    }

    if (filters.startDate || filters.endDate) {
      where.timestamp = {};
      if (filters.startDate) {
        where.timestamp.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.timestamp.lte = filters.endDate;
      }
    }

    if (filters.searchTerm) {
      where.OR = [
        { subcategory: { contains: filters.searchTerm, mode: 'insensitive' } },
        { location: { contains: filters.searchTerm, mode: 'insensitive' } },
        { notes: { contains: filters.searchTerm, mode: 'insensitive' } },
      ];
    }

    return where;
  }

  /**
   * Optimize workload calculations with single query instead of multiple roundtrips
   */
  static async getUserWorkloadOptimized(
    prisma: PrismaClient,
    userId: string,
    dateRange: DateRange
  ): Promise<WorkloadData> {
    const [activeCount, completedCount, overdueCount, completionTimes] = await Promise.all([
      // Active assignments count
      prisma.activity.count({
        where: {
          assigned_to_user_id: userId,
          status: { in: ['Open', 'In Progress'] }
        }
      }),
      
      // Completed this week count
      prisma.activity.count({
        where: {
          assigned_to_user_id: userId,
          status: 'Resolved',
          timestamp: { gte: dateRange.start, lte: dateRange.end }
        }
      }),
      
      // Overdue assignments count
      prisma.activity.count({
        where: {
          assigned_to_user_id: userId,
          status: { not: 'Resolved' },
          deadline_date: { lt: new Date() }
        }
      }),
      
      // Average completion time calculation
      prisma.activity.findMany({
        where: {
          assigned_to_user_id: userId,
          status: 'Resolved',
          timestamp: { gte: dateRange.start, lte: dateRange.end }
        },
        select: {
          timestamp: true,
          deadline_date: true
        }
      })
    ]);

    // Calculate average completion time
    let averageCompletionTime = 0;
    if (completionTimes.length > 0) {
      const totalHours = completionTimes.reduce((sum, activity) => {
        if (activity.deadline_date && activity.timestamp) {
          const completionTimeHours = Math.abs(
            activity.timestamp.getTime() - activity.deadline_date.getTime()
          ) / (1000 * 60 * 60);
          return sum + completionTimeHours;
        }
        return sum;
      }, 0);
      averageCompletionTime = totalHours / completionTimes.length;
    }

    // Calculate completion rate
    const totalAssignments = activeCount + completedCount;
    const completionRate = totalAssignments > 0 
      ? (completedCount / totalAssignments) * 100 
      : 0;

    return {
      activeCount,
      completedCount,
      overdueCount,
      averageCompletionTime: averageCompletionTime || 0,
      completionRate: completionRate || 0
    };
  }

  /**
   * Optimized dashboard statistics with parallel queries
   */
  static async getDashboardStatsOptimized(prisma: PrismaClient) {
    const [
      totalActivities,
      openActivities,
      inProgressActivities,
      resolvedActivities,
      totalUsers,
      totalCategories,
      recentActivities,
      userWorkloads
    ] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({ where: { status: 'Open' } }),
      prisma.activity.count({ where: { status: 'In Progress' } }),
      prisma.activity.count({ where: { status: 'Resolved' } }),
      prisma.user.count(),
      prisma.category.count(),
      prisma.activity.findMany({
        take: 10,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          subcategory: true,
          location: true,
          timestamp: true,
          status: true,
          user: { select: { name: true } },
          category: { select: { name: true } },
          assignedTo: { select: { name: true } }
        }
      }),
      this.getUserWorkloadsOptimized(prisma)
    ]);

    return {
      activities: {
        total: totalActivities,
        open: openActivities,
        inProgress: inProgressActivities,
        resolved: resolvedActivities
      },
      users: totalUsers,
      categories: totalCategories,
      recentActivities,
      userWorkloads
    };
  }

  /**
   * Comprehensive user workload analysis with optimized queries
   */
  static async getUserWorkloadsOptimized(prisma: PrismaClient): Promise<UserWorkloadResult> {
    const users = await prisma.user.findMany({
      where: { role: { in: ['staff', 'admin', 'supervisor'] } },
      select: { id: true, name: true, role: true }
    });

    const userWorkloads = await Promise.all(
      users.map(async (user) => {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

        const workload = await this.getUserWorkloadOptimized(prisma, user.id, {
          start: oneWeekAgo,
          end: new Date()
        });

        // Calculate category expertise
        const categoryStats = await prisma.activity.groupBy({
          by: ['category_id'],
          where: {
            assigned_to_user_id: user.id,
            status: 'Resolved'
          },
          _count: { id: true }
        });

        const categoryExpertise = await Promise.all(
          categoryStats.map(async (stat) => {
            const category = await prisma.category.findUnique({
              where: { id: stat.category_id },
              select: { name: true }
            });

            return {
              categoryId: stat.category_id,
              categoryName: category?.name || 'Unknown',
              assignmentCount: stat._count.id,
              successRate: 85 // Placeholder - would need more complex calculation
            };
          })
        );

        return {
          userId: user.id,
          userName: user.name,
          userRole: user.role,
          workloadMetrics: {
            activeAssignments: workload.activeCount,
            completedThisWeek: workload.completedCount,
            overdueAssignments: workload.overdueCount,
            averageCompletionTime: workload.averageCompletionTime,
            completionRate: workload.completionRate,
            workloadScore: Math.min(100, workload.activeCount * 10 + workload.completedCount * 5),
            capacityUtilization: Math.min(100, (workload.activeCount / 15) * 100)
          },
          categoryExpertise
        };
      })
    );

    // Calculate team summary
    const totalActive = userWorkloads.reduce((sum, user) => sum + user.workloadMetrics.activeAssignments, 0);
    const totalCompleted = userWorkloads.reduce((sum, user) => sum + user.workloadMetrics.completedThisWeek, 0);
    const totalOverdue = userWorkloads.reduce((sum, user) => sum + user.workloadMetrics.overdueAssignments, 0);
    const averageWorkloadScore = userWorkloads.reduce((sum, user) => sum + user.workloadMetrics.workloadScore, 0) / userWorkloads.length;

    // Get busiest users
    const busiestUsers = userWorkloads
      .sort((a, b) => b.workloadMetrics.activeAssignments - a.workloadMetrics.activeAssignments)
      .slice(0, 5)
      .map(user => ({
        userId: user.userId,
        userName: user.userName,
        activeCount: user.workloadMetrics.activeAssignments
      }));

    return {
      userWorkloads,
      teamSummary: {
        totalActive,
        totalCompleted,
        totalOverdue,
        averageWorkloadScore,
        busiestUsers
      }
    };
  }

  /**
   * Optimized real-time activity updates query
   */
  static async getRecentActivityUpdates(
    prisma: PrismaClient,
    hours: number = 24
  ): Promise<ActivityUpdate[]> {
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - hours);

    return prisma.activityUpdate.findMany({
      where: {
        timestamp: { gte: cutoffDate }
      },
      include: {
        activity: {
          select: {
            id: true,
            subcategory: true,
            location: true,
            status: true
          }
        },
        author: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { timestamp: 'desc' },
      take: 50
    });
  }

  /**
   * Optimized search across multiple fields
   */
  static async searchActivitiesOptimized(
    prisma: PrismaClient,
    searchTerm: string,
    limit: number = 20
  ): Promise<any[]> {
    return prisma.activity.findMany({
      where: {
        OR: [
          { subcategory: { contains: searchTerm, mode: 'insensitive' } },
          { location: { contains: searchTerm, mode: 'insensitive' } },
          { notes: { contains: searchTerm, mode: 'insensitive' } },
          { assignment_instructions: { contains: searchTerm, mode: 'insensitive' } },
          { resolution_notes: { contains: searchTerm, mode: 'insensitive' } },
          {
            user: {
              name: { contains: searchTerm, mode: 'insensitive' }
            }
          },
          {
            assignedTo: {
              name: { contains: searchTerm, mode: 'insensitive' }
            }
          }
        ]
      },
      select: {
        id: true,
        subcategory: true,
        location: true,
        timestamp: true,
        status: true,
        user: { select: { name: true } },
        category: { select: { name: true } },
        assignedTo: { select: { name: true } }
      },
      orderBy: { timestamp: 'desc' },
      take: limit
    });
  }
  /**
   * Backward compatibility method - maintains existing API
   * Used by app/api/activities/route.ts
   */
  static async getActivitiesMinimal(
    prisma: PrismaClient,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    activities: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const offset = (page - 1) * limit;
    
    const [activities, totalCount] = await Promise.all([
      prisma.activity.findMany({
        skip: offset,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          user_id: true,
          category_id: true,
          subcategory: true,
          location: true,
          timestamp: true,
          status: true,
          assigned_to_user_id: true,
          notes: true,
          photo_url: true,
          latitude: true,
          longitude: true,
          assignment_instructions: true,
          resolution_notes: true,
        }
      }),
      prisma.activity.count()
    ]);
    
    const totalPages = Math.ceil(totalCount / limit);
    
    return {
      activities,
      pagination: {
        currentPage: page,
        totalPages,
        totalRecords: totalCount,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    };
  }

  /**
   * Backward compatibility method - optimized WhatsApp messages query
   * Used by app/api/whatsapp-messages/route.ts
   */
  static async getWhatsAppMessagesOptimized(
    prisma: PrismaClient,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    messages: any[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalRecords: number;
      pageSize: number;
      hasNextPage: boolean;
      hasPreviousPage: boolean;
    };
  }> {
    const offset = (page - 1) * limit;
    
    // Use smaller limit for better performance, max 50 per page
    const actualLimit = Math.min(limit, 50);
    
    try {
      // Parallel execution with timeout protection
      const queryTimeout = 8000; // 8 seconds max
      
      const messagesPromise = prisma.whatsAppMessage.findMany({
        skip: offset,
        take: actualLimit,
        orderBy: [
          { timestamp: 'desc' },
          { id: 'desc' } // Secondary sort for consistency
        ],
        select: {
          id: true,
          waId: true,
          from: true,
          type: true,
          content: true,
          timestamp: true,
          direction: true,
          status: true,
          processed: true,
          relatedActivityId: true,
          // Simplified nested selects to reduce join complexity
          whatsappUser: {
            select: {
              displayName: true,
              phoneNumber: true,
              linkedUser: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          // Simplified related activity select
          relatedActivity: {
            select: {
              id: true,
              location: true,
              status: true,
              subcategory: true
            }
          }
        }
      });
      
      // Cached count query - only run full count every 30 seconds
      const countCacheKey = 'whatsapp_message_count';
      const countPromise = cacheHelpers.getCachedCount(prisma, countCacheKey, 30000, () =>
        prisma.whatsAppMessage.count()
      );
      
      // Race against timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('WhatsApp query timeout')), queryTimeout);
      });
      
      const [messages, totalCount] = await Promise.race([
        Promise.all([messagesPromise, countPromise]),
        timeoutPromise
      ]) as [any[], number];
      
      const totalPages = Math.ceil(totalCount / actualLimit);
      
      return {
        messages,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: totalCount,
          pageSize: actualLimit,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1
        }
      };
      
    } catch (error) {
      console.error('❌ WhatsApp messages query failed:', error);
      // Fallback: return minimal data to prevent complete failure
      return {
        messages: [],
        pagination: {
          currentPage: page,
          totalPages: 0,
          totalRecords: 0,
          pageSize: actualLimit,
          hasNextPage: false,
          hasPreviousPage: false
        }
      };
    }
  }
}