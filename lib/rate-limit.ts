import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Redis client
// For development/demo purposes, we'll use an in-memory store
// In production, you should use Upstash Redis with UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
const redis = process.env.UPSTASH_REDIS_REST_URL 
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : undefined;

// Rate limiting configurations for different endpoint types
export const rateLimits = {
  // General API endpoints - 60 requests per minute
  general: new Ratelimit({
    redis: redis || new Map() as any, // Fallback to in-memory for development
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    analytics: true,
    prefix: "ratelimit:general",
  }),

  // Authentication-sensitive endpoints - 5 requests per minute
  auth: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:auth",
  }),

  // AI/Chat endpoints - 10 requests per minute (more expensive operations)
  ai: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    analytics: true,
    prefix: "ratelimit:ai",
  }),

  // Data retrieval endpoints - 100 requests per minute (read-heavy)
  read: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(100, "1 m"),
    analytics: true,
    prefix: "ratelimit:read",
  }),

  // Write operations - 30 requests per minute
  write: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    analytics: true,
    prefix: "ratelimit:write",
  }),

  // File upload endpoints - 5 requests per minute
  upload: new Ratelimit({
    redis: redis || new Map() as any,
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    analytics: true,
    prefix: "ratelimit:upload",
  }),
};

// Helper function to get client identifier (IP address with fallbacks)
export function getClientIdentifier(request: NextRequest): string {
  // Try to get real IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfConnectingIp = request.headers.get('cf-connecting-ip');
  
  // Extract IP from forwarded header (first IP in comma-separated list)
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  // Use other IP headers
  if (realIp) return realIp;
  if (cfConnectingIp) return cfConnectingIp;
  
  // Fallback to a default identifier for development
  return 'anonymous';
}

// Rate limiting middleware function
export async function withRateLimit(
  request: NextRequest,
  rateLimitType: keyof typeof rateLimits = 'general'
): Promise<NextResponse | null> {
  try {
    const identifier = getClientIdentifier(request);
    const ratelimit = rateLimits[rateLimitType];
    
    const { success, limit, reset, remaining } = await ratelimit.limit(identifier);
    
    if (!success) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${limit} requests per minute.`,
          retryAfter: Math.round((reset - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.round((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
    
    // Rate limit passed, return null to continue
    return null;
  } catch (error) {
    // Log error but don't block requests if rate limiting fails
    console.error('Rate limiting error:', error);
    return null;
  }
}

// Decorator function for API routes
export function rateLimit(type: keyof typeof rateLimits = 'general') {
  return function (handler: (request: NextRequest, ...args: any[]) => Promise<NextResponse>) {
    return async function (request: NextRequest, ...args: any[]): Promise<NextResponse> {
      // Check rate limit first
      const rateLimitResponse = await withRateLimit(request, type);
      if (rateLimitResponse) {
        return rateLimitResponse;
      }
      
      // Rate limit passed, execute the original handler
      return handler(request, ...args);
    };
  };
}

// Utility function to check if Redis is configured
export function isRedisConfigured(): boolean {
  return !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);
}

// Utility function to get rate limit status without consuming a request
export async function getRateLimitStatus(
  request: NextRequest,
  rateLimitType: keyof typeof rateLimits = 'general'
): Promise<{ limit: number; remaining: number; reset: number }> {
  const identifier = getClientIdentifier(request);
  const ratelimit = rateLimits[rateLimitType];
  
  // This is a read-only check that doesn't consume a request
  const result = await ratelimit.getRemaining(identifier);
  
  // Extract limit from rate limit type since getRemaining doesn't return it
  const limitMap = {
    general: 60,
    auth: 5,
    ai: 10,
    read: 100,
    write: 30,
    upload: 5
  };
  const limit = limitMap[rateLimitType] || 60;
  
  return {
    limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}

// Export rate limit types for use in API routes
export type RateLimitType = keyof typeof rateLimits;