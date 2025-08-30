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

// Enhanced connection resilience utilities
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

  // Retry wrapper for database operations with exponential backoff
  withRetry: async <T>(
    operation: () => Promise<T>, 
    maxRetries: number = 3,
    baseDelayMs: number = 1000
  ): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if this is a connection closure error
        const isConnectionError = (
          lastError.message.includes('Closed') || 
          lastError.message.includes('connection') ||
          lastError.message.includes('ECONNRESET') ||
          lastError.message.includes('timeout') ||
          lastError.message.includes('ECONNREFUSED') ||
          lastError.message.includes('Connection terminated') ||
          (lastError as any).code === 'P1001' || // Prisma connection error
          (lastError as any).code === 'P1017'    // Prisma connection timeout
        );
        
        if (isConnectionError) {
          console.warn(`🔄 Database operation failed (attempt ${attempt}/${maxRetries}): ${lastError.message}`);
          
          if (attempt < maxRetries) {
            // Exponential backoff delay
            const delay = baseDelayMs * Math.pow(2, attempt - 1);
            console.log(`   Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            
            // Try to refresh connection
            try {
              await connectionPool.testConnection(2000);
            } catch (testError) {
              console.warn(`   Connection test failed during retry: ${testError}`);
            }
            
            continue;
          }
        }
        
        // If it's not a connection error, or we've exhausted retries, throw immediately
        throw lastError;
      }
    }
    
    throw lastError || new Error('Max retries exceeded');
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