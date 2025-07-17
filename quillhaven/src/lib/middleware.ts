import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from './auth';
import type { User } from '@prisma/client';

export interface AuthenticatedRequest extends NextRequest {
  user?: User;
}

/**
 * Authentication middleware for API routes
 */
export function withAuth<T extends any[]>(
  handler: (req: AuthenticatedRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.get('authorization');

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

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
 * Rate limiting middleware
 */
interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Maximum requests per window
  message?: string;
}

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function withRateLimit(config: RateLimitConfig) {
  return function <T extends any[]>(handler: (req: NextRequest, ...args: T) => Promise<NextResponse>) {
    return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
      try {
        // Get client identifier (IP address)
        const clientId =
          req.headers.get('x-forwarded-for') ||
          req.headers.get('x-real-ip') ||
          'unknown';
        const now = Date.now();

        // Clean up expired entries
        for (const [key, value] of rateLimitStore.entries()) {
          if (now > value.resetTime) {
            rateLimitStore.delete(key);
          }
        }

        // Get or create rate limit entry
        let rateLimitEntry = rateLimitStore.get(clientId);

        if (!rateLimitEntry || now > rateLimitEntry.resetTime) {
          // Create new entry or reset expired entry
          rateLimitEntry = {
            count: 0,
            resetTime: now + config.windowMs,
          };
          rateLimitStore.set(clientId, rateLimitEntry);
        }

        // Check if limit exceeded
        if (rateLimitEntry.count >= config.maxRequests) {
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
                'X-RateLimit-Remaining': Math.max(
                  0,
                  config.maxRequests - rateLimitEntry.count - 1
                ).toString(),
                'X-RateLimit-Reset': new Date(
                  rateLimitEntry.resetTime
                ).toISOString(),
              },
            }
          );
        }

        // Increment counter
        rateLimitEntry.count++;

        // Call the handler
        const response = await handler(req, ...args);

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
  validator: (data: any) => { isValid: boolean; errors: string[]; data?: T },
  handler: (req: NextRequest, validatedData: T) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    try {
      let requestData: any;

      // Parse request body based on content type
      const contentType = req.headers.get('content-type') || '';

      if (contentType.includes('application/json')) {
        requestData = await req.json();
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        requestData = Object.fromEntries(formData.entries());
      } else {
        requestData = {};
      }

      // Validate data
      const validation = validator(requestData);

      if (!validation.isValid) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: validation.errors,
          },
          { status: 400 }
        );
      }

      // Call handler with validated data
      return handler(req, validation.data!);
    } catch (error) {
      console.error('Validation middleware error:', error);
      return NextResponse.json(
        { error: 'Invalid request data' },
        { status: 400 }
      );
    }
  };
}
