import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, AuthenticationError, ValidationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger } from '@/lib/logger';

async function handleGetExports(request: NextRequest) {
  // Verify authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError();
  }

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');

  // Validate limit parameter
  if (isNaN(limit) || limit < 1 || limit > 100) {
    throw new ValidationError('Invalid limit parameter. Must be between 1 and 100.');
  }

  // Get user's export history with performance monitoring
  const exports = await PerformanceLogger.measureAsync(
    'get_user_exports',
    async () => {
      try {
        return await exportService.getUserExports(authResult.user!.id, limit);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: authResult.user.id, limit }
  );

  logger.info('Export history retrieved', {
    userId: authResult.user.id,
    exportCount: exports.length,
    limit,
  });

  return NextResponse.json({
    exports,
  });
}

export const GET = withErrorHandler(handleGetExports);
