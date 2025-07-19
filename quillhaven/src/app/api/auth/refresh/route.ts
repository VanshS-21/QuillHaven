import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, generateToken } from '@/lib/auth';
import { withRateLimit, withCors } from '@/lib/middleware';
import { withErrorHandler, AuthenticationError } from '@/lib/errorHandler';
import { logger, SecurityLogger, PerformanceLogger } from '@/lib/logger';

async function handleRefresh(req: NextRequest) {
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent');

  // Verify current token
  const authResult = await PerformanceLogger.measureAsync(
    'token_refresh',
    async () => {
      return await verifyAuth(req);
    },
    { clientIP }
  );

  if (!authResult.success || !authResult.user) {
    SecurityLogger.logAuthAttempt(
      false,
      'token_refresh',
      clientIP,
      userAgent || undefined,
      'Invalid token for refresh'
    );

    throw new AuthenticationError('Invalid or expired token');
  }

  // Generate new token
  const newToken = generateToken(authResult.user as any);

  // Log successful token refresh
  SecurityLogger.logAuthAttempt(
    true,
    authResult.user.email,
    clientIP,
    userAgent || undefined,
    'Token refreshed'
  );

  logger.info('Token refreshed successfully', {
    userId: authResult.user.id,
    email: authResult.user.email,
    clientIP,
  });

  return NextResponse.json(
    {
      message: 'Token refreshed successfully',
      token: newToken,
      user: {
        id: authResult.user.id,
        email: authResult.user.email,
        firstName: authResult.user.firstName,
        lastName: authResult.user.lastName,
        emailVerified: authResult.user.emailVerified,
        subscriptionTier: authResult.user.subscriptionTier,
        writingPreferences: authResult.user.writingPreferences,
      },
    },
    { status: 200 }
  );
}

// Apply middleware with error handling
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 refresh attempts per 15 minutes
      message: 'Too many token refresh attempts. Please try again later.',
    })(handleRefresh)
  )
);

export { handler as POST };