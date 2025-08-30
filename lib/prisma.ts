import { PrismaClient } from '@prisma/client';

// Optimized Prisma client configuration for Neon PostgreSQL
function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Parse DATABASE_URL to add connection pool parameters if not present
  let databaseUrl = process.env.DATABASE_URL || '';
  
  // Add connection pool parameters for Neon if not already present
  if (databaseUrl && !databaseUrl.includes('connection_limit')) {
    const urlParams = new URLSearchParams();
    urlParams.set('connection_limit', '10'); // Increase from default 5
    urlParams.set('pool_timeout', '20'); // 20 seconds
    urlParams.set('sslmode', 'require');
    
    const separator = databaseUrl.includes('?') ? '&' : '?';
    databaseUrl = `${databaseUrl}${separator}${urlParams.toString()}`;
  }
  
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
    errorFormat: isProduction ? 'minimal' : 'pretty',
    log: isProduction 
      ? ['error'] 
      : [
          {
            emit: 'event',
            level: 'query',
          },
          'error',
          'warn'
        ],
  });
}

// Global Prisma client instance
const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined;
};

// Initialize Prisma client - ensure singleton pattern
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In development, reuse the same instance to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  
  // Add query event listener for performance monitoring
  // @ts-ignore - Prisma query event typing issue
  prisma.$on('query', (e: any) => {
    if (e.duration > 1000) {
      console.warn(`🐌 SLOW QUERY (${e.duration}ms): ${e.query.substring(0, 100)}...`);
    } else if (e.duration > 500) {
      console.log(`⏱️  Query took ${e.duration}ms: ${e.query.substring(0, 80)}...`);
    }
  });
}

// Enhanced connection pool management
export const connectionPool = {
  testConnection: async (timeoutMs: number = 5000): Promise<boolean> => {
    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection test timeout')), timeoutMs);
      });
      
      const testPromise = prisma.$queryRaw`SELECT 1 as test`;
      
      await Promise.race([testPromise, timeoutPromise]);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  },
  
  getConnectionInfo: async (): Promise<any> => {
    try {
      const result = await prisma.$queryRaw`
        SELECT 
          count(*) as active_connections,
          current_setting('max_connections') as max_connections
        FROM pg_stat_activity 
        WHERE state = 'active'
      `;
      return result;
    } catch (error) {
      console.error('Failed to get connection info:', error);
      return null;
    }
  },
  
  disconnect: async (): Promise<void> => {
    try {
      await prisma.$disconnect();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('❌ Error closing database connection:', error);
    }
  },
  
  // Force connection cleanup (emergency use only)
  forceCleanup: async (): Promise<void> => {
    try {
      // Try to disconnect existing connections
      await prisma.$disconnect();
      
      // Small delay to allow cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test new connection
      const isHealthy = await connectionPool.testConnection();
      console.log(`🔄 Connection cleanup completed. Healthy: ${isHealthy}`);
    } catch (error) {
      console.error('❌ Connection cleanup failed:', error);
    }
  }
};

export default prisma;