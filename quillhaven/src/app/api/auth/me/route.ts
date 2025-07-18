import { NextResponse } from 'next/server';
import {
  withAuth,
  withCors,
  type AuthenticatedRequest,
} from '@/lib/middleware';
import { withErrorHandler } from '@/lib/errorHandler';
import { logger } from '@/lib/logger';

async function handleGetMe(req: AuthenticatedRequest) {
  const user = req.user!; // User is guaranteed to exist due to withAuth middleware

  logger.info('User profile accessed', {
    userId: user.id,
    email: user.email,
  });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified,
        subscriptionTier: user.subscriptionTier,
        writingPreferences: user.writingPreferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    },
    { status: 200 }
  );
}

// Apply middleware with error handling
const handler = withErrorHandler(withCors(withAuth(handleGetMe)));

export { handler as GET };
