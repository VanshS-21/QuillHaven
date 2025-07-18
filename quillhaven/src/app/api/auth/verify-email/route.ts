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

  // Get token from query parameters
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    throw new ValidationError('Verification token is required');
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

    if (
      result.message?.includes('expired') ||
      result.message?.includes('invalid')
    ) {
      throw new ValidationError(result.message || 'Email verification failed');
    }

    throw new ValidationError('Email verification failed');
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
      maxRequests: 50, // 50 verification attempts per 15 minutes (more lenient for testing)
      message: 'Too many verification attempts. Please try again later.',
    })(handleVerifyEmail)
  )
);

export { handler as GET };
