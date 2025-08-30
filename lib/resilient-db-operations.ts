/**
 * Resilient Database Operations
 * 
 * This module provides wrapped database operations that automatically retry
 * on connection failures, addressing the "Error { kind: Closed, cause: None }" issue
 * without breaking existing functionality.
 */

import { withDb, withDbCritical } from './db-wrapper';
import type { PrismaClient } from '@prisma/client';

/**
 * WhatsApp user operations with automatic retry
 */
export const resilientWhatsAppOps = {
  upsertUser: async (phoneNumber: string, displayName: string) => {
    return withDb(async (prisma) => {
      return prisma.whatsAppUser.upsert({
        where: { phoneNumber },
        update: { 
          displayName,
          lastMessageAt: new Date(),
          messagesInWindow: { increment: 1 }
        },
        create: {
          phoneNumber,
          displayName,
          lastMessageAt: new Date(),
          messagesInWindow: 1,
          isBlocked: false
        }
      });
    });
  },

  createMessage: async (messageData: any) => {
    return withDb(async (prisma) => {
      return prisma.whatsAppMessage.create({
        data: messageData
      });
    });
  },

  updateMessage: async (messageId: string, updates: any) => {
    return withDb(async (prisma) => {
      return prisma.whatsAppMessage.update({
        where: { id: messageId },
        data: updates
      });
    });
  }
};

/**
 * Activity operations with automatic retry
 */
export const resilientActivityOps = {
  createActivity: async (activityData: any) => {
    return withDbCritical(async (prisma) => {
      return prisma.activity.create({
        data: activityData,
        include: {
          category: true,
          user: true
        }
      });
    });
  },

  findUserByPhone: async (phoneNumber: string) => {
    return withDb(async (prisma) => {
      return prisma.user.findFirst({
        where: { phone_number: phoneNumber }
      });
    });
  },

  createUser: async (userData: any) => {
    return withDb(async (prisma) => {
      return prisma.user.create({
        data: userData
      });
    });
  },

  getCategories: async () => {
    return withDb(async (prisma) => {
      return prisma.category.findMany();
    });
  },

  getRecentActivities: async (userId: string, limit: number = 5) => {
    return withDb(async (prisma) => {
      return prisma.activity.findMany({
        where: { user_id: userId },
        orderBy: { timestamp: 'desc' },
        take: limit,
        include: {
          category: { select: { name: true } }
        }
      });
    });
  }
};

/**
 * Health and monitoring operations
 */
export const resilientMonitoringOps = {
  testConnection: async () => {
    return withDb(async (prisma) => {
      const result = await prisma.$queryRaw`SELECT 1 as test, NOW() as timestamp`;
      return Array.isArray(result) ? result[0] : result;
    });
  },

  getConnectionStats: async () => {
    return withDb(async (prisma) => {
      return prisma.$queryRaw`
        SELECT 
          count(*) as active_connections,
          current_setting('max_connections') as max_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
    });
  }
};

/**
 * Generic operation wrapper for existing code migration
 * 
 * Usage:
 * // Before:
 * const result = await prisma.user.findMany();
 * 
 * // After:
 * const result = await wrapOperation(prisma => prisma.user.findMany());
 */
export const wrapOperation = <T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> => {
  return withDb(operation);
};

/**
 * Critical operation wrapper for operations that must not fail
 * Uses higher retry count and longer delays
 */
export const wrapCriticalOperation = <T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> => {
  return withDbCritical(operation);
};