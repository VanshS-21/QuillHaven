import { NextRequest, NextResponse } from 'next/server';
import { verifyEmail } from '@/lib/auth';
import { withCors, withRateLimit } from '@/lib/middleware';

async function handleVerifyEmail(req: NextRequest) {
  try {
    // Get token from query parameters
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Verify email with token
    const result = await verifyEmail(token);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

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
  } catch (error) {
    console.error('Email verification endpoint error:', error);
    return NextResponse.json(
      { error: 'Email verification failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // 50 verification attempts per 15 minutes (more lenient for testing)
    message: 'Too many verification attempts. Please try again later.',
  })(handleVerifyEmail)
);

export { handler as GET };
