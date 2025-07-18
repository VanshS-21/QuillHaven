import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { createChapter, listChapters } from '@/services/chapterService';
import { z } from 'zod';
import { withErrorHandler, ValidationError, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schemas
const createChapterSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  content: z.string().max(50000, 'Content too long').optional(),
  order: z.number().min(1).optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'EDITED', 'FINAL']).optional(),
});

const listChaptersSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'EDITED', 'FINAL']).optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['title', 'order', 'createdAt', 'updatedAt', 'wordCount'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/projects/[id]/chapters - List chapters for a project
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;
  const { searchParams } = new URL(req.url);

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  
  let validatedParams;
  try {
    validatedParams = listChaptersSchema.parse(queryParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid query parameters', error.issues);
    }
    throw error;
  }

  // List chapters with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'project_chapters_list',
    async () => {
      try {
        return await listChapters(projectId, user.id, validatedParams);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new NotFoundError('Project not found or access denied');
        }
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, ...validatedParams }
  );

  // Log business event
  BusinessLogger.logUserAction('project_chapters_listed', user.id, {
    projectId,
    chaptersCount: result.chapters?.length || 0,
    totalChapters: result.pagination?.total || 0,
    filters: validatedParams,
    timestamp: new Date().toISOString()
  });

  logger.info('Project chapters listed', {
    userId: user.id,
    projectId,
    chaptersCount: result.chapters?.length || 0,
    totalChapters: result.pagination?.total || 0
  });

  return NextResponse.json({
    success: true,
    data: result,
  });
}

/**
 * POST /api/projects/[id]/chapters - Create a new chapter
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID
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
    validatedData = createChapterSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid chapter data', error.issues);
    }
    throw error;
  }

  // Create chapter with performance monitoring
  const chapter = await PerformanceLogger.measureAsync(
    'chapter_creation',
    async () => {
      try {
        return await createChapter(projectId, user.id, validatedData);
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found')) {
          throw new NotFoundError('Project not found or access denied');
        }
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, title: validatedData.title }
  );

  // Log business event
  BusinessLogger.logUserAction('chapter_created', user.id, {
    projectId,
    chapterId: chapter.id,
    title: chapter.title,
    status: chapter.status,
    wordCount: chapter.wordCount || 0,
    timestamp: new Date().toISOString()
  });

  logger.info('Chapter created successfully', {
    userId: user.id,
    projectId,
    chapterId: chapter.id,
    title: chapter.title,
    status: chapter.status
  });

  return NextResponse.json(
    {
      success: true,
      data: chapter,
      message: 'Chapter created successfully',
    },
    { status: 201 }
  );
}

// Apply middleware and export handlers
export const GET = withErrorHandler(withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
})(withAuth(handleGet)));

export const POST = withErrorHandler(withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 chapter creations per minute
})(withAuth(handlePost)));
