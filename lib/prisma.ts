import { PrismaClient } from '@prisma/client';
import { logSecureInfo, logSecureWarning, logSecureError, createRequestContext } from './secure-logger';

// Database connection configuration for serverless environments
const DATABASE_CONFIG = {
  // Connection pool settings optimized for Vercel serverless functions
  CONNECTION_POOL_SIZE: parseInt(process.env.DATABASE_CONNECTION_POOL_SIZE || '5'),
  CONNECTION_TIMEOUT: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000'), // 10 seconds
  POOL_TIMEOUT: parseInt(process.env.DATABASE_POOL_TIMEOUT || '20000'), // 20 seconds
  IDLE_TIMEOUT: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'), // 30 seconds
  
  // Query settings
  QUERY_TIMEOUT: parseInt(process.env.DATABASE_QUERY_TIMEOUT || '15000'), // 15 seconds
  
  // Connection lifecycle settings
  MAX_CONNECTION_AGE: parseInt(process.env.DATABASE_MAX_CONNECTION_AGE || '300000'), // 5 minutes
  
  // Logging settings
  ENABLE_QUERY_LOGGING: process.env.DATABASE_ENABLE_QUERY_LOGGING === 'true',
  LOG_SLOW_QUERIES: parseInt(process.env.DATABASE_LOG_SLOW_QUERIES_MS || '2000'), // 2 seconds
} as const;

// Simple Prisma Client configuration for development
function createPrismaClient(): PrismaClient {
  const isProduction = process.env.NODE_ENV === 'production';
  
  const client = new PrismaClient({
    errorFormat: isProduction ? 'minimal' : 'pretty',
  });
  
  return client;
}

// Build database URL with connection pooling parameters
function buildDatabaseUrl(): string {
  const baseUrl = process.env.DATABASE_URL || 'file:./dev.db';
  
  // For SQLite (development), return as-is
  if (baseUrl.startsWith('file:')) {
    return baseUrl;
  }
  
  // For PostgreSQL/MySQL, add connection pooling parameters
  const url = new URL(baseUrl);
  
  // Add connection pool parameters
  url.searchParams.set('connection_limit', DATABASE_CONFIG.CONNECTION_POOL_SIZE.toString());
  url.searchParams.set('pool_timeout', Math.floor(DATABASE_CONFIG.POOL_TIMEOUT / 1000).toString());
  url.searchParams.set('connect_timeout', Math.floor(DATABASE_CONFIG.CONNECTION_TIMEOUT / 1000).toString());
  
  // Add SSL configuration for production
  if (process.env.NODE_ENV === 'production') {
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslcert', process.env.DATABASE_SSL_CERT || '');
    url.searchParams.set('sslkey', process.env.DATABASE_SSL_KEY || '');
    url.searchParams.set('sslrootcert', process.env.DATABASE_SSL_ROOT_CERT || '');
  }
  
  return url.toString();
}

// Set up Prisma event listeners for monitoring and debugging
function setupPrismaEventListeners(client: PrismaClient) {
  const requestContext = createRequestContext('prisma_setup', 'INTERNAL');
  
  // Prisma doesn't have 'error' or 'warn' events in this version
  // Only 'query' event is supported for performance monitoring
  
  // Event listeners not supported in this Prisma version
  // Database monitoring handled via try/catch in application code
  
  // Log successful connections
  logSecureInfo('Prisma client configured successfully', {
    ...requestContext,
    statusCode: 200,
  }, {
    connectionPoolSize: DATABASE_CONFIG.CONNECTION_POOL_SIZE,
    environment: process.env.NODE_ENV,
    databaseType: getDatabaseType()
  });
}

// Set up connection lifecycle management for serverless environments
function setupConnectionLifecycle(client: PrismaClient) {
  if (process.env.NODE_ENV === 'production') {
    // Graceful shutdown handler
    const gracefulShutdown = async () => {
      const requestContext = createRequestContext('prisma_shutdown', 'INTERNAL');
      
      try {
        logSecureInfo('Shutting down Prisma client', requestContext);
        await client.$disconnect();
        logSecureInfo('Prisma client disconnected successfully', requestContext);
      } catch (error) {
        logSecureError('Error during Prisma client shutdown', {
          ...requestContext,
          statusCode: 500,
        }, error instanceof Error ? error : undefined);
      }
    };
    
    // Register shutdown handlers
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    process.on('beforeExit', gracefulShutdown);
    
    // Periodic connection health check (every 5 minutes)
    const healthCheckInterval = setInterval(async () => {
      try {
        await client.$queryRaw`SELECT 1`;
      } catch (error) {
        logSecureError('Database health check failed', {
          operation: 'health_check',
          timestamp: new Date().toISOString(),
          statusCode: 500,
        }, error instanceof Error ? error : undefined);
        
        // Attempt to reconnect
        try {
          await client.$disconnect();
          await client.$connect();
          logSecureInfo('Database reconnection successful', {
            operation: 'database_reconnect',
            timestamp: new Date().toISOString(),
            statusCode: 200,
          });
        } catch (reconnectError) {
          logSecureError('Database reconnection failed', {
            operation: 'database_reconnect',
            timestamp: new Date().toISOString(),
            statusCode: 500,
          }, reconnectError instanceof Error ? reconnectError : undefined);
        }
      }
    }, DATABASE_CONFIG.MAX_CONNECTION_AGE);
    
    // Clear interval on shutdown
    process.on('SIGTERM', () => clearInterval(healthCheckInterval));
  }
}

// Utility function to determine database type
function getDatabaseType(): string {
  const dbUrl = process.env.DATABASE_URL || 'file:./dev.db';
  
  if (dbUrl.startsWith('file:')) return 'sqlite';
  if (dbUrl.startsWith('postgresql:') || dbUrl.startsWith('postgres:')) return 'postgresql';
  if (dbUrl.startsWith('mysql:')) return 'mysql';
  if (dbUrl.startsWith('mongodb:')) return 'mongodb';
  
  return 'unknown';
}

// Connection pool monitoring utilities
export const connectionPool = {
  // Get current configuration
  getConfig: () => DATABASE_CONFIG,
  
  // Test database connection
  testConnection: async (): Promise<boolean> => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (error) {
      logSecureError('Database connection test failed', {
        operation: 'connection_test',
        timestamp: new Date().toISOString(),
        statusCode: 500,
      }, error instanceof Error ? error : undefined);
      return false;
    }
  },
  
  // Get database metrics (if supported)
  getMetrics: async () => {
    try {
      const dbType = getDatabaseType();
      
      if (dbType === 'postgresql') {
        // PostgreSQL-specific metrics
        const result = await prisma.$queryRaw`
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections
          FROM pg_stat_activity 
          WHERE datname = current_database()
        ` as any;
        
        return {
          totalConnections: Number(result[0]?.total_connections || 0),
          activeConnections: Number(result[0]?.active_connections || 0),
          idleConnections: Number(result[0]?.idle_connections || 0),
          databaseType: dbType
        };
      }
      
      // For other database types, return basic info
      return {
        databaseType: dbType,
        configuredPoolSize: DATABASE_CONFIG.CONNECTION_POOL_SIZE,
        message: 'Detailed metrics not available for this database type'
      };
    } catch (error) {
      logSecureError('Failed to get database metrics', {
        operation: 'get_metrics',
        timestamp: new Date().toISOString(),
        statusCode: 500,
      }, error instanceof Error ? error : undefined);
      
      return {
        error: 'Failed to retrieve metrics',
        databaseType: getDatabaseType()
      };
    }
  },
  
  // Force disconnect (useful for testing)
  disconnect: async (): Promise<void> => {
    await prisma.$disconnect();
  },
  
  // Force reconnect
  reconnect: async (): Promise<void> => {
    await prisma.$disconnect();
    await prisma.$connect();
  }
};

// Global Prisma client instance with connection pooling
const globalForPrisma = global as unknown as { 
  prisma: PrismaClient | undefined;
};

// Initialize Prisma client with connection pooling - ensure singleton
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// In development, reuse the same instance to prevent connection exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// Export configuration for monitoring and testing
export { DATABASE_CONFIG };