/**
 * Next.js Middleware for security and request processing
 */

import { NextRequest, NextResponse } from 'next/server';

// Rate limiting store (in production, use Redis or similar)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Suspicious activity tracking
const suspiciousIPs = new Set<string>();
const blockedIPs = new Set<string>();

// Security configuration
const SECURITY_CONFIG = {
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100, // requests per window
  },
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // login attempts per window
  },
  suspicious: {
    maxViolations: 5,
    blockDuration: 60 * 60 * 1000, // 1 hour
  },
};

/**
 * Get client IP address
 */
function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const cfConnectingIP = request.headers.get('cf-connecting-ip');
  
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  if (realIP) {
    return realIP;
  }
  
  if (cfConnectingIP) {
    return cfConnectingIP;
  }
  
  return 'unknown';
}

/**
 * Check if request is from a blocked IP
 */
function isBlocked(ip: string): boolean {
  return blockedIPs.has(ip) || suspiciousIPs.has(ip);
}

/**
 * Apply rate limiting
 */
function applyRateLimit(
  request: NextRequest,
  config: { windowMs: number; maxRequests: number }
): NextResponse | null {
  const ip = getClientIP(request);
  const now = Date.now();
  const key = `${ip}:${request.nextUrl.pathname}`;

  // Clean up expired entries
  for (const [entryKey, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(entryKey);
    }
  }

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);
  if (!entry || now > entry.resetTime) {
    entry = {
      count: 0,
      resetTime: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }

  // Check if limit exceeded
  if (entry.count >= config.maxRequests) {
    // Track violations
    const violationKey = `violations:${ip}`;
    const violations = rateLimitStore.get(violationKey);
    
    if (!violations || now > violations.resetTime) {
      rateLimitStore.set(violationKey, { count: 1, resetTime: now + SECURITY_CONFIG.suspicious.blockDuration });
    } else {
      violations.count++;
      
      // Block IP if too many violations
      if (violations.count >= SECURITY_CONFIG.suspicious.maxViolations) {
        blockedIPs.add(ip);
        setTimeout(() => blockedIPs.delete(ip), SECURITY_CONFIG.suspicious.blockDuration);
      }
    }

    return NextResponse.json(
      { 
        error: 'Too many requests. Please try again later.',
        retryAfter: Math.ceil((entry.resetTime - now) / 1000),
      },
      { 
        status: 429,
        headers: {
          'Retry-After': Math.ceil((entry.resetTime - now) / 1000).toString(),
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': new Date(entry.resetTime).toISOString(),
        },
      }
    );
  }

  // Increment counter
  entry.count++;

  return null; // Continue processing
}

/**
 * Validate request headers for security
 */
function validateHeaders(request: NextRequest): NextResponse | null {
  const userAgent = request.headers.get('user-agent');
  const contentType = request.headers.get('content-type');
  
  // Block requests without user agent (likely bots)
  if (!userAgent && request.method !== 'OPTIONS') {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 400 }
    );
  }

  // Validate content type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    if (contentType && !contentType.includes('application/json') && !contentType.includes('multipart/form-data')) {
      return NextResponse.json(
        { error: 'Invalid content type' },
        { status: 400 }
      );
    }
  }

  // Check for suspicious patterns in headers
  const suspiciousPatterns = [
    /script/i,
    /javascript/i,
    /vbscript/i,
    /onload/i,
    /onerror/i,
    /<script/i,
    /eval\(/i,
  ];

  for (const [name, value] of request.headers.entries()) {
    if (value && suspiciousPatterns.some(pattern => pattern.test(value))) {
      const ip = getClientIP(request);
      suspiciousIPs.add(ip);
      setTimeout(() => suspiciousIPs.delete(ip), SECURITY_CONFIG.suspicious.blockDuration);
      
      return NextResponse.json(
        { error: 'Invalid request' },
        { status: 400 }
      );
    }
  }

  return null; // Continue processing
}

/**
 * Add security headers to response
 */
function addSecurityHeaders(response: NextResponse): void {
  // Additional security headers not covered by next.config.ts
  response.headers.set('X-Powered-By', 'QuillHaven'); // Hide Next.js
  response.headers.set('Server', 'QuillHaven'); // Hide server info
  
  // Add timestamp for debugging
  response.headers.set('X-Request-Time', new Date().toISOString());
  
  // CORS headers for API routes
  if (response.url.includes('/api/')) {
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    
    // Only allow specific origins in production
    const allowedOrigins = process.env.NODE_ENV === 'production' 
      ? [process.env.APP_URL || 'https://quillhaven.com']
      : ['http://localhost:3000', 'http://127.0.0.1:3000'];
    
    response.headers.set('Access-Control-Allow-Origin', allowedOrigins[0]);
  }
}

/**
 * Main middleware function
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = getClientIP(request);

  // Skip middleware for static files and internal Next.js routes
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Block known malicious IPs
  if (isBlocked(ip)) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    );
  }

  // Validate request headers
  const headerValidation = validateHeaders(request);
  if (headerValidation) {
    return headerValidation;
  }

  // Apply different rate limits based on route
  let rateLimitResponse: NextResponse | null = null;

  if (pathname.startsWith('/api/auth/')) {
    // Stricter rate limiting for auth endpoints
    rateLimitResponse = applyRateLimit(request, SECURITY_CONFIG.auth);
  } else if (pathname.startsWith('/api/')) {
    // General API rate limiting
    rateLimitResponse = applyRateLimit(request, SECURITY_CONFIG.rateLimit);
  }

  if (rateLimitResponse) {
    addSecurityHeaders(rateLimitResponse);
    return rateLimitResponse;
  }

  // Handle CORS preflight requests
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 200 });
    addSecurityHeaders(response);
    return response;
  }

  // Continue with the request
  const response = NextResponse.next();
  addSecurityHeaders(response);

  return response;
}

/**
 * Configure which routes the middleware should run on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
};