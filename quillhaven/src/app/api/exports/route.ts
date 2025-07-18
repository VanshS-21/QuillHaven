import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { validateNumber } from '@/utils/validation/input';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger } from '@/lib/logger';

async function handleGetExports(request: NextRequest) {
  const user = (request as AuthenticatedRequest).user;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  const { searchParams } = new URL(request.url);
  const limitParam = searchParams.get('limit') || '10';

  // Validate limit parameter
  const limitValidation = validateNumber(limitParam, 'limit', {
    required: false,
    min: 1,
    max: 100,
    integer: true,
  });

  if (!limitValidation.isValid) {
    throw new ValidationError(limitValidation.errors.join(', '));
  }

  const limit = parseInt(limitValidation.sanitizedData as string);

  // Get user's export history with performance monitoring
  const exports = await PerformanceLogger.measureAsync(
    'get_user_exports',
    async () => {
      try {
        return await exportService.getUserExports(user.id, limit);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, limit }
  );

  logger.info('Export history retrieved', {
    userId: user.id,
    exportCount: exports.length,
    limit,
  });

  return NextResponse.json({
    exports,
  });
}

// Apply middleware with error handling and rate limiting
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  })(withAuth(handleGetExports))
);
