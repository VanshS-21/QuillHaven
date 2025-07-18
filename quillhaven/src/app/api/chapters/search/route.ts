import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

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
  try {
    const user = (req as AuthenticatedRequest).user;
    const { searchParams } = new URL(req.url);

    // Check if user is authenticated
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = searchChaptersSchema.parse(queryParams);

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

    // Get total count
    const total = await prisma.chapter.count({ where });

    // Get chapters with project info
    const chapters = await prisma.chapter.findMany({
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
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

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
  } catch (error) {
    console.error('Error searching chapters:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid search parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to search chapters',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const GET = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 search requests per minute
})(withAuth(handleGet));
