import { NextRequest, NextResponse } from 'next/server';
import { connectionPool, DATABASE_CONFIG } from '../../../../lib/prisma';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../../lib/secure-logger';

// Database health check endpoint
export async function GET(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'database_health_check',
      'GET'
    );

    const startTime = Date.now();
    
    // Test database connection
    const isConnected = await connectionPool.testConnection();
    const connectionTime = Date.now() - startTime;
    
    // Get database metrics
    const metrics = await connectionPool.getMetrics();
    
    // Get current configuration
    const config = connectionPool.getConfig();
    
    // Determine overall health status
    const healthStatus = {
      status: isConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      connectionTime: `${connectionTime}ms`,
      database: {
        connected: isConnected,
        type: metrics.databaseType,
        metrics: metrics.error ? { error: metrics.error } : {
          ...metrics,
          // Don't expose detailed connection counts in production for security
          ...(process.env.NODE_ENV !== 'production' ? {} : {
            totalConnections: undefined,
            activeConnections: undefined,
            idleConnections: undefined
          })
        }
      },
      connectionPool: {
        configuredSize: config.CONNECTION_POOL_SIZE,
        connectionTimeout: `${config.CONNECTION_TIMEOUT}ms`,
        poolTimeout: `${config.POOL_TIMEOUT}ms`,
        queryTimeout: `${config.QUERY_TIMEOUT}ms`,
        maxConnectionAge: `${config.MAX_CONNECTION_AGE}ms`,
        environment: process.env.NODE_ENV
      },
      performance: {
        connectionLatency: connectionTime,
        slowQueryThreshold: `${config.LOG_SLOW_QUERIES}ms`,
        healthCheck: isConnected ? 'passed' : 'failed'
      }
    };
    
    // Log health check result
    logSecureInfo('Database health check completed', {
      ...requestContext,
      statusCode: isConnected ? 200 : 503,
    }, {
      connectionTime,
      databaseType: metrics.databaseType,
      isHealthy: isConnected
    });

    return NextResponse.json(healthStatus, {
      status: isConnected ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    logSecureError('Database health check failed', {
      ...requestContext || createRequestContext('database_health_check', 'GET'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Database health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  }
}

// Connection pool management endpoint (admin only)
export async function POST(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'database_pool_management',
      'POST'
    );

    const { action } = await request.json();
    
    switch (action) {
      case 'test': {
        const isConnected = await connectionPool.testConnection();
        
        logSecureInfo('Database connection test completed', {
          ...requestContext,
          statusCode: 200,
        }, { isConnected });

        return NextResponse.json({
          action: 'test',
          result: isConnected ? 'success' : 'failed',
          timestamp: new Date().toISOString()
        });
      }
      
      case 'metrics': {
        const metrics = await connectionPool.getMetrics();
        
        logSecureInfo('Database metrics retrieved', {
          ...requestContext,
          statusCode: 200,
        });

        return NextResponse.json({
          action: 'metrics',
          result: metrics,
          timestamp: new Date().toISOString()
        });
      }
      
      case 'disconnect': {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({
            error: 'Disconnect action not allowed in production'
          }, { status: 403 });
        }
        
        await connectionPool.disconnect();
        
        logSecureInfo('Database disconnected manually', {
          ...requestContext,
          statusCode: 200,
        });

        return NextResponse.json({
          action: 'disconnect',
          result: 'success',
          timestamp: new Date().toISOString()
        });
      }
      
      case 'reconnect': {
        // Only allow in development
        if (process.env.NODE_ENV === 'production') {
          return NextResponse.json({
            error: 'Reconnect action not allowed in production'
          }, { status: 403 });
        }
        
        await connectionPool.reconnect();
        
        logSecureInfo('Database reconnected manually', {
          ...requestContext,
          statusCode: 200,
        });

        return NextResponse.json({
          action: 'reconnect',
          result: 'success',
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test, metrics, disconnect, reconnect'
        }, { status: 400 });
    }
  } catch (error) {
    logSecureError('Database pool management failed', {
      ...requestContext || createRequestContext('database_pool_management', 'POST'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    
    return NextResponse.json({
      error: 'Database operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}