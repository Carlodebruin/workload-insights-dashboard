import { NextRequest } from 'next/server';
import { logSecureError, logSecureInfo, logSecureWarning, generateRequestId, createRequestContext } from './secure-logger';
import { redactForPII } from './pii-redaction';
import { env } from './env-validation';

// Enhanced logging levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

// Extended log context for comprehensive monitoring
export interface EnhancedLogContext {
  // Core context
  requestId: string;
  operation: string;
  method?: string;
  timestamp: string;
  
  // Request context
  url?: string;
  userAgent?: string;
  ipAddress?: string;
  origin?: string;
  
  // User context
  userId?: string;
  userRole?: string;
  
  // Business context
  activityId?: string;
  categoryId?: string;
  
  // Performance context
  duration?: number;
  memoryUsage?: number;
  
  // Response context
  statusCode?: number;
  responseSize?: number;
  
  // Error context
  errorType?: string;
  errorCode?: string;
  stackTrace?: string;
  
  // Custom metadata
  tags?: string[];
  environment?: string;
  
  // Security context
  authMethod?: string;
  permissions?: string[];
}

// Error classification for better tracking
export enum ErrorCategory {
  VALIDATION = 'validation',
  AUTHENTICATION = 'authentication',
  AUTHORIZATION = 'authorization',
  DATABASE = 'database',
  EXTERNAL_API = 'external_api',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  NETWORK = 'network',
  UNKNOWN = 'unknown'
}

// Performance metrics interface
export interface PerformanceMetrics {
  duration: number;
  memoryBefore: number;
  memoryAfter: number;
  cpuUsage?: number;
  dbQueries?: number;
  apiCalls?: number;
}

// Application logger class with comprehensive monitoring capabilities
export class ApplicationLogger {
  private static instance: ApplicationLogger;
  private startTimes: Map<string, number> = new Map();
  private memorySnapshots: Map<string, number> = new Map();

  private constructor() {}

  public static getInstance(): ApplicationLogger {
    if (!ApplicationLogger.instance) {
      ApplicationLogger.instance = new ApplicationLogger();
    }
    return ApplicationLogger.instance;
  }

  // Extract request context from Next.js request
  public extractRequestContext(request: NextRequest, operation: string): EnhancedLogContext {
    const requestId = request.headers.get('x-request-id') || generateRequestId();
    const userAgent = request.headers.get('user-agent') || 'unknown';
    const origin = request.headers.get('origin') || request.headers.get('referer') || 'unknown';
    
    // Extract IP address (considering proxy headers)
    const ipAddress = 
      request.headers.get('x-forwarded-for')?.split(',')[0] ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') || // Cloudflare
      request.ip ||
      'unknown';

    return {
      requestId,
      operation,
      method: request.method,
      timestamp: new Date().toISOString(),
      url: request.url,
      userAgent: redactForPII(userAgent), // Redact potential PII from user agent
      ipAddress: this.anonymizeIP(ipAddress), // Anonymize IP for privacy
      origin: redactForPII(origin),
      environment: env.NODE_ENV,
    };
  }

  // Start performance tracking for an operation
  public startPerformanceTracking(requestId: string): void {
    this.startTimes.set(requestId, Date.now());
    this.memorySnapshots.set(requestId, process.memoryUsage().heapUsed);
  }

  // End performance tracking and get metrics
  public endPerformanceTracking(requestId: string): PerformanceMetrics | null {
    const startTime = this.startTimes.get(requestId);
    const memoryBefore = this.memorySnapshots.get(requestId);
    
    if (!startTime || !memoryBefore) {
      return null;
    }

    const duration = Date.now() - startTime;
    const memoryAfter = process.memoryUsage().heapUsed;
    
    // Clean up tracking data
    this.startTimes.delete(requestId);
    this.memorySnapshots.delete(requestId);

    return {
      duration,
      memoryBefore,
      memoryAfter,
    };
  }

  // Enhanced logging methods
  public debug(message: string, context: Partial<EnhancedLogContext>, data?: any): void {
    if (env.LOG_LEVEL === 'debug' || env.NODE_ENV === 'development') {
      this.log('debug', message, context, data);
    }
  }

  public info(message: string, context: Partial<EnhancedLogContext>, data?: any): void {
    this.log('info', message, context, data);
  }

  public warn(message: string, context: Partial<EnhancedLogContext>, data?: any): void {
    this.log('warn', message, context, data);
  }

  public error(message: string, context: Partial<EnhancedLogContext>, error?: Error | unknown, data?: any): void {
    const enhancedContext = { ...context };
    
    if (error) {
      if (error instanceof Error) {
        enhancedContext.errorType = error.constructor.name;
        enhancedContext.stackTrace = this.sanitizeStackTrace(error.stack);
      } else {
        enhancedContext.errorType = typeof error;
      }
    }

    this.log('error', message, enhancedContext, data);
  }

  public fatal(message: string, context: Partial<EnhancedLogContext>, error?: Error | unknown, data?: any): void {
    const enhancedContext = { ...context };
    
    if (error) {
      if (error instanceof Error) {
        enhancedContext.errorType = error.constructor.name;
        enhancedContext.stackTrace = this.sanitizeStackTrace(error.stack);
      }
    }

    this.log('fatal', message, enhancedContext, data);
  }

  // Categorized error logging
  public logError(
    category: ErrorCategory,
    message: string,
    context: Partial<EnhancedLogContext>,
    error?: Error | unknown,
    data?: any
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), `error:${category}`],
      errorCode: category,
    };

    this.error(message, enhancedContext, error, data);
  }

  // API request/response logging
  public logRequest(context: EnhancedLogContext, requestBody?: any): void {
    this.startPerformanceTracking(context.requestId);
    
    this.info(`${context.method} ${context.url} - Request started`, context, {
      requestBody: requestBody ? redactForPII(JSON.stringify(requestBody)) : undefined,
    });
  }

  public logResponse(
    context: EnhancedLogContext,
    statusCode: number,
    responseSize?: number,
    responseBody?: any
  ): void {
    const metrics = this.endPerformanceTracking(context.requestId);
    
    const enhancedContext = {
      ...context,
      statusCode,
      responseSize,
      duration: metrics?.duration,
      memoryUsage: metrics ? metrics.memoryAfter - metrics.memoryBefore : undefined,
    };

    const logLevel = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
    const message = `${context.method} ${context.url} - ${statusCode} (${metrics?.duration}ms)`;

    this.log(logLevel, message, enhancedContext, {
      responseBody: responseBody ? redactForPII(JSON.stringify(responseBody)) : undefined,
      metrics,
    });
  }

  // Database operation logging
  public logDatabaseOperation(
    operation: string,
    context: Partial<EnhancedLogContext>,
    duration?: number,
    recordCount?: number,
    error?: Error
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'database'],
      duration,
    };

    if (error) {
      this.logError(
        ErrorCategory.DATABASE,
        `Database operation failed: ${operation}`,
        enhancedContext,
        error,
        { recordCount }
      );
    } else {
      this.info(
        `Database operation completed: ${operation}`,
        enhancedContext,
        { recordCount, duration }
      );
    }
  }

  // Authentication/Authorization logging
  public logAuth(
    event: 'login' | 'logout' | 'auth_failed' | 'permission_denied',
    context: Partial<EnhancedLogContext>,
    details?: any
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'auth'],
    };

    switch (event) {
      case 'login':
        this.info('User authentication successful', enhancedContext, details);
        break;
      case 'logout':
        this.info('User logout', enhancedContext, details);
        break;
      case 'auth_failed':
        this.logError(
          ErrorCategory.AUTHENTICATION,
          'Authentication failed',
          enhancedContext,
          undefined,
          details
        );
        break;
      case 'permission_denied':
        this.logError(
          ErrorCategory.AUTHORIZATION,
          'Permission denied',
          enhancedContext,
          undefined,
          details
        );
        break;
    }
  }

  // Business logic event logging
  public logBusinessEvent(
    event: string,
    context: Partial<EnhancedLogContext>,
    data?: any
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'business'],
    };

    this.info(`Business event: ${event}`, enhancedContext, data);
  }

  // Security event logging
  public logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: Partial<EnhancedLogContext>,
    details?: any
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'security', `severity:${severity}`],
    };

    const logLevel = severity === 'critical' ? 'fatal' : severity === 'high' ? 'error' : 'warn';
    this.log(logLevel, `Security event: ${event}`, enhancedContext, details);
  }

  // Rate limiting logging
  public logRateLimit(
    context: Partial<EnhancedLogContext>,
    limit: number,
    remaining: number,
    resetTime: number
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'rate-limit'],
    };

    if (remaining <= 0) {
      this.warn('Rate limit exceeded', enhancedContext, {
        limit,
        remaining,
        resetTime,
      });
    } else if (remaining <= limit * 0.1) {
      this.info('Rate limit warning', enhancedContext, {
        limit,
        remaining,
        resetTime,
      });
    }
  }

  // Health check logging
  public logHealthCheck(
    component: string,
    status: 'healthy' | 'unhealthy' | 'warning',
    context: Partial<EnhancedLogContext>,
    metrics?: any
  ): void {
    const enhancedContext = {
      ...context,
      tags: [...(context.tags || []), 'health-check', component],
    };

    const logLevel = status === 'unhealthy' ? 'error' : status === 'warning' ? 'warn' : 'info';
    this.log(logLevel, `Health check: ${component} - ${status}`, enhancedContext, metrics);
  }

  // Private helper methods
  private log(level: LogLevel, message: string, context: Partial<EnhancedLogContext>, data?: any): void {
    const logEntry = {
      level,
      message: redactForPII(message),
      timestamp: context.timestamp || new Date().toISOString(),
      requestId: context.requestId,
      operation: context.operation,
      environment: context.environment || env.NODE_ENV,
      ...this.sanitizeContext(context),
      ...(data && { data: redactForPII(JSON.stringify(data)) }),
    };

    // Use existing secure logging functions for output
    switch (level) {
      case 'debug':
      case 'info':
        console.log(JSON.stringify(logEntry));
        break;
      case 'warn':
        console.warn(JSON.stringify(logEntry));
        break;
      case 'error':
      case 'fatal':
        console.error(JSON.stringify(logEntry));
        break;
    }

    // In production, also send to external monitoring service
    if (env.NODE_ENV === 'production') {
      this.sendToMonitoringService(logEntry);
    }
  }

  private sanitizeContext(context: Partial<EnhancedLogContext>): any {
    const sanitized = { ...context };
    
    // Remove sensitive fields that shouldn't be logged
    delete sanitized.stackTrace; // Handle separately
    
    // Sanitize URLs to remove query parameters that might contain sensitive data
    if (sanitized.url) {
      try {
        const url = new URL(sanitized.url);
        sanitized.url = `${url.protocol}//${url.host}${url.pathname}`;
      } catch {
        // Keep original if URL parsing fails
      }
    }

    return sanitized;
  }

  private sanitizeStackTrace(stackTrace?: string): string {
    if (!stackTrace) return '';
    
    // Remove file paths and only keep function names and line numbers
    return stackTrace
      .split('\n')
      .slice(0, 10) // Limit stack trace depth
      .map(line => {
        // Remove full file paths, keep only filename and line number
        return line.replace(/\/.*\//g, '').replace(/\(.+:/g, '(');
      })
      .join('\n');
  }

  private anonymizeIP(ip: string): string {
    if (ip === 'unknown' || !ip) return 'unknown';
    
    // IPv4 anonymization (remove last octet)
    if (ip.includes('.')) {
      const parts = ip.split('.');
      if (parts.length === 4) {
        return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
      }
    }
    
    // IPv6 anonymization (remove last 64 bits)
    if (ip.includes(':')) {
      const parts = ip.split(':');
      if (parts.length >= 4) {
        return `${parts.slice(0, 4).join(':')}::xxxx`;
      }
    }
    
    return 'anonymized';
  }

  private sendToMonitoringService(logEntry: any): void {
    // In production, integrate with monitoring services like:
    // - Sentry for error tracking
    // - DataDog for application monitoring
    // - CloudWatch for AWS deployments
    // - Application Insights for Azure
    
    // Example integration points:
    if (logEntry.level === 'error' || logEntry.level === 'fatal') {
      // Send to error tracking service
      // Sentry.captureException(logEntry);
    }
    
    // Send to application monitoring
    // DataDog.increment('app.logs', 1, [`level:${logEntry.level}`]);
    
    // For now, just ensure it's properly formatted for external consumption
    // External monitoring services would be configured here
  }
}

// Singleton instance
export const logger = ApplicationLogger.getInstance();

// Convenience functions for common use cases
export const logApiRequest = (request: NextRequest, operation: string, body?: any) => {
  const context = logger.extractRequestContext(request, operation);
  logger.logRequest(context, body);
  return context; // Return context for use in response logging
};

export const logApiResponse = (
  context: EnhancedLogContext,
  statusCode: number,
  responseBody?: any,
  responseSize?: number
) => {
  logger.logResponse(context, statusCode, responseSize, responseBody);
};

export const logApiError = (
  context: Partial<EnhancedLogContext>,
  error: Error | unknown,
  category: ErrorCategory = ErrorCategory.UNKNOWN
) => {
  logger.logError(category, 'API request failed', context, error);
};

// Request correlation middleware helper
export const withRequestLogging = (operation: string) => {
  return (request: NextRequest) => {
    const context = logger.extractRequestContext(request, operation);
    logger.startPerformanceTracking(context.requestId);
    return context;
  };
};

// Types are already exported above