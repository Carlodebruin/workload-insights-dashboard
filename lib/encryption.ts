import crypto from 'crypto';
import { logSecureError, logSecureWarning } from './secure-logger';

// Encryption configuration
const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits for CBC mode
const TAG_LENGTH = 16; // 128 bits

/**
 * Get encryption key from environment or generate a secure warning
 */
function getEncryptionKey(): Buffer {
  const keyString = process.env.ENCRYPTION_KEY;
  
  if (!keyString) {
    const error = new Error('ENCRYPTION_KEY environment variable is required for API key storage');
    logSecureError('Missing encryption key', {
      operation: 'get_encryption_key',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error);
    throw error;
  }

  if (keyString.length < 32) {
    const error = new Error('ENCRYPTION_KEY must be at least 32 characters long');
    logSecureError('Weak encryption key', {
      operation: 'get_encryption_key',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error);
    throw error;
  }

  // Use the first 32 bytes of the key (or pad if shorter)
  return Buffer.from(keyString.padEnd(KEY_LENGTH, '0').substring(0, KEY_LENGTH), 'utf8');
}

/**
 * Encrypt sensitive data (like API keys)
 */
export function encrypt(plaintext: string): string {
  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Combine IV and encrypted data
    const result = iv.toString('hex') + ':' + encrypted;
    
    return result;
  } catch (error) {
    logSecureError('Encryption failed', {
      operation: 'encrypt',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt sensitive data
 */
export function decrypt(encryptedData: string): string {
  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logSecureError('Decryption failed', {
      operation: 'decrypt',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    throw new Error('Failed to decrypt data');
  }
}

/**
 * Hash sensitive data for comparison (one-way)
 */
export function hash(data: string, salt?: string): string {
  const actualSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(data, actualSalt, 10000, 64, 'sha256').toString('hex');
  return `${actualSalt}:${hash}`;
}

/**
 * Verify hashed data
 */
export function verifyHash(data: string, hashedData: string): boolean {
  try {
    const [salt, hash] = hashedData.split(':');
    const verifyHash = crypto.pbkdf2Sync(data, salt, 10000, 64, 'sha256').toString('hex');
    return hash === verifyHash;
  } catch (error) {
    logSecureError('Hash verification failed', {
      operation: 'verify_hash',
      timestamp: new Date().toISOString(),
      statusCode: 500,
    }, error instanceof Error ? error : undefined);
    return false;
  }
}

/**
 * Generate a secure random string for API key IDs
 */
export function generateSecureId(length: number = 32): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
}

/**
 * Mask API key for logging (show first 4 and last 4 characters)
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 8) {
    return '****';
  }
  
  const start = apiKey.substring(0, 4);
  const end = apiKey.substring(apiKey.length - 4);
  const middle = '*'.repeat(Math.max(4, apiKey.length - 8));
  
  return `${start}${middle}${end}`;
}

/**
 * Validate encryption key strength
 */
export function validateEncryptionKey(): {
  isValid: boolean;
  warnings: string[];
  recommendations: string[];
} {
  const warnings: string[] = [];
  const recommendations: string[] = [];
  
  const keyString = process.env.ENCRYPTION_KEY;
  
  if (!keyString) {
    return {
      isValid: false,
      warnings: ['ENCRYPTION_KEY environment variable is not set'],
      recommendations: [
        'Generate a strong 256-bit encryption key',
        'Set ENCRYPTION_KEY environment variable',
        'Use: openssl rand -hex 32'
      ]
    };
  }
  
  if (keyString.length < 32) {
    warnings.push('Encryption key is shorter than recommended 32 characters');
    recommendations.push('Use at least 32 characters for the encryption key');
  }
  
  if (keyString.length < 64) {
    recommendations.push('Consider using a 64-character key for maximum security');
  }
  
  // Check for common patterns
  if (keyString.includes('password') || keyString.includes('123') || keyString.includes('abc')) {
    warnings.push('Encryption key contains predictable patterns');
    recommendations.push('Use a cryptographically secure random key');
  }
  
  const isValid = warnings.length === 0 && keyString.length >= 32;
  
  return {
    isValid,
    warnings,
    recommendations
  };
}

/**
 * Secure cleanup - overwrite sensitive data in memory
 */
export function secureCleanup(sensitiveString: string): void {
  // In Node.js, we can't directly overwrite string memory,
  // but we can log the cleanup attempt for audit purposes
  logSecureWarning('Sensitive data cleanup requested', {
    operation: 'secure_cleanup',
    timestamp: new Date().toISOString(),
  });
}