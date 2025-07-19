import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/auth';
import { withCors, withRateLimit } from '@/lib/middleware';
import {
  withErrorHandler,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import {
  logger,
  PerformanceLogger,
  SecurityLogger,
  BusinessLogger,
} from '@/lib/logger';

async function handleVerifyEmail(req: NextRequest) {
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  let token: string | null = null;

  // Get token from query parameters (GET) or request body (POST)
  if (req.method === 'GET') {
    const { searchParams } = new URL(req.url);
    token = searchParams.get('token');
  } else if (req.method === 'POST') {
    try {
      const body = await req.json();
      token = body.token;
    } catch {
      throw new ValidationError('Invalid request body');
    }
  }

  if (!token) {
    throw new ValidationError('Token is required');
  }

  // Verify email with token and performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'email_verification',
    async () => {
      try {
        return await verifyEmail(token);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { token: token.substring(0, 8) + '...', clientIP }
  );

  if (!result.success) {
    // Log failed verification attempt
    SecurityLogger.logAuthAttempt(
      false,
      result.user?.email || 'unknown',
      clientIP,
      userAgent
    );

    logger.warn('Email verification failed', {
      token: token.substring(0, 8) + '...',
      reason: result.message,
      clientIP,
      userAgent,
    });

    throw new ValidationError(
      result.message || 'Invalid or expired verification token'
    );
  }

  // Log successful email verification
  SecurityLogger.logAuthAttempt(
    true,
    result.user?.email || 'unknown',
    clientIP,
    userAgent
  );

  BusinessLogger.logUserAction('email_verified', result.user?.id || 'unknown', {
    email: result.user?.email,
    clientIP,
    userAgent,
    timestamp: new Date().toISOString(),
  });

  logger.info('Email verification successful', {
    userId: result.user?.id,
    email: result.user?.email,
    clientIP,
    userAgent,
  });

  return NextResponse.json(
    {
      message: result.message,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        firstName: result.user?.firstName,
        lastName: result.user?.lastName,
        emailVerified: result.user?.emailVerified,
        isEmailVerified: true, // Email is verified after successful verification
      },
    },
    { status: 200 }
  );
}

// Apply middleware
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 verification attempts per 15 minutes (very lenient for testing)
      message: 'Too many verification attempts. Please try again later.',
    })(handleVerifyEmail)
  )
);

export { handler as GET, handler as POST };
