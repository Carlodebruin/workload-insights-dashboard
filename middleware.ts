import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { authenticateRequest } from './lib/auth';
import { logger } from './lib/logger';

// State-changing HTTP methods that require CSRF protection
const STATE_CHANGING_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

// Helper function to validate origin/referer for CSRF protection
function validateOrigin(request: NextRequest): { isValid: boolean; error?: NextResponse } {
  const method = request.method;
  
  // Only validate origin for state-changing requests
  if (!STATE_CHANGING_METHODS.includes(method)) {
    return { isValid: true };
  }

  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');
  const host = request.headers.get('host');
  
  // Get expected origins (current host and any allowed origins)
  const expectedOrigins = [
    `https://${host}`,
    `http://${host}`, // For development
  ];
  
  // For production, you might want to add specific allowed origins
  if (process.env.NODE_ENV === 'production') {
    // Add your production domains here
    // expectedOrigins.push('https://yourdomain.com');
  }

  // Check origin header first (most reliable)
  if (origin) {
    if (!expectedOrigins.includes(origin)) {
      return {
        isValid: false,
        error: NextResponse.json(
          { error: 'CSRF protection: Invalid origin' },
          { 
            status: 403,
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
            }
          }
        )
      };
    }
    return { isValid: true };
  }
  
  // Fallback to referer header if origin is not present
  if (referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
    
    if (!expectedOrigins.includes(refererOrigin)) {
      return {
        isValid: false,
        error: NextResponse.json(
          { error: 'CSRF protection: Invalid referer' },
          { 
            status: 403,
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
            }
          }
        )
      };
    }
    return { isValid: true };
  }
  
  // No origin or referer header - potential CSRF attack
  return {
    isValid: false,
    error: NextResponse.json(
      { error: 'CSRF protection: Missing origin or referer header' },
      { 
        status: 403,
        headers: {
          'X-Content-Type-Options': 'nosniff',
          'X-Frame-Options': 'DENY',
        }
      }
    )
  };
}

// Helper function to build Content Security Policy
function buildCSP(request: NextRequest): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const host = request.headers.get('host') || 'localhost:3000';
  
  // Define CSP directives based on application requirements
  const directives = {
    // Default source - restrict to self
    'default-src': ["'self'"],
    
    // Script sources - allow self and Next.js requirements
    'script-src': [
      "'self'",
      ...(isProduction ? [] : ["'unsafe-eval'"]), // Allow eval in development for HMR
      "'unsafe-inline'", // Required for Next.js inline scripts
    ],
    
    // Style sources - allow self and external CSS libraries
    'style-src': [
      "'self'",
      "'unsafe-inline'", // Required for Next.js CSS-in-JS and styled components
      'https://unpkg.com', // Leaflet CSS libraries
    ],
    
    // Image sources - allow self, data URLs, and common CDNs
    'img-src': [
      "'self'",
      'data:', // For base64 images and map tiles
      'blob:', // For dynamically generated images
      'https:', // Allow HTTPS images (map tiles, external images)
      ...(isProduction ? [] : ['http:']), // Allow HTTP in development
    ],
    
    // Font sources - allow self and common font CDNs
    'font-src': [
      "'self'",
      'data:', // For base64 fonts
      'https://unpkg.com', // Potential font assets from unpkg
    ],
    
    // Connect sources - API endpoints and WebSocket connections
    'connect-src': [
      "'self'",
      `https://${host}`,
      `http://${host}`, // Allow connections to same host
      'https://localhost:3000',
      'http://localhost:3000',
      'https://localhost:3001',
      'http://localhost:3001', // Development server ports
      'https://api.openai.com', // AI provider endpoints
      'https://api.anthropic.com',
      'https://api.deepseek.com',
      'https://api.moonshot.cn',
      'https://generativelanguage.googleapis.com', // Gemini API
      'https://nominatim.openstreetmap.org', // OpenStreetMap geocoding
      'https://tile.openstreetmap.org', // OpenStreetMap tiles
      'https://*.tile.openstreetmap.org', // Additional tile servers
      'https://graph.facebook.com', // WhatsApp Business API
      ...(isProduction ? [] : ['ws:', 'wss:']), // WebSocket for development HMR
    ],
    
    // Media sources - restrict to self and data URLs
    'media-src': [
      "'self'",
      'data:',
      'blob:',
    ],
    
    // Object sources - deny all plugins
    'object-src': ["'none'"],
    
    // Base URI - restrict to self
    'base-uri': ["'self'"],
    
    // Form action - restrict to self
    'form-action': ["'self'"],
    
    // Frame ancestors - deny all (prevent clickjacking)
    'frame-ancestors': ["'none'"],
    
    // Frame sources - restrict to self
    'frame-src': ["'self'"],
    
    // Worker sources - allow self and blob for web workers
    'worker-src': [
      "'self'",
      'blob:', // For service workers and web workers
    ],
    
    // Manifest source - allow self
    'manifest-src': ["'self'"],
    
    // Child sources - restrict to self (for iframes, workers)
    'child-src': ["'self'", 'blob:'],
  };
  
  // Convert directives object to CSP string
  return Object.entries(directives)
    .map(([directive, sources]) => `${directive} ${sources.join(' ')}`)
    .join('; ');
}

// Helper function to add security headers to response
function addSecurityHeaders(response: NextResponse, request: NextRequest): NextResponse {
  // Content Security Policy - comprehensive XSS protection
  const csp = buildCSP(request);
  response.headers.set('Content-Security-Policy', csp);
  
  // CSRF and security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Additional security headers
  response.headers.set('X-Download-Options', 'noopen'); // Prevent IE from executing downloads
  response.headers.set('X-DNS-Prefetch-Control', 'off'); // Disable DNS prefetching
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains'); // HSTS
  
  // CSRF protection headers
  response.headers.set('X-CSRF-Protection', 'enabled');
  response.headers.set('X-Permitted-Cross-Domain-Policies', 'none');
  
  // Cache control for API responses
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  response.headers.set('Pragma', 'no-cache');
  
  // Feature Policy / Permissions Policy - restrict browser features
  const permissionsPolicy = [
    'camera=()', // Disable camera access
    'microphone=()', // Disable microphone access
    'geolocation=(self)', // Allow geolocation only from same origin
    'payment=()', // Disable payment API
    'usb=()', // Disable USB API
    'magnetometer=()', // Disable magnetometer
    'gyroscope=()', // Disable gyroscope
    'accelerometer=()', // Disable accelerometer
    'ambient-light-sensor=()', // Disable ambient light sensor
  ].join(', ');
  response.headers.set('Permissions-Policy', permissionsPolicy);
  
  return response;
}

export async function middleware(request: NextRequest) {
  // Check if the request is for an API route
  if (request.nextUrl.pathname.startsWith('/api/')) {
    
    // Skip authentication for public endpoints
    const isHealthEndpoint = request.nextUrl.pathname.startsWith('/api/health');
    const isDataSubjectRightsEndpoint = request.nextUrl.pathname.startsWith('/api/data-subject-rights');
    const isPublicEndpoint = isHealthEndpoint || isDataSubjectRightsEndpoint;
    
    // 1. CSRF Protection - Validate origin/referer for state-changing requests
    // Public endpoints using GET method are safe from CSRF
    if (!isPublicEndpoint || STATE_CHANGING_METHODS.includes(request.method)) {
      const originValidation = validateOrigin(request);
      if (!originValidation.isValid) {
        return originValidation.error!;
      }
    }
    
    // 2. Authentication check (skip for public endpoints)
    if (!isPublicEndpoint) {
      const authResult = await authenticateRequest(request);
      
      if (!authResult.isAuthenticated) {
        // Log authentication failure for security monitoring
        logger.logAuth('auth_failed', {
          requestId: request.headers.get('x-request-id') || 'unknown',
          operation: 'middleware_auth',
          method: request.method,
          url: request.url,
          timestamp: new Date().toISOString(),
          ipAddress: request.headers.get('x-forwarded-for') || 
                     request.headers.get('x-real-ip') || 
                     'unknown'
        }, { 
          reason: authResult.error || 'Authentication failed',
          userAgent: request.headers.get('user-agent')
        });

        return NextResponse.json(
          { 
            error: 'Unauthorized - Authentication required',
            message: 'Please provide a valid Bearer token in the Authorization header'
          },
          { 
            status: 401,
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
              'X-XSS-Protection': '1; mode=block',
              'WWW-Authenticate': 'Bearer',
            }
          }
        );
      }

      // Log successful authentication for monitoring
      logger.logAuth('login', {
        requestId: request.headers.get('x-request-id') || 'unknown',
        operation: 'middleware_auth',
        method: request.method,
        url: request.url,
        timestamp: new Date().toISOString(),
        userId: authResult.user?.id,
        userRole: authResult.user?.role
      }, { 
        method: 'bearer_token',
        userAgent: request.headers.get('user-agent')
      });

      // Store user context in request headers for downstream API routes
      // Note: In middleware, we can't modify request headers directly, 
      // but we can pass user info via the response which API routes can access
      const nextResponse = NextResponse.next();
      if (authResult.user) {
        nextResponse.headers.set('X-User-ID', authResult.user.id);
        nextResponse.headers.set('X-User-Role', authResult.user.role);
        nextResponse.headers.set('X-User-Permissions', authResult.user.permissions.join(','));
      }
      
      // 3. Continue with request and add security headers to response
      return addSecurityHeaders(nextResponse, request);
    }
    
    // 3. Continue with request and add security headers to response
    const response = NextResponse.next();
    return addSecurityHeaders(response, request);
  }

  // For non-API routes, add security headers including CSP
  const response = NextResponse.next();
  return addSecurityHeaders(response, request);
}

// Configure which routes this middleware should run on
export const config = {
  matcher: [
    // Apply to all routes except static files and internal Next.js routes
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ]
};