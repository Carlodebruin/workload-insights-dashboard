import { prisma, connectionPool } from './prisma';
import type { PrismaClient } from '@prisma/client';

/**
 * Database wrapper with automatic retry logic for connection failures
 * Provides resilient database operations without breaking existing functionality
 */
export class DatabaseWrapper {
  private static instance: DatabaseWrapper;
  
  private constructor(private prismaClient: PrismaClient = prisma) {}
  
  static getInstance(): DatabaseWrapper {
    if (!DatabaseWrapper.instance) {
      DatabaseWrapper.instance = new DatabaseWrapper();
    }
    return DatabaseWrapper.instance;
  }
  
  /**
   * Execute a database operation with automatic retry on connection failures
   */
  async execute<T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    return connectionPool.withRetry(() => operation(this.prismaClient));
  }
  
  /**
   * Raw query with retry logic
   */
  async queryRaw<T = unknown>(query: TemplateStringsArray, ...values: any[]): Promise<T> {
    return this.execute(async (prisma) => {
      return prisma.$queryRaw(query, ...values) as Promise<T>;
    });
  }
  
  /**
   * Execute raw query with retry logic
   */
  async executeRaw(query: TemplateStringsArray, ...values: any[]): Promise<number> {
    return this.execute(async (prisma) => {
      return prisma.$executeRaw(query, ...values);
    });
  }
  
  /**
   * Get the underlying Prisma client for complex operations
   * Use with caution - prefer execute() for automatic retry
   */
  get client(): PrismaClient {
    return this.prismaClient;
  }
  
  /**
   * Health check with timeout
   */
  async healthCheck(timeoutMs: number = 5000): Promise<boolean> {
    return connectionPool.testConnection(timeoutMs);
  }
}

// Export singleton instance and convenience functions
export const db = DatabaseWrapper.getInstance();

/**
 * Convenience function for wrapping existing Prisma operations
 * Usage: await withDb(prisma => prisma.user.findMany())
 */
export const withDb = <T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> => {
  return db.execute(operation);
};

/**
 * Convenience function for critical operations that need extra resilience
 * Uses higher retry count and longer timeouts
 */
export const withDbCritical = <T>(operation: (prisma: PrismaClient) => Promise<T>): Promise<T> => {
  return connectionPool.withRetry(() => operation(db.client), 5, 2000);
};