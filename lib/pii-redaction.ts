/**
 * PII Redaction Utility for Safe Logging
 * 
 * This module provides utilities to sanitize data before logging to ensure
 * compliance with GDPR, POPIA, and other data protection regulations.
 * 
 * Key principles:
 * - Default to redaction (fail-safe)
 * - Preserve data structure for debugging
 * - Configurable redaction levels
 * - Performance optimized for production logging
 */

// Types for redaction configuration
export interface RedactionConfig {
  mode: 'mask' | 'hash' | 'remove' | 'partial';
  preserveLength?: boolean;
  hashSalt?: string;
  customMask?: string;
}

export interface RedactionRule {
  field: string | RegExp;
  config: RedactionConfig;
  description?: string;
}

export type RedactionLevel = 'strict' | 'moderate' | 'minimal';

// Default redaction configurations
const DEFAULT_REDACTION_CONFIGS: Record<string, RedactionConfig> = {
  // Phone numbers - show last 3 digits for debugging
  phone: {
    mode: 'partial',
    preserveLength: true,
    customMask: 'X'
  },
  
  // Email addresses - show domain for debugging
  email: {
    mode: 'partial',
    preserveLength: false,
    customMask: '***'
  },
  
  // Names - completely mask for privacy
  name: {
    mode: 'mask',
    preserveLength: false,
    customMask: '[REDACTED]'
  },
  
  // Locations - partial redaction for operational needs
  location: {
    mode: 'partial',
    preserveLength: false,
    customMask: '***'
  },
  
  // Notes and comments - remove completely if they contain PII
  notes: {
    mode: 'mask',
    preserveLength: false,
    customMask: '[CONTENT_REDACTED]'
  },
  
  // IDs - keep for debugging (not PII but sensitive)
  id: {
    mode: 'partial',
    preserveLength: false,
    customMask: '***'
  },
  
  // Passwords and tokens - completely remove
  credential: {
    mode: 'remove',
    preserveLength: false
  }
};

// Predefined redaction rules for different data protection levels
const REDACTION_RULES: Record<RedactionLevel, RedactionRule[]> = {
  strict: [
    // Strict mode: Maximum privacy protection
    { field: /phone_?number/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Phone numbers' },
    { field: /email/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Email addresses' },
    { field: /name/i, config: DEFAULT_REDACTION_CONFIGS.name, description: 'Personal names' },
    { field: /location/i, config: DEFAULT_REDACTION_CONFIGS.name, description: 'Location data' },
    { field: /address/i, config: DEFAULT_REDACTION_CONFIGS.name, description: 'Addresses' },
    { field: /notes?/i, config: DEFAULT_REDACTION_CONFIGS.notes, description: 'Notes and comments' },
    { field: /comments?/i, config: DEFAULT_REDACTION_CONFIGS.notes, description: 'Comments' },
    { field: /password/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Passwords' },
    { field: /token/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API tokens' },
    { field: /secret/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Secrets' },
    { field: /key/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API keys' },
  ],
  
  moderate: [
    // Moderate mode: Balance between privacy and debugging
    { field: /phone_?number/i, config: DEFAULT_REDACTION_CONFIGS.phone, description: 'Phone numbers' },
    { field: /email/i, config: DEFAULT_REDACTION_CONFIGS.email, description: 'Email addresses' },
    { field: /name/i, config: DEFAULT_REDACTION_CONFIGS.name, description: 'Personal names' },
    { field: /location/i, config: DEFAULT_REDACTION_CONFIGS.location, description: 'Location data' },
    { field: /address/i, config: DEFAULT_REDACTION_CONFIGS.location, description: 'Addresses' },
    { field: /notes?/i, config: DEFAULT_REDACTION_CONFIGS.notes, description: 'Notes and comments' },
    { field: /password/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Passwords' },
    { field: /token/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API tokens' },
    { field: /secret/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Secrets' },
    { field: /key/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API keys' },
  ],
  
  minimal: [
    // Minimal mode: Only redact highly sensitive data
    { field: /password/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Passwords' },
    { field: /token/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API tokens' },
    { field: /secret/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'Secrets' },
    { field: /api_?key/i, config: DEFAULT_REDACTION_CONFIGS.credential, description: 'API keys' },
  ]
};

// Utility functions for different redaction modes
function maskValue(value: string, config: RedactionConfig): string {
  if (config.mode === 'remove') {
    return '[REMOVED]';
  }
  
  if (config.mode === 'mask') {
    if (config.preserveLength && value.length > 0) {
      return (config.customMask || '*').repeat(value.length);
    }
    return config.customMask || '[REDACTED]';
  }
  
  if (config.mode === 'partial') {
    return applyPartialRedaction(value, config);
  }
  
  if (config.mode === 'hash') {
    return hashValue(value, config.hashSalt);
  }
  
  return '[REDACTED]';
}

function applyPartialRedaction(value: string, config: RedactionConfig): string {
  if (!value || value.length === 0) return value;
  
  // Phone number partial redaction (+27123456789 -> +27******789)
  if (/^\+?[0-9\s\-\(\)]+$/.test(value)) {
    if (value.length <= 6) return maskValue(value, { ...config, mode: 'mask' });
    const start = value.substring(0, 3);
    const end = value.substring(value.length - 3);
    const middle = (config.customMask || '*').repeat(Math.max(0, value.length - 6));
    return `${start}${middle}${end}`;
  }
  
  // Email partial redaction (user@domain.com -> u***@domain.com)
  if (value.includes('@')) {
    const [localPart, domain] = value.split('@');
    if (localPart.length <= 1) return `${config.customMask || '***'}@${domain}`;
    const maskedLocal = localPart[0] + (config.customMask || '***');
    return `${maskedLocal}@${domain}`;
  }
  
  // Generic partial redaction (show first and last character for short strings)
  if (value.length <= 4) {
    return maskValue(value, { ...config, mode: 'mask' });
  }
  
  const start = value.substring(0, 1);
  const end = value.substring(value.length - 1);
  const middle = (config.customMask || '*').repeat(Math.max(0, value.length - 2));
  return `${start}${middle}${end}`;
}

function hashValue(value: string, salt?: string): string {
  // Simple hash for demonstration - in production, use crypto.createHash
  const combined = (salt || 'default_salt') + value;
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    const char = combined.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return `[HASH_${Math.abs(hash).toString(16).toUpperCase()}]`;
}

// Main redaction functions
export function redactValue(value: any, fieldName: string, level: RedactionLevel = 'moderate'): any {
  if (value === null || value === undefined) {
    return value;
  }
  
  // Convert to string for pattern matching
  const stringValue = String(value);
  
  // Find applicable redaction rule
  const rules = REDACTION_RULES[level];
  const applicableRule = rules.find(rule => {
    if (typeof rule.field === 'string') {
      return fieldName.toLowerCase().includes(rule.field.toLowerCase());
    }
    return rule.field.test(fieldName);
  });
  
  if (applicableRule) {
    return maskValue(stringValue, applicableRule.config);
  }
  
  // Auto-detection for common PII patterns
  if (typeof value === 'string') {
    // Phone number pattern detection
    if (/^\+?[1-9]\d{1,14}$/.test(value.replace(/[\s\-\(\)]/g, ''))) {
      return maskValue(value, DEFAULT_REDACTION_CONFIGS.phone);
    }
    
    // Email pattern detection
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return maskValue(value, DEFAULT_REDACTION_CONFIGS.email);
    }
    
    // Credit card pattern detection
    if (/^\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}$/.test(value)) {
      return maskValue(value, DEFAULT_REDACTION_CONFIGS.credential);
    }
  }
  
  return value;
}

export function redactObject(obj: any, level: RedactionLevel = 'moderate', maxDepth: number = 10): any {
  if (maxDepth <= 0) {
    return '[MAX_DEPTH_REACHED]';
  }
  
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // Handle primitives
  if (typeof obj !== 'object') {
    return obj;
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(item => redactObject(item, level, maxDepth - 1));
  }
  
  // Handle objects
  const redacted: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    try {
      if (typeof value === 'object' && value !== null) {
        redacted[key] = redactObject(value, level, maxDepth - 1);
      } else {
        redacted[key] = redactValue(value, key, level);
      }
    } catch (error) {
      // If redaction fails, err on the side of safety
      redacted[key] = '[REDACTION_ERROR]';
    }
  }
  
  return redacted;
}

// High-level utility functions for common use cases
export function redactForLogging(data: any, level: RedactionLevel = 'moderate'): any {
  try {
    return redactObject(data, level);
  } catch (error) {
    // If redaction completely fails, return safe placeholder
    return { error: 'DATA_REDACTION_FAILED', type: typeof data };
  }
}

export function redactUserData(userData: any): any {
  return redactObject(userData, 'strict');
}

export function redactErrorData(errorData: any): any {
  // Errors might contain sensitive data in messages or stack traces
  if (errorData && typeof errorData === 'object') {
    const redacted = { ...errorData };
    
    // Redact common error fields that might contain PII
    if (redacted.message) {
      redacted.message = redactForPII(redacted.message);
    }
    
    if (redacted.stack) {
      redacted.stack = redactForPII(redacted.stack);
    }
    
    // Redact any data properties
    if (redacted.data) {
      redacted.data = redactObject(redacted.data, 'moderate');
    }
    
    return redacted;
  }
  
  return errorData;
}

// Utility to redact PII from free-form text (like error messages)
export function redactForPII(text: string): string {
  if (!text || typeof text !== 'string') {
    return text;
  }
  
  let redacted = text;
  
  // Phone number patterns
  redacted = redacted.replace(/\+?[1-9]\d{1,14}/g, '[PHONE_REDACTED]');
  
  // Email patterns
  redacted = redacted.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL_REDACTED]');
  
  // Credit card patterns
  redacted = redacted.replace(/\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, '[CARD_REDACTED]');
  
  // South African ID numbers (13 digits)
  redacted = redacted.replace(/\b\d{13}\b/g, '[ID_REDACTED]');
  
  // Generic number sequences that might be sensitive (8+ digits)
  redacted = redacted.replace(/\b\d{8,}\b/g, '[NUMBER_REDACTED]');
  
  return redacted;
}

// Configuration and testing utilities
export function validateRedactionLevel(level: string): level is RedactionLevel {
  return ['strict', 'moderate', 'minimal'].includes(level);
}

export function getRedactionRules(level: RedactionLevel): RedactionRule[] {
  return REDACTION_RULES[level];
}

export function testRedaction(testData: any, level: RedactionLevel = 'moderate'): {
  original: any;
  redacted: any;
  rulesApplied: string[];
} {
  const redacted = redactObject(testData, level);
  const rules = getRedactionRules(level);
  
  return {
    original: testData,
    redacted,
    rulesApplied: rules.map(rule => rule.description || String(rule.field))
  };
}

// Environment-based configuration
export function getDefaultRedactionLevel(): RedactionLevel {
  const env = process.env.NODE_ENV;
  const configuredLevel = process.env.PII_REDACTION_LEVEL as RedactionLevel;
  
  if (configuredLevel && validateRedactionLevel(configuredLevel)) {
    return configuredLevel;
  }
  
  // Default levels based on environment
  switch (env) {
    case 'production':
      return 'strict';
    case 'development':
      return 'minimal';
    case 'test':
      return 'minimal';
    default:
      // For staging and other environments
      return 'moderate';
  }
}

// Export configured redaction function for easy use
export const safeLog = {
  /**
   * Redact data for safe logging with environment-appropriate level
   */
  redact: (data: any): any => {
    const level = getDefaultRedactionLevel();
    return redactForLogging(data, level);
  },
  
  /**
   * Redact user-specific data with strict privacy protection
   */
  user: (data: any): any => redactUserData(data),
  
  /**
   * Redact error data while preserving debugging information
   */
  error: (data: any): any => redactErrorData(data),
  
  /**
   * Redact free-form text for PII
   */
  text: (text: string): string => redactForPII(text)
};

// Integration with existing secure logger (if needed)
export function createPIISafeLogger(originalLogger: any) {
  return {
    log: (message: string, data?: any) => originalLogger.log(message, safeLog.redact(data)),
    info: (message: string, data?: any) => originalLogger.info(message, safeLog.redact(data)),
    warn: (message: string, data?: any) => originalLogger.warn(message, safeLog.redact(data)),
    error: (message: string, data?: any) => originalLogger.error(message, safeLog.error(data)),
    debug: (message: string, data?: any) => originalLogger.debug(message, safeLog.redact(data)),
  };
}