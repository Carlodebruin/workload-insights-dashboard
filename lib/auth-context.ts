import { NextRequest } from 'next/server';
import { AuthenticatedUser, UserRole, authenticateRequest } from './auth';

/**
 * Server-side authentication context utilities for API routes
 */

/**
 * Gets the authenticated user from a request
 * This should be called in API routes to get user context
 */
export async function getAuthenticatedUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authResult = await authenticateRequest(request);
    return authResult.isAuthenticated ? authResult.user! : null;
  } catch (error) {
    console.error('Error getting authenticated user:', error);
    return null;
  }
}

/**
 * Requires authentication and returns user, throws error if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    throw new Error('Authentication required');
  }
  return user;
}

/**
 * Requires specific role and returns user, throws error if insufficient permissions
 */
export async function requireRole(request: NextRequest, requiredRole: UserRole): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  
  const roleHierarchy = {
    [UserRole.ADMIN]: 4,
    [UserRole.MANAGER]: 3,
    [UserRole.USER]: 2,
    [UserRole.VIEWER]: 1
  };

  if (roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    throw new Error(`Insufficient permissions. Required: ${requiredRole}, Current: ${user.role}`);
  }

  return user;
}

/**
 * Requires specific permission and returns user, throws error if insufficient permissions
 */
export async function requirePermission(request: NextRequest, permission: string): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);
  
  if (!user.permissions.includes(permission) && !user.permissions.includes('admin')) {
    throw new Error(`Missing required permission: ${permission}`);
  }

  return user;
}

/**
 * Checks if user owns a resource (for data access control)
 */
export function isResourceOwner(user: AuthenticatedUser, resourceUserId: string): boolean {
  return user.id === resourceUserId || user.permissions.includes('admin');
}

/**
 * Authorization wrapper for API route handlers
 */
export function withAuth<T extends any[]>(
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const user = await requireAuth(request);
      return await handler(request, user, ...args);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Authentication required',
          message: error instanceof Error ? error.message : 'Unknown authentication error'
        }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Role-based authorization wrapper for API route handlers
 */
export function withRole<T extends any[]>(
  requiredRole: UserRole,
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const user = await requireRole(request, requiredRole);
      return await handler(request, user, ...args);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions',
          message: error instanceof Error ? error.message : 'Unknown authorization error'
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Permission-based authorization wrapper for API route handlers
 */
export function withPermission<T extends any[]>(
  permission: string,
  handler: (request: NextRequest, user: AuthenticatedUser, ...args: T) => Promise<Response>
) {
  return async (request: NextRequest, ...args: T): Promise<Response> => {
    try {
      const user = await requirePermission(request, permission);
      return await handler(request, user, ...args);
    } catch (error) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient permissions',
          message: error instanceof Error ? error.message : 'Unknown authorization error'
        }),
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
}

/**
 * Demo token helper for testing
 */
export function getDemoTokens(): Record<string, string> {
  return {
    admin: 'demo-admin-token',
    manager: 'demo-manager-token',
    user: 'demo-user-token',
    viewer: 'demo-viewer-token'
  };
}

/**
 * Creates authorization header for testing
 */
export function createAuthHeader(token: string): Record<string, string> {
  return {
    'Authorization': `Bearer ${token}`
  };
}