import { NextRequest, NextResponse } from 'next/server';
import { logoutUser } from '@/lib/auth';
import { withCors } from '@/lib/middleware';
import {
  withErrorHandler,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger } from '@/lib/logger';

async function handleLogout(req: NextRequest) {
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // Get token from Authorization header
  const authHeader = req.headers.get('authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new ValidationError('No token provided');
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Logout user (invalidate session)
  const result = await handleDatabaseError(async () => {
    return await logoutUser(token);
  });

  logger.info('User logged out successfully', {
    clientIP,
    tokenPrefix: token.substring(0, 10) + '...',
  });

  return NextResponse.json(
    {
      message: result.message,
    },
    { status: 200 }
  );
}

// Apply middleware with error handling
const handler = withErrorHandler(withCors(handleLogout));

export { handler as POST };
