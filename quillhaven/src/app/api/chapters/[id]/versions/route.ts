import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { getChapterVersions } from '@/services/chapterService';
import { z } from 'zod';
import { withErrorHandler, ValidationError, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schema for version listing
const listVersionsSchema = z.object({
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(50))
    .optional(),
});

/**
 * GET /api/chapters/[id]/versions - Get chapter version history
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: chapterId } = await params;
  const { searchParams } = new URL(req.url);

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate chapter ID format
  if (!chapterId || typeof chapterId !== 'string') {
    throw new ValidationError('Invalid chapter ID');
  }

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  
  let validatedParams;
  try {
    validatedParams = listVersionsSchema.parse(queryParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.issues);
    }
    throw error;
  }

  // Get chapter versions with performance monitoring
  const versions = await PerformanceLogger.measureAsync(
    'chapter_versions_retrieval',
    async () => {
      try {
        return await getChapterVersions(chapterId, user.id, validatedParams.limit);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new NotFoundError('Chapter not found or access denied');
        }
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, chapterId, limit: validatedParams.limit }
  );

  // Log business event
  BusinessLogger.logUserAction('chapter_versions_viewed', user.id, {
    chapterId,
    versionsCount: versions.length,
    limit: validatedParams.limit,
    timestamp: new Date().toISOString()
  });

  logger.info('Chapter versions retrieved', {
    userId: user.id,
    chapterId,
    versionsCount: versions.length,
    limit: validatedParams.limit
  });

  return NextResponse.json({
    success: true,
    data: versions,
  });
}

// Apply middleware and export handlers
export const GET = withErrorHandler(withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
})(withAuth(handleGet)));
