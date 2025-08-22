// Secure logging utility to prevent PII exposure and ensure GDPR/POPIA compliance
import { safeLog, redactForPII } from './pii-redaction';

interface LogContext {
  operation: string;
  timestamp: string;
  userId?: string;
  activityId?: string;
  categoryId?: string;
  method?: string;
  statusCode?: number;
  errorType?: string;
  requestId?: string;
  count?: number;
}

type HealthStatus = 'healthy' | 'warning' | 'unhealthy';

// Safe error logging that excludes PII and sensitive data
export function logSecureError(
  message: string,
  context: LogContext,
  error?: Error,
  additionalData?: any
): void {
  const logEntry = {
    level: 'error',
    message: redactForPII(message), // Redact PII from error messages
    timestamp: context.timestamp,
    operation: context.operation,
    ...(context.userId && { userId: context.userId }),
    ...(context.activityId && { activityId: context.activityId }),
    ...(context.categoryId && { categoryId: context.categoryId }),
    ...(context.method && { method: context.method }),
    ...(context.statusCode && { statusCode: context.statusCode }),
    ...(context.requestId && { requestId: context.requestId }),
    // Only log error type/name, never the full error object or stack trace
    ...(error && { 
      errorType: error.constructor.name,
      errorMessage: redactForPII(error.message) // Redact PII from error messages
    }),
    // Safely include additional data with PII redaction
    ...(additionalData && { data: safeLog.redact(additionalData) }),
  };

  // In production, this should be sent to a structured logging service
  // that supports PII redaction and compliance features
  console.error(JSON.stringify(logEntry));
}

// Safe info logging for operational events
export function logSecureInfo(
  message: string,
  context: LogContext,
  additionalData?: any
): void {
  const logEntry = {
    level: 'info',
    message: redactForPII(message), // Redact PII from info messages
    timestamp: context.timestamp,
    operation: context.operation,
    ...(context.userId && { userId: context.userId }),
    ...(context.activityId && { activityId: context.activityId }),
    ...(context.categoryId && { categoryId: context.categoryId }),
    ...(context.method && { method: context.method }),
    ...(context.statusCode && { statusCode: context.statusCode }),
    ...(context.requestId && { requestId: context.requestId }),
    // Safely include additional data with PII redaction
    ...(additionalData && { data: safeLog.redact(additionalData) }),
  };

  console.log(JSON.stringify(logEntry));
}

// Safe warning logging
export function logSecureWarning(
  message: string,
  context: LogContext,
  additionalData?: any
): void {
  const logEntry = {
    level: 'warning',
    message: redactForPII(message), // Redact PII from warning messages
    timestamp: context.timestamp,
    operation: context.operation,
    ...(context.userId && { userId: context.userId }),
    ...(context.activityId && { activityId: context.activityId }),
    ...(context.categoryId && { categoryId: context.categoryId }),
    ...(context.method && { method: context.method }),
    ...(context.statusCode && { statusCode: context.statusCode }),
    ...(context.requestId && { requestId: context.requestId }),
    // Safely include additional data with PII redaction
    ...(additionalData && { data: safeLog.redact(additionalData) }),
  };

  console.warn(JSON.stringify(logEntry));
}

// Utility to generate request ID for correlation
export function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Health check logging
export function logHealthCheck(
  component: string,
  status: HealthStatus,
  context: LogContext,
  additionalData?: any
): void {
  const logEntry = {
    level: 'info',
    message: `Health check: ${component}`,
    status,
    timestamp: context.timestamp,
    operation: context.operation,
    requestId: context.requestId,
    component,
    ...(additionalData && { details: additionalData })
  };

  console.log(JSON.stringify(safeLog.redact(logEntry)));
}

// Utility to extract safe user ID from request body
export function extractSafeUserId(body: any): string | undefined {
  // Only extract user_id if it matches CUID format (safe identifier)
  if (body?.user_id && typeof body.user_id === 'string' && body.user_id.match(/^c[a-z0-9]{24}$/)) {
    return body.user_id;
  }
  return undefined;
}

// Utility to create base context for request logging
export function createRequestContext(
  operation: string,
  method: string,
  userId?: string,
  activityId?: string,
  categoryId?: string
): LogContext {
  return {
    operation,
    method,
    timestamp: new Date().toISOString(),
    requestId: generateRequestId(),
    ...(userId && { userId }),
    ...(activityId && { activityId }),
    ...(categoryId && { categoryId }),
  };
}