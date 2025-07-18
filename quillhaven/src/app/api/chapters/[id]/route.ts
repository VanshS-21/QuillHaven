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
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId } = await params;

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

    // Validate chapter ID format
    if (!chapterId || typeof chapterId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chapter ID',
        },
        { status: 400 }
      );
    }

    const chapter = await getChapter(chapterId, user.id);

    if (!chapter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chapter not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: chapter,
    });
  } catch (error) {
    console.error('Error getting chapter:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get chapter',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/chapters/[id] - Update a specific chapter
 */
async function handlePut(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId } = await params;
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

    // Validate chapter ID format
    if (!chapterId || typeof chapterId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chapter ID',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validatedData = updateChapterSchema.parse(body);

    // Check if there's actually data to update
    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
        },
        { status: 400 }
      );
    }

    const updatedChapter = await updateChapter(
      chapterId,
      user.id,
      validatedData
    );

    if (!updatedChapter) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chapter not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedChapter,
      message: 'Chapter updated successfully',
    });
  } catch (error) {
    console.error('Error updating chapter:', error);

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

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update chapter',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/chapters/[id] - Delete a specific chapter
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId } = await params;

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

    // Validate chapter ID format
    if (!chapterId || typeof chapterId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chapter ID',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteChapter(chapterId, user.id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chapter not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Chapter deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting chapter:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete chapter',
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

export const PUT = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 updates per minute (for auto-save)
})(withAuth(handlePut));

export const DELETE = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 deletions per minute
})(withAuth(handleDelete));
