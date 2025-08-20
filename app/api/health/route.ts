import { NextRequest, NextResponse } from 'next/server';
import { connectionPool } from '../../../lib/prisma';
import { envHelpers } from '../../../lib/env-validation';
import { logSecureInfo, logSecureError, createRequestContext } from '../../../lib/secure-logger';
import { logger, logApiRequest, logApiResponse } from '../../../lib/logger';

// Types for health check responses
type HealthStatus = 'healthy' | 'unhealthy' | 'warning' | 'error' | 'unknown' | 'configured' | 'not_configured';

interface DatabaseHealth {
  status: HealthStatus;
  latency: number | null;
  error: string | null;
}

interface EnvironmentHealth {
  status: HealthStatus;
  errors: string[];
}

interface AiProvidersHealth {
  status: HealthStatus;
  available: string[];
  configured: number;
}

interface RedisHealth {
  status: HealthStatus;
  configured: boolean;
}

interface OverallHealth {
  status: HealthStatus;
  uptime: number;
  responseTime?: number;
  environment?: string;
  version?: string;
}

// System health check endpoint
export async function GET(request: NextRequest) {
  // Initialize comprehensive logging for health check
  const logContext = logApiRequest(request, 'system_health_check');
  const startTime = Date.now();
  
  // Legacy context for existing secure logger
  const requestContext = createRequestContext(
    'system_health_check',
    'GET'
  );
  
  try {

    // Initialize health check results
    const healthChecks: {
      database: DatabaseHealth;
      environment: EnvironmentHealth;
      aiProviders: AiProvidersHealth;
      redis: RedisHealth;
      overall: OverallHealth;
    } = {
      database: { status: 'unknown', latency: null, error: null },
      environment: { status: 'unknown', errors: [] },
      aiProviders: { status: 'unknown', available: [], configured: 0 },
      redis: { status: 'unknown', configured: false },
      overall: { status: 'unknown', uptime: process.uptime() }
    };

    // 1. Database Health Check
    try {
      logger.debug('Starting database health check', logContext);
      const dbStartTime = Date.now();
      const isDbConnected = await connectionPool.testConnection();
      const dbLatency = Date.now() - dbStartTime;
      
      healthChecks.database = {
        status: isDbConnected ? 'healthy' : 'unhealthy',
        latency: dbLatency,
        error: isDbConnected ? null : 'Connection failed'
      };
      
      logger.logHealthCheck('database', isDbConnected ? 'healthy' : 'unhealthy', logContext, {
        latency: dbLatency,
        connected: isDbConnected
      });
    } catch (error) {
      healthChecks.database = {
        status: 'error',
        latency: null,
        error: error instanceof Error ? error.message : 'Unknown database error'
      };
      
      logger.logHealthCheck('database', 'unhealthy', logContext, {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // 2. Environment Configuration Check
    try {
      const envErrors = [];
      
      // Check if required AI providers are configured
      const availableProviders = envHelpers.getAvailableAiProviders();
      if (availableProviders.length === 0) {
        envErrors.push('No AI providers configured');
      }
      
      // Check critical environment variables
      if (envHelpers.isProduction() && !process.env.DATABASE_URL) {
        envErrors.push('DATABASE_URL not configured for production');
      }
      
      healthChecks.environment = {
        status: envErrors.length === 0 ? 'healthy' : 'warning',
        errors: envErrors
      };
    } catch (error) {
      healthChecks.environment = {
        status: 'error',
        errors: ['Environment validation failed']
      };
    }

    // 3. AI Providers Check
    try {
      const availableProviders = envHelpers.getAvailableAiProviders();
      
      healthChecks.aiProviders = {
        status: availableProviders.length > 0 ? 'healthy' : 'unhealthy',
        available: availableProviders,
        configured: availableProviders.length
      };
    } catch (error) {
      healthChecks.aiProviders = {
        status: 'error',
        available: [],
        configured: 0
      };
    }

    // 4. Redis Configuration Check
    try {
      const hasRedis = envHelpers.hasRedis();
      
      healthChecks.redis = {
        status: hasRedis ? 'configured' : 'not_configured',
        configured: hasRedis
      };
    } catch (error) {
      healthChecks.redis = {
        status: 'error',
        configured: false
      };
    }

    // 5. Overall System Health
    const componentStatuses = [
      healthChecks.database.status,
      healthChecks.environment.status,
      healthChecks.aiProviders.status
    ];
    
    const hasErrors = componentStatuses.includes('error');
    const hasUnhealthy = componentStatuses.includes('unhealthy');
    const hasWarnings = componentStatuses.includes('warning');
    
    let overallStatus: HealthStatus;
    if (hasErrors) {
      overallStatus = 'error';
    } else if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasWarnings) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'healthy';
    }

    const totalLatency = Date.now() - startTime;
    
    healthChecks.overall = {
      status: overallStatus,
      uptime: Math.floor(process.uptime()),
      responseTime: totalLatency,
      environment: process.env.NODE_ENV || 'unknown',
      version: process.env.npm_package_version || 'neon-v1.1-deployed'
    };

    // Construct response
    const healthResponse = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks: healthChecks,
      summary: {
        healthy: componentStatuses.filter(s => s === 'healthy').length,
        warning: componentStatuses.filter(s => s === 'warning').length,
        unhealthy: componentStatuses.filter(s => s === 'unhealthy').length,
        error: componentStatuses.filter(s => s === 'error').length,
        total: componentStatuses.length
      }
    };

    // Log health check result with both legacy and new logging
    logSecureInfo('System health check completed', {
      ...requestContext,
      statusCode: overallStatus === 'healthy' ? 200 : overallStatus === 'warning' ? 200 : 503,
    }, {
      overallStatus,
      responseTime: totalLatency,
      databaseStatus: healthChecks.database.status,
      aiProvidersCount: healthChecks.aiProviders.configured
    });

    // Enhanced logging for comprehensive monitoring
    const logStatus = overallStatus === 'error' ? 'unhealthy' : overallStatus as 'healthy' | 'unhealthy' | 'warning';
    logger.logHealthCheck('system_overall', logStatus, logContext, {
      totalLatency,
      summary: healthResponse.summary,
      components: {
        database: healthChecks.database.status,
        environment: healthChecks.environment.status,
        aiProviders: healthChecks.aiProviders.status,
        redis: healthChecks.redis.status
      }
    });

    // Return appropriate HTTP status based on health
    const httpStatus = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'warning' ? 200 : 503;

    logApiResponse(logContext, httpStatus, healthResponse);

    return NextResponse.json(healthResponse, {
      status: httpStatus,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'X-Health-Status': overallStatus,
        'X-Response-Time': `${totalLatency}ms`
      }
    });

  } catch (error) {
    const totalLatency = Date.now() - startTime;
    
    logSecureError('System health check failed', {
      ...requestContext,
      statusCode: 500,
    }, error instanceof Error ? error : undefined);

    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error',
      responseTime: totalLatency
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Status': 'error'
      }
    });
  }
}

// Detailed health information (admin endpoint)
export async function POST(request: NextRequest) {
  let requestContext;
  
  try {
    requestContext = createRequestContext(
      'detailed_health_check',
      'POST'
    );

    const { detailed = false } = await request.json().catch(() => ({}));
    
    if (!detailed) {
      return NextResponse.json({
        error: 'Set detailed: true to get detailed health information'
      }, { status: 400 });
    }

    // Get detailed system information
    const systemInfo = {
      process: {
        pid: process.pid,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        version: process.version,
        platform: process.platform,
        arch: process.arch
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV,
        hasDatabase: !!process.env.DATABASE_URL,
        hasRedis: envHelpers.hasRedis(),
        availableAiProviders: envHelpers.getAvailableAiProviders(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
      },
      database: await connectionPool.getMetrics(),
      configuration: connectionPool.getConfig()
    };

    logSecureInfo('Detailed health check completed', {
      ...requestContext,
      statusCode: 200,
    });

    return NextResponse.json({
      status: 'detailed_info',
      timestamp: new Date().toISOString(),
      system: systemInfo
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    logSecureError('Detailed health check failed', {
      ...requestContext || createRequestContext('detailed_health_check', 'POST'),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);

    return NextResponse.json({
      error: 'Detailed health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}