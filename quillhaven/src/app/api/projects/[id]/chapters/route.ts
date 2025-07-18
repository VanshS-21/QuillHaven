import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { createChapter, listChapters } from '@/services/chapterService';
import { z } from 'zod';

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
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: projectId } = await params;
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

    // Validate project ID
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listChaptersSchema.parse(queryParams);

    const result = await listChapters(projectId, user.id, validatedParams);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing chapters:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list chapters',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/chapters - Create a new chapter
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: projectId } = await params;
    const body = await req.json();

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

    // Validate project ID
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validatedData = createChapterSchema.parse(body);

    const chapter = await createChapter(projectId, user.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: chapter,
        message: 'Chapter created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating chapter:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chapter data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create chapter',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const GET = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
})(withAuth(handleGet));

export const POST = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 chapter creations per minute
})(withAuth(handlePost));
