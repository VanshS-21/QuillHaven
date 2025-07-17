import { NextResponse } from 'next/server';
import {
  withAuth,
  withCors,
  type AuthenticatedRequest,
} from '@/lib/middleware';

async function handleGetMe(req: AuthenticatedRequest) {
  try {
    const user = req.user!; // User is guaranteed to exist due to withAuth middleware

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
  } catch (error) {
    console.error('Get current user endpoint error:', error);
    return NextResponse.json(
      { error: 'Failed to get user information.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(withAuth(handleGetMe));

export { handler as GET };
