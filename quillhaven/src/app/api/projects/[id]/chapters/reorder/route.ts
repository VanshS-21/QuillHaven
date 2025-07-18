import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { reorderChapters } from '@/services/chapterService';
import { z } from 'zod';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schema for chapter reordering
const reorderChaptersSchema = z.object({
  chapters: z
    .array(
      z.object({
        id: z.string().min(1, 'Chapter ID is required'),
        order: z.number().min(1, 'Order must be at least 1'),
      })
    )
    .min(1, 'At least one chapter is required')
    .max(1000, 'Too many chapters to reorder'),
});

/**
 * PUT /api/projects/[id]/chapters/reorder - Reorder chapters within a project
 */
async function handlePut(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Parse and validate request body
  let body;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  let validatedData;
  try {
    validatedData = reorderChaptersSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid reorder data', error.issues);
    }
    throw error;
  }

  // Validate that orders are sequential and start from 1
  const orders = validatedData.chapters
    .map((c) => c.order)
    .sort((a, b) => a - b);
  const expectedOrders = Array.from({ length: orders.length }, (_, i) => i + 1);

  if (!orders.every((order, index) => order === expectedOrders[index])) {
    throw new ValidationError(
      'Chapter orders must be sequential starting from 1'
    );
  }

  // Check for duplicate chapter IDs
  const chapterIds = validatedData.chapters.map((c) => c.id);
  const uniqueIds = new Set(chapterIds);
  if (uniqueIds.size !== chapterIds.length) {
    throw new ValidationError('Duplicate chapter IDs are not allowed');
  }

  // Reorder chapters with performance monitoring
  const updatedChapters = await PerformanceLogger.measureAsync(
    'chapters_reorder',
    async () => {
      try {
        return await reorderChapters(
          projectId,
          user.id,
          validatedData.chapters
        );
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            throw new NotFoundError('Project not found or access denied');
          }
          if (error.message.includes('do not belong')) {
            throw new ValidationError(
              'Some chapters do not belong to this project'
            );
          }
        }
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, chaptersCount: validatedData.chapters.length }
  );

  // Log business event
  BusinessLogger.logUserAction('chapters_reordered', user.id, {
    projectId,
    chaptersCount: validatedData.chapters.length,
    chapterIds: chapterIds,
    timestamp: new Date().toISOString(),
  });

  logger.info('Chapters reordered successfully', {
    userId: user.id,
    projectId,
    chaptersCount: validatedData.chapters.length,
    chapterIds: chapterIds,
  });

  return NextResponse.json({
    success: true,
    data: updatedChapters,
    message: 'Chapters reordered successfully',
  });
}

// Apply middleware and export handlers
export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 reorder operations per minute
  })(withAuth(handlePut))
);
