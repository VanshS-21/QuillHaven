import { NextRequest, NextResponse } from 'next/server';
import { logger } from './logger';

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: unknown;
}

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, true, details);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, true);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, true);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404, true);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'Resource conflict') {
    super(message, 409, true);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = 'Too many requests') {
    super(message, 429, true);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message?: string) {
    super(
      message || `External service ${service} is currently unavailable`,
      503,
      true,
      { service }
    );
  }
}

/**
 * Global error handler middleware for API routes
 */
export function withErrorHandler<T extends unknown[]>(
  handler: (req: NextRequest, ...args: T) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: T): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const startTime = Date.now();

    try {
      // Add request ID to headers for tracking
      req.headers.set('x-request-id', requestId);

      // Log incoming request
      logger.info('Incoming request', {
        requestId,
        method: req.method,
        url: req.url,
        userAgent: req.headers.get('user-agent'),
        ip: getClientIP(req),
      });

      const response = await handler(req, ...args);

      // Log successful response
      const duration = Date.now() - startTime;
      logger.info('Request completed', {
        requestId,
        statusCode: response.status,
        duration,
      });

      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      // Handle different types of errors
      if (error instanceof AppError) {
        return handleAppError(error, requestId, duration);
      }

      // Handle unexpected errors
      return handleUnexpectedError(error, requestId, duration, req);
    }
  };
}

/**
 * Handle application-specific errors
 */
function handleAppError(
  error: AppError,
  requestId: string,
  duration: number
): NextResponse {
  const errorResponse: ErrorResponse = {
    error: error.constructor.name,
    message: error.message,
    statusCode: error.statusCode,
    timestamp: new Date().toISOString(),
    requestId,
    details: error.details,
  };

  // Log operational errors as warnings, others as errors
  if (error.isOperational) {
    logger.warn('Operational error', {
      requestId,
      error: error.message,
      statusCode: error.statusCode,
      duration,
      stack: error.stack,
      details: error.details,
    });
  } else {
    logger.error('Programming error', {
      requestId,
      error: error.message,
      statusCode: error.statusCode,
      duration,
      stack: error.stack,
      details: error.details,
    });
  }

  return NextResponse.json(errorResponse, {
    status: error.statusCode,
    headers: {
      'x-request-id': requestId,
    },
  });
}

/**
 * Handle unexpected errors
 */
function handleUnexpectedError(
  error: unknown,
  requestId: string,
  duration: number,
  req: NextRequest
): NextResponse {
  const errorMessage = error instanceof Error ? error.message : 'Unknown error';
  const errorStack = error instanceof Error ? error.stack : undefined;

  // Log unexpected errors
  logger.error('Unexpected error', {
    requestId,
    error: errorMessage,
    stack: errorStack,
    duration,
    method: req.method,
    url: req.url,
    userAgent: req.headers.get('user-agent'),
    ip: getClientIP(req),
  });

  const errorResponse: ErrorResponse = {
    error: 'InternalServerError',
    message: 'An unexpected error occurred',
    statusCode: 500,
    timestamp: new Date().toISOString(),
    requestId,
  };

  return NextResponse.json(errorResponse, {
    status: 500,
    headers: {
      'x-request-id': requestId,
    },
  });
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get client IP address
 */
function getClientIP(req: NextRequest): string {
  const forwardedFor = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');

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
 * Async error handler for promises
 */
export function asyncHandler<T extends unknown[]>(
  fn: (...args: T) => Promise<NextResponse>
) {
  return async (...args: T): Promise<NextResponse> => {
    try {
      return await fn(...args);
    } catch (error) {
      throw error; // Re-throw to be caught by withErrorHandler
    }
  };
}

/**
 * Database error handler
 */
export function handleDatabaseError(error: unknown): AppError {
  if (error && typeof error === 'object' && 'code' in error) {
    const dbError = error as { code: string; message: string };

    switch (dbError.code) {
      case 'P2002':
        return new ConflictError(
          'A record with this information already exists'
        );
      case 'P2025':
        return new NotFoundError('The requested record was not found');
      case 'P2003':
        return new ValidationError('Invalid reference to related record');
      case 'P2014':
        return new ValidationError('Invalid ID provided');
      default:
        return new AppError('Database operation failed', 500, false);
    }
  }

  return new AppError('Database operation failed', 500, false);
}

/**
 * External service error handler with retry logic
 */
export async function handleExternalServiceCall<T>(
  serviceName: string,
  operation: () => Promise<T>,
  maxRetries: number = 3,
  retryDelay: number = 1000
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      // Log successful call after retries
      if (attempt > 1) {
        logger.info('External service call succeeded after retries', {
          service: serviceName,
          attempt,
          maxRetries,
        });
      }

      return result;
    } catch (error) {
      lastError = error;

      logger.warn('External service call failed', {
        service: serviceName,
        attempt,
        maxRetries,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      // Don't retry on the last attempt
      if (attempt === maxRetries) {
        break;
      }

      // Wait before retrying with exponential backoff
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelay * Math.pow(2, attempt - 1))
      );
    }
  }

  // All retries failed
  logger.error('External service call failed after all retries', {
    service: serviceName,
    maxRetries,
    error: lastError instanceof Error ? lastError.message : 'Unknown error',
  });

  throw new ExternalServiceError(serviceName);
}
