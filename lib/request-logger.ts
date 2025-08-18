import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

// Request logging middleware for comprehensive API monitoring
export function withRequestLogging(request: NextRequest, response: NextResponse): NextResponse {
  // Extract operation name from URL path
  const pathSegments = request.nextUrl.pathname.split('/').filter(Boolean);
  const operation = pathSegments.slice(1).join('_') || 'unknown'; // Remove 'api' prefix

  // Create logging context
  const logContext = logger.extractRequestContext(request, operation);

  // Log incoming request
  logger.info(`${request.method} ${request.nextUrl.pathname} - Request started`, logContext, {
    userAgent: request.headers.get('user-agent'),
    contentType: request.headers.get('content-type'),
    contentLength: request.headers.get('content-length'),
    authorization: request.headers.get('authorization') ? 'present' : 'missing',
  });

  // Start performance tracking
  logger.startPerformanceTracking(logContext.requestId);

  // Add request ID to response headers for correlation
  response.headers.set('X-Request-ID', logContext.requestId);
  response.headers.set('X-Request-Start', logContext.timestamp);

  return response;
}

// Response logging helper
export function logRequestCompletion(
  requestId: string,
  method: string,
  pathname: string,
  statusCode: number,
  responseSize?: number
): void {
  const operation = pathname.split('/').filter(Boolean).slice(1).join('_') || 'unknown';
  const metrics = logger.endPerformanceTracking(requestId);

  const logContext = {
    requestId,
    operation,
    method,
    timestamp: new Date().toISOString(),
    url: pathname,
    statusCode,
    duration: metrics?.duration,
    memoryUsage: metrics ? metrics.memoryAfter - metrics.memoryBefore : undefined,
  };

  // Determine log level based on status code
  const isError = statusCode >= 400;
  const isWarning = statusCode >= 300 && statusCode < 400;

  if (isError) {
    logger.error(`${method} ${pathname} - ${statusCode} (${metrics?.duration}ms)`, logContext);
  } else if (isWarning) {
    logger.warn(`${method} ${pathname} - ${statusCode} (${metrics?.duration}ms)`, logContext);
  } else {
    logger.info(`${method} ${pathname} - ${statusCode} (${metrics?.duration}ms)`, logContext, {
      responseSize,
      performance: metrics,
    });
  }
}

// Rate limiting logging helper
export function logRateLimitEvent(
  request: NextRequest,
  limit: number,
  remaining: number,
  resetTime: number,
  blocked: boolean = false
): void {
  const operation = request.nextUrl.pathname.split('/').filter(Boolean).slice(1).join('_') || 'unknown';
  const logContext = logger.extractRequestContext(request, operation);

  if (blocked) {
    logger.logSecurityEvent('rate_limit_exceeded', 'medium', logContext, {
      limit,
      remaining,
      resetTime,
      ipAddress: logContext.ipAddress,
      userAgent: logContext.userAgent,
    });
  } else {
    logger.logRateLimit(logContext, limit, remaining, resetTime);
  }
}

// Authentication logging helpers
export function logAuthenticationAttempt(
  request: NextRequest,
  success: boolean,
  userId?: string,
  reason?: string
): void {
  const operation = request.nextUrl.pathname.split('/').filter(Boolean).slice(1).join('_') || 'auth';
  const logContext = {
    ...logger.extractRequestContext(request, operation),
    userId,
  };

  if (success) {
    logger.logAuth('login', logContext, { method: 'bearer_token' });
  } else {
    logger.logAuth('auth_failed', logContext, { reason });
  }
}

export function logAuthorizationFailure(
  request: NextRequest,
  userId?: string,
  requiredPermission?: string
): void {
  const operation = request.nextUrl.pathname.split('/').filter(Boolean).slice(1).join('_') || 'auth';
  const logContext = {
    ...logger.extractRequestContext(request, operation),
    userId,
  };

  logger.logAuth('permission_denied', logContext, {
    requiredPermission,
    requestedResource: request.nextUrl.pathname,
  });
}

// CSRF logging helpers
export function logCSRFViolation(
  request: NextRequest,
  reason: string
): void {
  const operation = request.nextUrl.pathname.split('/').filter(Boolean).slice(1).join('_') || 'csrf';
  const logContext = logger.extractRequestContext(request, operation);

  logger.logSecurityEvent('csrf_violation', 'high', logContext, {
    reason,
    origin: request.headers.get('origin'),
    referer: request.headers.get('referer'),
    method: request.method,
  });
}

// Validation error logging
export function logValidationError(
  request: NextRequest,
  field: string,
  value: any,
  expectedType: string
): void {
  const operation = request.nextUrl.pathname.split('/').filter(Boolean).slice(1).join('_') || 'validation';
  const logContext = logger.extractRequestContext(request, operation);

  logger.warn('Validation error in API request', logContext, {
    field,
    expectedType,
    receivedType: typeof value,
    // Don't log the actual value to prevent PII exposure
  });
}

// Database operation logging from API context
export function logDatabaseOperationFromAPI(
  requestId: string,
  operation: string,
  duration: number,
  recordCount?: number,
  error?: Error
): void {
  const logContext = {
    requestId,
    operation: `db_${operation}`,
    timestamp: new Date().toISOString(),
    tags: ['database', 'api'],
  };

  logger.logDatabaseOperation(operation, logContext, duration, recordCount, error);
}

// Business event logging from API context
export function logBusinessEventFromAPI(
  requestId: string,
  event: string,
  data?: any
): void {
  const logContext = {
    requestId,
    operation: `business_${event}`,
    timestamp: new Date().toISOString(),
    tags: ['business', 'api'],
  };

  logger.logBusinessEvent(event, logContext, data);
}

// Export structured error information for API responses
export interface APIErrorInfo {
  requestId: string;
  timestamp: string;
  operation: string;
  errorCode: string;
  message: string;
  statusCode: number;
}

export function createAPIErrorInfo(
  requestId: string,
  operation: string,
  error: Error,
  statusCode: number
): APIErrorInfo {
  return {
    requestId,
    timestamp: new Date().toISOString(),
    operation,
    errorCode: error.constructor.name,
    message: error.message,
    statusCode,
  };
}