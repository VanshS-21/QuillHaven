import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken, generateToken } from '@/lib/auth';
import { withCors, withRateLimit } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

async function handleRefreshToken(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    const oldToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Get user from token (this also validates the token)
    const user = await getUserFromToken(oldToken);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Generate new token
    const newToken = generateToken(user);

    // Update session with new token
    await prisma.session.update({
      where: { token: oldToken },
      data: {
        token: newToken,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      },
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
  } catch (error) {
    console.error('Refresh token endpoint error:', error);
    return NextResponse.json(
      { error: 'Token refresh failed. Please login again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20, // 20 refresh attempts per 15 minutes
    message: 'Too many token refresh attempts. Please try again later.',
  })(handleRefreshToken)
);

export { handler as POST };
