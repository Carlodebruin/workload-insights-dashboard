import { NextRequest, NextResponse } from 'next/server';
import { connectionPool } from '../../../../lib/prisma';

// Database health check endpoint
export async function GET(request: NextRequest) {
  try {
    const startTime = Date.now();
    
    // Test database connection
    const isConnected = await connectionPool.testConnection();
    const connectionTime = Date.now() - startTime;
    
    // Determine overall health status
    const healthStatus = {
      status: isConnected ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      connectionTime: `${connectionTime}ms`,
      database: {
        connected: isConnected,
        type: 'postgresql',
        environment: process.env.NODE_ENV
      },
      performance: {
        connectionLatency: connectionTime,
        healthCheck: isConnected ? 'passed' : 'failed'
      }
    };

    return NextResponse.json(healthStatus, {
      status: isConnected ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    
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
  try {
    const { action } = await request.json();
    
    switch (action) {
      case 'test': {
        const isConnected = await connectionPool.testConnection();

        return NextResponse.json({
          action: 'test',
          result: isConnected ? 'success' : 'failed',
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

        return NextResponse.json({
          action: 'disconnect',
          result: 'success',
          timestamp: new Date().toISOString()
        });
      }
      
      default:
        return NextResponse.json({
          error: 'Invalid action. Supported actions: test, disconnect'
        }, { status: 400 });
    }
  } catch (error) {
    console.error('Database pool management failed:', error);
    
    return NextResponse.json({
      error: 'Database operation failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}