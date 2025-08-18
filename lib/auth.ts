import { NextRequest } from 'next/server';
import { logger } from './logger';

// Authentication configuration
const AUTH_CONFIG = {
  // For development/demo purposes - in production, use proper JWT validation
  validTokens: new Set([
    'demo-admin-token',
    'demo-user-token',
    'demo-manager-token',
    'demo-viewer-token'
  ]),
  
  // Token expiration time (24 hours)
  tokenExpirationMs: 24 * 60 * 60 * 1000,
  
  // Environment-specific settings
  requireAuth: process.env.NODE_ENV === 'production' || process.env.REQUIRE_AUTH === 'true'
};

// User roles and permissions
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager', 
  USER = 'user',
  VIEWER = 'viewer'
}

// User interface
export interface AuthenticatedUser {
  id: string;
  role: UserRole;
  email?: string;
  name?: string;
  permissions: string[];
}

// Token payload interface
interface TokenPayload {
  userId: string;
  role: UserRole;
  email?: string;
  name?: string;
  iat: number;
  exp: number;
}

// Authentication result
export interface AuthResult {
  isAuthenticated: boolean;
  user?: AuthenticatedUser;
  error?: string;
}

// Demo user mapping (for development/demo purposes)
const DEMO_USERS: Record<string, AuthenticatedUser> = {
  'demo-admin-token': {
    id: 'admin-1',
    role: UserRole.ADMIN,
    email: 'admin@company.com',
    name: 'System Administrator',
    permissions: ['read', 'write', 'delete', 'admin']
  },
  'demo-manager-token': {
    id: 'manager-1',
    role: UserRole.MANAGER,
    email: 'manager@company.com',
    name: 'Team Manager',
    permissions: ['read', 'write', 'manage_team']
  },
  'demo-user-token': {
    id: 'user-1',
    role: UserRole.USER,
    email: 'user@company.com',
    name: 'Regular User',
    permissions: ['read', 'write_own']
  },
  'demo-viewer-token': {
    id: 'viewer-1',
    role: UserRole.VIEWER,
    email: 'viewer@company.com',
    name: 'Read Only User',
    permissions: ['read']
  }
};

/**
 * Validates a Bearer token and returns authentication result
 */
export async function validateToken(token: string): Promise<AuthResult> {
  try {
    if (!token || token.trim() === '') {
      return {
        isAuthenticated: false,
        error: 'No token provided'
      };
    }

    // For development/demo: Use predefined tokens
    if (process.env.NODE_ENV === 'development' || !AUTH_CONFIG.requireAuth) {
      if (DEMO_USERS[token]) {
        return {
          isAuthenticated: true,
          user: DEMO_USERS[token]
        };
      }
    }

    // For production: Implement proper JWT validation
    if (process.env.NODE_ENV === 'production' && process.env.JWT_SECRET) {
      return await validateJWTToken(token);
    }

    // Fallback: Basic token validation for demo purposes
    if (AUTH_CONFIG.validTokens.has(token)) {
      return {
        isAuthenticated: true,
        user: DEMO_USERS[token] || {
          id: 'unknown',
          role: UserRole.USER,
          permissions: ['read']
        }
      };
    }

    return {
      isAuthenticated: false,
      error: 'Invalid token'
    };

  } catch (error) {
    logger.error('Token validation error', {
      operation: 'validate_token',
      timestamp: new Date().toISOString()
    }, error);

    return {
      isAuthenticated: false,
      error: 'Token validation failed'
    };
  }
}

/**
 * JWT token validation (for production use)
 */
async function validateJWTToken(token: string): Promise<AuthResult> {
  try {
    // In a real implementation, you would:
    // 1. Verify JWT signature using JWT_SECRET
    // 2. Check token expiration
    // 3. Validate token claims
    // 4. Check if token is in blacklist/revoked
    // 5. Load user data from database
    
    // For now, return a basic implementation
    // TODO: Implement proper JWT validation with jsonwebtoken library
    
    return {
      isAuthenticated: false,
      error: 'JWT validation not yet implemented'
    };
    
  } catch (error) {
    return {
      isAuthenticated: false,
      error: 'JWT validation failed'
    };
  }
}

/**
 * Extracts and validates Bearer token from request
 */
export async function authenticateRequest(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader) {
    return {
      isAuthenticated: false,
      error: 'Authorization header missing'
    };
  }

  if (!authHeader.startsWith('Bearer ')) {
    return {
      isAuthenticated: false,
      error: 'Invalid authorization header format'
    };
  }

  const token = authHeader.substring(7); // Remove "Bearer " prefix
  return await validateToken(token);
}

/**
 * Checks if user has required permission
 */
export function hasPermission(user: AuthenticatedUser, permission: string): boolean {
  return user.permissions.includes(permission) || user.permissions.includes('admin');
}

/**
 * Checks if user has required role
 */
export function hasRole(user: AuthenticatedUser, requiredRole: UserRole): boolean {
  const roleHierarchy = {
    [UserRole.ADMIN]: 4,
    [UserRole.MANAGER]: 3,
    [UserRole.USER]: 2,
    [UserRole.VIEWER]: 1
  };

  return roleHierarchy[user.role] >= roleHierarchy[requiredRole];
}

/**
 * Gets user context from request (for authenticated requests)
 */
export async function getUserFromRequest(request: NextRequest): Promise<AuthenticatedUser | null> {
  const authResult = await authenticateRequest(request);
  return authResult.isAuthenticated ? authResult.user! : null;
}

/**
 * Creates a demo token for testing (development only)
 */
export function createDemoToken(role: UserRole): string {
  const tokenMap = {
    [UserRole.ADMIN]: 'demo-admin-token',
    [UserRole.MANAGER]: 'demo-manager-token',
    [UserRole.USER]: 'demo-user-token',
    [UserRole.VIEWER]: 'demo-viewer-token'
  };

  return tokenMap[role];
}

/**
 * Authentication utilities for middleware
 */
export const authUtils = {
  validateToken,
  authenticateRequest,
  hasPermission,
  hasRole,
  getUserFromRequest,
  createDemoToken
};

// Export types
export type { TokenPayload };