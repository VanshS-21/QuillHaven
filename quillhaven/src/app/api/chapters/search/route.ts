import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { withErrorHandler, ValidationError, AuthenticationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schema for chapter search
const searchChaptersSchema = z.object({
  query: z
    .string()
    .min(1, 'Search query is required')
    .max(200, 'Query too long'),
  projectId: z.string().optional(),
  status: z.enum(['DRAFT', 'GENERATED', 'EDITED', 'FINAL']).optional(),
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(50))
    .optional(),
});

/**
 * GET /api/chapters/search - Search chapters across user's projects
 */
async function handleGet(req: NextRequest) {
  const user = (req as AuthenticatedRequest).user;
  const { searchParams } = new URL(req.url);

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Parse and validate query parameters
  const queryParams = Object.fromEntries(searchParams.entries());
  
  let validatedParams;
  try {
    validatedParams = searchChaptersSchema.parse(queryParams);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid search parameters', error.issues);
    }
    throw error;
  }

  const { query, projectId, status, page = 1, limit = 20 } = validatedParams;

  // Build where clause
  const where: Record<string, unknown> = {
    project: { userId: user.id }, // Ensure user owns the projects
    OR: [
      {
        title: {
          contains: query,
          mode: 'insensitive',
        },
      },
      {
        content: {
          contains: query,
          mode: 'insensitive',
        },
      },
    ],
  };

  if (projectId) {
    where.projectId = projectId;
  }

  if (status) {
    where.status = status;
  }

  // Calculate pagination
  const skip = (page - 1) * limit;

  // Get total count and chapters with performance monitoring
  const [total, chapters] = await PerformanceLogger.measureAsync(
    'chapter_search',
    async () => {
      try {
        const [totalCount, chapterResults] = await Promise.all([
          prisma.chapter.count({ where }),
          prisma.chapter.findMany({
            where,
            skip,
            take: limit,
            orderBy: [{ updatedAt: 'desc' }, { order: 'asc' }],
            include: {
              project: {
                select: {
                  id: true,
                  title: true,
                  genre: true,
                },
              },
            },
          })
        ]);
        return [totalCount, chapterResults];
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { 
      userId: user.id, 
      query, 
      projectId, 
      status, 
      page, 
      limit 
    }
  );

  // Calculate pagination info
  const totalPages = Math.ceil(total / limit);

  // Log search activity
  BusinessLogger.logUserAction('chapter_search', user.id, {
    query,
    projectId,
    status,
    resultsCount: chapters.length,
    totalResults: total,
    page,
    limit
  });

  logger.info('Chapter search completed', {
    userId: user.id,
    query,
    projectId,
    status,
    resultsCount: chapters.length,
    totalResults: total,
    page,
    limit,
    duration: Date.now() - Date.now()
  });

  return NextResponse.json({
    success: true,
    data: {
      chapters,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      query,
    },
  });
}

// Apply middleware and export handlers
export const GET = withErrorHandler(withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 search requests per minute
})(withAuth(handleGet)));
