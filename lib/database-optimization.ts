import { PrismaClient } from '@prisma/client';

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

// Optimized query helpers
export const optimizedQueries = {
  // Get activities with minimal data for lists
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

  // Optimized WhatsApp messages with pagination
  getWhatsAppMessagesOptimized: async (prisma: PrismaClient, page: number = 1, limit: number = 20) => {
    const offset = (page - 1) * limit;
    
    const [messages, totalCount] = await Promise.all([
      prisma.whatsAppMessage.findMany({
        skip: offset,
        take: limit,
        orderBy: { timestamp: 'desc' },
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
          whatsappUser: {
            select: {
              displayName: true,
              phoneNumber: true,
              linkedUserId: true,
              linkedUser: {
                select: {
                  name: true,
                  role: true
                }
              }
            }
          },
          relatedActivity: {
            select: {
              id: true,
              category_id: true,
              location: true,
              status: true
            }
          }
        }
      }),
      prisma.whatsAppMessage.count()
    ]);
    
    return {
      messages,
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

// Performance monitoring helpers
export const performanceMonitor = {
  // Measure query execution time
  measureQuery: async <T>(queryName: string, queryFn: () => Promise<T>): Promise<T> => {
    const startTime = Date.now();
    try {
      const result = await queryFn();
      const duration = Date.now() - startTime;
      
      if (duration > 1000) {
        console.warn(`⚠️ Slow query detected: ${queryName} took ${duration}ms`);
      } else if (duration > 500) {
        console.log(`🔍 Query performance: ${queryName} took ${duration}ms`);
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ Query failed: ${queryName} after ${duration}ms:`, error);
      throw error;
    }
  },

  // Database health check with timeout
  checkDatabaseHealth: async (prisma: PrismaClient, timeoutMs: number = 5000): Promise<boolean> => {
    const timeoutPromise = new Promise<boolean>((_, reject) => {
      setTimeout(() => reject(new Error('Database health check timeout')), timeoutMs);
    });

    const healthPromise = prisma.$queryRaw`SELECT 1 as health`.then(() => true);

    try {
      return await Promise.race([healthPromise, timeoutPromise]);
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
};

// Cache helpers for frequently accessed data
export const cacheHelpers = {
  // In-memory cache for categories (rarely change)
  categoriesCache: new Map<string, any>(),
  categoriesCacheTime: 0,
  
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
  }
};