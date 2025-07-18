/**
 * User Privacy Summary API - Data overview for privacy dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { getUserDataSummary } from '@/services/dataPrivacyService';

async function handlePrivacySummary(req: NextRequest) {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user data summary
    const summary = await getUserDataSummary(user.id);

    return NextResponse.json({
      success: true,
      data: {
        userId: user.id,
        email: user.email,
        accountCreated: user.createdAt,
        ...summary,
      },
    });

  } catch (error) {
    console.error('Privacy summary error:', error);
    return NextResponse.json(
      { error: 'Failed to get privacy summary. Please try again later.' },
      { status: 500 }
    );
  }
}

// Apply middleware with moderate rate limiting
const handler = withAuth(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 requests per 15 minutes
    message: 'Too many requests. Please try again later.',
  })(handlePrivacySummary)
);

export { handler as GET };