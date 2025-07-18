/**
 * User Privacy Summary API - Data overview for privacy dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { getUserDataSummary } from '@/services/dataPrivacyService';
import { withErrorHandler, AuthenticationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, SecurityLogger, BusinessLogger } from '@/lib/logger';

async function handlePrivacySummary(req: NextRequest) {
  const user = (req as any).user;
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  
  if (!user) {
    throw new AuthenticationError();
  }

  // Get user data summary with performance monitoring
  const summary = await PerformanceLogger.measureAsync(
    'privacy_summary_generation',
    async () => {
      try {
        return await getUserDataSummary(user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, clientIP }
  );

  // Log security event for privacy data access
  SecurityLogger.logDataAccess('privacy_summary', 'read', user.id, true);
  
  BusinessLogger.logUserAction('privacy_summary_viewed', user.id, {
    clientIP,
    userAgent: req.headers.get('user-agent') || 'unknown',
    timestamp: new Date().toISOString()
  });

  logger.info('Privacy summary generated', {
    userId: user.id,
    email: user.email,
    clientIP,
    userAgent: req.headers.get('user-agent')
  });

  return NextResponse.json({
    success: true,
    data: {
      userId: user.id,
      email: user.email,
      accountCreated: user.createdAt,
      ...summary,
    },
  });
}

// Apply middleware with moderate rate limiting
const handler = withErrorHandler(withAuth(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 requests per 15 minutes
    message: 'Too many requests. Please try again later.',
  })(handlePrivacySummary)
));

export { handler as GET };