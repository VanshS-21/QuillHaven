import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from './auth';
import type { User } from '@prisma/client';

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

/**
 * Authentication middleware for API routes
 */
export function withAuth<T extends unknown[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');

      if (!authHeader) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Handle Bearer token format
      let token: string;
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7); // Remove 'Bearer ' prefix
      } else {
        // Also accept token without Bearer prefix for backward compatibility
        token = authHeader;
      }

      if (!token || token.trim() === '') {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      // Verify token and get user
      const user = await getUserFromToken(token);

      if (!user) {
        return NextResponse.json(
          { error: 'Invalid or expired token' },
          { status: 401 }
        );
      }

      // Add user to request object
      (req as AuthenticatedRequest).user = user;

      // Call the handler
      return handler(req as AuthenticatedRequest, ...args);
    } catch (error) {
      console.error('Authentication middleware error:', error);
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }
  };
}

/**
 * Optional authentication middleware - doesn't require authentication but adds user if available
 */
export function withOptionalAuth(
  handler: (req: AuthenticatedRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');

      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const user = await getUserFromToken(token);

        if (user) {
          (req as AuthenticatedRequest).user = user;
        }
      }

      // Call the handler regardless of authentication status
      return handler(req as AuthenticatedRequest);
    } catch (error) {
      console.error('Optional authentication middleware error:', error);
      // Continue without authentication on error
      return handler(req as AuthenticatedRequest);
    }
  };
}

/**
 * Rate limiting middleware with enhanced security features
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  keyGenerator?: (req: NextRequest) => string; // Custom key generator
  onLimitReached?: (req: NextRequest, clientId: string) => void; // Callback when limit reached
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
  firstRequest: number;
  violations: number; // Track repeated violations
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const suspiciousIPs = new Set<string>(); // Track IPs with repeated violations

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60000); // Clean up every minute

export function withRateLimit(config: RateLimitConfig) {
  return function <T extends unknown[]>(
    handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
      try {
        // Get client identifier
        const clientId = config.keyGenerator
          ? config.keyGenerator(req)
          : getClientIdentifier(req);

        const now = Date.now();

        // Check if IP is flagged as suspicious
        if (suspiciousIPs.has(clientId)) {
          return NextResponse.json(
            {
              error: 'Access temporarily restricted due to suspicious activity',
            },
            { status: 429 }
          );
        }

        // Get or create rate limit entry
        let rateLimitEntry = rateLimitStore.get(clientId);

        if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
          // Create new entry or reset expired entry
          rateLimitEntry = {
            count: 0,
            resetTime: now + config.windowMs,
            firstRequest: now,
            violations: rateLimitEntry?.violations || 0,
          };
          rateLimitStore.set(clientId, rateLimitEntry);
        }

        // Check if limit exceeded
        if (rateLimitEntry.count >= config.maxRequests) {
          rateLimitEntry.violations++;

          // Flag IP as suspicious after multiple violations
          if (rateLimitEntry.violations >= 3) {
            suspiciousIPs.add(clientId);
            // Remove from suspicious list after 1 hour
            setTimeout(() => suspiciousIPs.delete(clientId), 60 * 60 * 1000);
          }

          // Call limit reached callback
          if (config.onLimitReached) {
            config.onLimitReached(req, clientId);
          }

          return NextResponse.json(
            {
              error:
                config.message || 'Too many requests. Please try again later.',
              retryAfter: Math.ceil((rateLimitEntry.resetTime - now) / 1000),
            },
            {
              status: 429,
              headers: {
                'Retry-After': Math.ceil(
                  (rateLimitEntry.resetTime - now) / 1000
                ).toString(),
                'X-RateLimit-Limit': config.maxRequests.toString(),
                'X-RateLimit-Remaining': '0',
                'X-RateLimit-Reset': new Date(
                  rateLimitEntry.resetTime
                ).toISOString(),
              },
            }
          );
        }

        // Increment counter before calling handler
        rateLimitEntry.count++;

        // Call the handler
        const response = await handler(req, ...args);

        // Optionally skip counting based on response status
        if (config.skipSuccessfulRequests && response.status < 400) {
          rateLimitEntry.count--;
        } else if (config.skipFailedRequests && response.status >= 400) {
          rateLimitEntry.count--;
        }

        // Add rate limit headers to response
        response.headers.set(
          'X-RateLimit-Limit',
          config.maxRequests.toString()
        );
        response.headers.set(
          'X-RateLimit-Remaining',
          Math.max(0, config.maxRequests - rateLimitEntry.count).toString()
        );
        response.headers.set(
          'X-RateLimit-Reset',
          new Date(rateLimitEntry.resetTime).toISOString()
        );

        return response;
      } catch (error) {
        console.error('Rate limiting middleware error:', error);
        // Continue without rate limiting on error
        return handler(req, ...args);
      }
    };
  };
}

/**
 * Get client identifier for rate limiting
 */
function getClientIdentifier(req: NextRequest): string {
  // Try to get real IP from various headers
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip'); // Cloudflare

  if (forwardedFor) {
    // X-Forwarded-For can contain multiple IPs, get the first one
    return forwardedFor.split(',')[0].trim();
  }

  if (realIP) {
    return realIP;
  }

  if (cfConnectingIP) {
    return cfConnectingIP;
  }

  // Fallback to a combination of headers for identification
  const userAgent = req.headers.get('user-agent') || '';
  const acceptLanguage = req.headers.get('accept-language') || '';

  return `unknown-${Buffer.from(userAgent + acceptLanguage)
    .toString('base64')
    .slice(0, 16)}`;
}

/**
 * Advanced rate limiting with different tiers
 */
export function withTieredRateLimit(configs: {
  [key: string]: RateLimitConfig;
}) {
  return function <T extends unknown[]>(
    handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
  ) {
    return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
      // Determine which rate limit config to use based on user or endpoint
      let configKey = 'default';

      // Check if user is authenticated and has a subscription tier
      const authHeader = req.headers.get('authorization');
      if (authHeader) {
        // You could decode the JWT here to get user tier
        // For now, we'll use a simple approach
        configKey = 'authenticated';
      }

      const config = configs[configKey] || configs['default'];
      if (!config) {
        return handler(req, ...args);
      }

      return withRateLimit(config)(handler)(req, ...args);
    };
  };
}

/**
 * CORS middleware
 */
export function withCors(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: {
    origin?: string | string[];
    methods?: string[];
    allowedHeaders?: string[];
    credentials?: boolean;
  } = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const {
      origin = '*',
      methods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders = ['Content-Type', 'Authorization'],
      credentials = true,
    } = options;

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      return new NextResponse(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': Array.isArray(origin)
            ? origin.join(', ')
            : origin,
          'Access-Control-Allow-Methods': methods.join(', '),
          'Access-Control-Allow-Headers': allowedHeaders.join(', '),
          'Access-Control-Allow-Credentials': credentials.toString(),
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }

    // Call the handler
    const response = await handler(req);

    // Add CORS headers to response
    response.headers.set(
      'Access-Control-Allow-Origin',
      Array.isArray(origin) ? origin.join(', ') : origin
    );
    response.headers.set('Access-Control-Allow-Methods', methods.join(', '));
    response.headers.set(
      'Access-Control-Allow-Headers',
      allowedHeaders.join(', ')
    );
    response.headers.set(
      'Access-Control-Allow-Credentials',
      credentials.toString()
    );

    return response;
  };
}

/**
 * Input validation middleware
 */
export function withValidation<T>(
  validator: (data: unknown) => {
    isValid: boolean;
    errors: string[];
    data?: T;
  },
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      let requestData: unknown;

      // Parse request body based on content type
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        // Clone the request to avoid "Body is unusable" errors
        const clonedReq = req.clone();
        try {
          requestData = await clonedReq.json();
        } catch (jsonError) {
          // Handle JSON parsing errors specifically
          throw new Error('Invalid JSON in request body');
        }
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const clonedReq = req.clone();
        const formData = await clonedReq.formData();
        requestData = Object.fromEntries(formData.entries());
      } else {
        requestData = {};
      }

      // Validate data
      const validation = validator(requestData);

      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: validation.errors.join(', '), // Use the actual validation errors
            details: validation.errors,
          },
          { status: 400 }
        );
      }

      // Call handler with validated data
      return handler(req, validation.data!);
    } catch (error) {
      console.error('Validation middleware error:', error);
      
      // Check if it's a JSON parsing error
      if (error instanceof SyntaxError || 
          (error instanceof Error && error.message.includes('Invalid JSON'))) {
        return NextResponse.json(
          { error: 'Invalid JSON in request body' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
  };
}
