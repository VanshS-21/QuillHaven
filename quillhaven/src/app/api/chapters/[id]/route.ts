import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import {
  getChapter,
  updateChapter,
  deleteChapter,
} from '@/services/chapterService';
import { z } from 'zod';
import {
  withErrorHandler,
  ValidationError,
  NotFoundError,
  AuthenticationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schema for chapter updates
const updateChapterSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long')
    .optional(),
  content: z.string().max(50000, 'Content too long').optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'EDITED', 'FINAL']).optional(),
});

/**
 * GET /api/chapters/[id] - Get a specific chapter with versions
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: chapterId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate chapter ID format
  if (!chapterId || typeof chapterId !== 'string') {
    throw new ValidationError('Invalid chapter ID');
  }

  const chapter = await PerformanceLogger.measureAsync(
    'get_chapter',
    async () => {
      try {
        return await getChapter(chapterId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, chapterId }
  );

  if (!chapter) {
    throw new NotFoundError('Chapter not found or access denied');
  }

  logger.info('Chapter retrieved successfully', {
    userId: user.id,
    chapterId,
    projectId: chapter.projectId,
    chapterTitle: chapter.title,
  });

  return NextResponse.json({
    success: true,
    data: chapter,
  });
}

/**
 * PUT /api/chapters/[id] - Update a specific chapter
 */
async function handlePut(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: chapterId } = await params;
  const body = await req.json();

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate chapter ID format
  if (!chapterId || typeof chapterId !== 'string') {
    throw new ValidationError('Invalid chapter ID');
  }

  // Validate request body
  let validatedData;
  try {
    validatedData = updateChapterSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid chapter data', error.issues);
    }
    throw error;
  }

  // Check if there's actually data to update
  if (Object.keys(validatedData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const updatedChapter = await PerformanceLogger.measureAsync(
    'update_chapter',
    async () => {
      try {
        return await updateChapter(chapterId, user.id, validatedData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    {
      userId: user.id,
      chapterId,
      fieldsUpdated: Object.keys(validatedData),
      contentLength: validatedData.content?.length || 0,
    }
  );

  if (!updatedChapter) {
    throw new NotFoundError('Chapter not found or access denied');
  }

  // Log business event
  BusinessLogger.logUserAction('chapter_updated', user.id, {
    chapterId,
    projectId: updatedChapter.projectId,
    fieldsUpdated: Object.keys(validatedData),
    newStatus: validatedData.status,
  });

  logger.info('Chapter updated successfully', {
    userId: user.id,
    chapterId,
    projectId: updatedChapter.projectId,
    fieldsUpdated: Object.keys(validatedData),
  });

  return NextResponse.json({
    success: true,
    data: updatedChapter,
    message: 'Chapter updated successfully',
  });
}

/**
 * DELETE /api/chapters/[id] - Delete a specific chapter
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: chapterId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate chapter ID format
  if (!chapterId || typeof chapterId !== 'string') {
    throw new ValidationError('Invalid chapter ID');
  }

  const deleted = await PerformanceLogger.measureAsync(
    'delete_chapter',
    async () => {
      try {
        return await deleteChapter(chapterId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, chapterId }
  );

  if (!deleted) {
    throw new NotFoundError('Chapter not found or access denied');
  }

  // Log business event
  BusinessLogger.logUserAction('chapter_deleted', user.id, {
    chapterId,
  });

  logger.info('Chapter deleted successfully', {
    userId: user.id,
    chapterId,
  });

  return NextResponse.json({
    success: true,
    message: 'Chapter deleted successfully',
  });
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGet))
);

export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 updates per minute (for auto-save)
  })(withAuth(handlePut))
);

export const DELETE = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 deletions per minute
  })(withAuth(handleDelete))
);
