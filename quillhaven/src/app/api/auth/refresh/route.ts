import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, generateToken } from '@/lib/auth';
import { withCors, withRateLimit } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import {
  logger,
  PerformanceLogger,
  SecurityLogger,
  BusinessLogger,
} from '@/lib/logger';

async function handleRefreshToken(req: NextRequest) {
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Get token from Authorization header
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ValidationError('No token provided');
  }

  const oldToken = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Get user from token with performance monitoring
  const user = await PerformanceLogger.measureAsync(
    'token_validation',
    async () => {
      try {
        return await getUserFromToken(oldToken);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { token: oldToken.substring(0, 8) + '...', clientIP }
  );

  if (!user) {
    SecurityLogger.logAuthAttempt(false, 'unknown', clientIP, userAgent);

    logger.warn('Token refresh failed - invalid token', {
      token: oldToken.substring(0, 8) + '...',
      clientIP,
      userAgent,
    });

    throw new AuthenticationError('Invalid or expired token');
  }

  // Generate new token
  const newToken = generateToken(user);

  // Update session with new token and performance monitoring
  await PerformanceLogger.measureAsync(
    'session_update',
    async () => {
      try {
        return await prisma.session.update({
          where: { token: oldToken },
          data: {
            token: newToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
          },
        });
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, clientIP }
  );

  // Log successful token refresh
  SecurityLogger.logAuthAttempt(true, user.email, clientIP, userAgent);

  BusinessLogger.logUserAction('token_refresh', user.id, {
    clientIP,
    userAgent,
    timestamp: new Date().toISOString(),
  });

  logger.info('Token refreshed successfully', {
    userId: user.id,
    email: user.email,
    clientIP,
    userAgent,
  });

  return NextResponse.json(
    {
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        subscriptionTier: user.subscriptionTier,
        writingPreferences: user.writingPreferences,
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
      maxRequests: 20, // 20 refresh attempts per 15 minutes
      message: 'Too many token refresh attempts. Please try again later.',
    })(handleRefreshToken)
  )
);

export { handler as POST };
