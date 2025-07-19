import { NextRequest, NextResponse } from 'next/server';
import { logoutUser } from '@/lib/auth';
import { withCors } from '@/lib/middleware';
import { withErrorHandler } from '@/lib/errorHandler';
import { logger, SecurityLogger } from '@/lib/logger';

async function handleLogout(req: NextRequest) {
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent');

  // Extract token from Authorization header
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, but that's okay for logout
    logger.info('Logout attempt without token', { clientIP });
    
    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Attempt to logout and clean up session
    const result = await logoutUser(token);

    // Log successful logout
    SecurityLogger.logAuthAttempt(
      true,
      'logout',
      clientIP,
      userAgent || undefined
    );

    logger.info('User logged out successfully', {
      clientIP,
      userAgent,
    });

    return NextResponse.json(
      { message: result.message || 'Logged out successfully' },
      { status: 200 }
    );
  } catch (error) {
    // Even if logout fails on server side, we should return success
    // because the client will clear local storage anyway
    logger.warn('Logout cleanup failed, but returning success', {
      error: error instanceof Error ? error.message : 'Unknown error',
      clientIP,
    });

    return NextResponse.json(
      { message: 'Logged out successfully' },
      { status: 200 }
    );
  }
}

// Apply middleware with error handling
const handler = withErrorHandler(withCors(handleLogout));

export { handler as POST };