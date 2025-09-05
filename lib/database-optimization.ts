import { PrismaClient } from '@prisma/client';
import { OptimizedQueries } from './optimized-queries';
import { performanceMonitor, PerformanceMonitor } from './performance-monitor';

// Database optimization configurations
export const optimizedPrismaConfig = {
  // Connection pool settings for better performance
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  // Enable query logging in development for monitoring
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  
  // Connection pool optimization
  __internal: {
    engine: {
      // Connection pool size
      connectionLimit: 10,
      // Query timeout
      queryTimeout: 10000,
      // Connection timeout
      connectionTimeout: 5000,
    }
  }
};

// Export the new optimized queries
export { OptimizedQueries as optimizedQueries };
export { performanceMonitor };

// Legacy optimized query helpers (maintained for backward compatibility)
export const legacyOptimizedQueries = {
  // Get activities with minimal data for lists (optimized for performance)
  getActivitiesLite: async (prisma: PrismaClient, page: number = 1, limit: number = 20) => {
    const offset = (page - 1) * limit;
    
    const [activities, totalCount] = await Promise.all([
      prisma.activity.findMany({
        skip: offset,
        take: limit,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          subcategory: true,
          location: true,
          timestamp: true,
          status: true,
          user: {
            select: {
              id: true,
              name: true
            }
          },
          category: {
            select: {
              id: true,
              name: true
            }
          },
          assignedTo: {
            select: {
              id: true,
              name: true
            }
          }
        }
      }),
      prisma.activity.count()
    ]);
    
    return {
      activities,
      totalCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
      }
    };
  },

  // Get activities with absolute minimal data (fastest possible)
  getActivitiesMinimal: async (prisma: PrismaClient, page: number = 1, limit: number = 20) => {
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
    
    return {
      activities,
      totalCount,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalRecords: totalCount,
        pageSize: limit,
        hasNextPage: page < Math.ceil(totalCount / limit),
        hasPreviousPage: page > 1
      }
    };
  },

  // Get full activity details (for single activity view)
  getActivityFull: async (prisma: PrismaClient, activityId: string) => {
    return prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        category: {
          select: {
            id: true,
            name: true
          }
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            role: true
          }
        },
        updates: {
          orderBy: { timestamp: 'desc' },
          include: {
            author: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      }
    });
  },

  // Heavily optimized WhatsApp messages with pagination and caching
  getWhatsAppMessagesOptimized: async (prisma: PrismaClient, page: number = 1, limit: number = 20) => {
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
      
      return {
        messages,
        totalCount,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalCount / actualLimit),
          totalRecords: totalCount,
          pageSize: actualLimit,
          hasNextPage: page < Math.ceil(totalCount / actualLimit),
          hasPreviousPage: page > 1
        }
      };
      
    } catch (error) {
      console.error('❌ WhatsApp messages query failed:', error);
      // Fallback: return minimal data to prevent complete failure
      return {
        messages: [],
        totalCount: 0,
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
  },

  // Optimized user queries
  getUsersLite: async (prisma: PrismaClient) => {
    return prisma.user.findMany({
      select: {
        id: true,
        name: true,
        role: true,
        phone_number: true
      },
      orderBy: { name: 'asc' }
    });
  },

  // Dashboard statistics (cached for 5 minutes)
  getDashboardStats: async (prisma: PrismaClient) => {
    const [
      totalActivities,
      openActivities,
      inProgressActivities,
      completedActivities,
      totalUsers,
      totalCategories,
      recentActivities
    ] = await Promise.all([
      prisma.activity.count(),
      prisma.activity.count({ where: { status: 'Open' } }),
      prisma.activity.count({ where: { status: 'In Progress' } }),
      prisma.activity.count({ where: { status: 'Completed' } }),
      prisma.user.count(),
      prisma.category.count(),
      prisma.activity.findMany({
        take: 5,
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          subcategory: true,
          location: true,
          timestamp: true,
          status: true,
          user: { select: { name: true } },
          category: { select: { name: true } }
        }
      })
    ]);

    return {
      activities: {
        total: totalActivities,
        open: openActivities,
        inProgress: inProgressActivities,
        completed: completedActivities
      },
      users: totalUsers,
      categories: totalCategories,
      recentActivities
    };
  }
};

// Legacy performance monitoring (maintained for backward compatibility)
export const legacyPerformanceMonitor = {
  measureQuery: performanceMonitor.measureQuery.bind(performanceMonitor),
  checkDatabaseHealth: async (prisma: PrismaClient, timeoutMs: number = 5000): Promise<boolean> => {
    const result = await performanceMonitor.checkDatabaseHealth(prisma, timeoutMs);
    return result.healthy;
  }
};

// Cache helpers for frequently accessed data (unchanged)
export const cacheHelpers = {
  // In-memory cache for categories (rarely change)
  categoriesCache: new Map<string, any>(),
  categoriesCacheTime: 0,
  
  // Generic count cache for expensive count queries
  countCache: new Map<string, { value: number; timestamp: number }>(),
  
  getCachedCategories: async (prisma: PrismaClient) => {
    const now = Date.now();
    const cacheValidMs = 5 * 60 * 1000; // 5 minutes
    
    if (now - cacheHelpers.categoriesCacheTime < cacheValidMs && cacheHelpers.categoriesCache.size > 0) {
      return Array.from(cacheHelpers.categoriesCache.values());
    }
    
    const categories = await prisma.category.findMany({
      select: {
        id: true,
        name: true,
        isSystem: true
      },
      orderBy: { name: 'asc' }
    });
    
    cacheHelpers.categoriesCache.clear();
    categories.forEach(cat => cacheHelpers.categoriesCache.set(cat.id, cat));
    cacheHelpers.categoriesCacheTime = now;
    
    return categories;
  },
  
  // Generic cached count function
  getCachedCount: async (prisma: PrismaClient, cacheKey: string, cacheValidMs: number, countFn: () => Promise<number>): Promise<number> => {
    const now = Date.now();
    const cached = cacheHelpers.countCache.get(cacheKey);
    
    if (cached && (now - cached.timestamp) < cacheValidMs) {
      return cached.value;
    }
    
    try {
      const count = await countFn();
      cacheHelpers.countCache.set(cacheKey, { value: count, timestamp: now });
      return count;
    } catch (error) {
      console.error(`❌ Count query failed for ${cacheKey}:`, error);
      // Return cached value if available, otherwise 0
      return cached?.value || 0;
    }
  },
  
  // Clear all caches (useful for testing)
  clearAll: () => {
    cacheHelpers.categoriesCache.clear();
    cacheHelpers.countCache.clear();
    cacheHelpers.categoriesCacheTime = 0;
  }
};