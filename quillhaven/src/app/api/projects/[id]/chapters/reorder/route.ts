import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { reorderChapters } from '@/services/chapterService';
import { z } from 'zod';

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

    // Validate project ID format
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
    const validatedData = reorderChaptersSchema.parse(body);

    // Validate that orders are sequential and start from 1
    const orders = validatedData.chapters
      .map((c) => c.order)
      .sort((a, b) => a - b);
    const expectedOrders = Array.from(
      { length: orders.length },
      (_, i) => i + 1
    );

    if (!orders.every((order, index) => order === expectedOrders[index])) {
      return NextResponse.json(
        {
          success: false,
          error: 'Chapter orders must be sequential starting from 1',
        },
        { status: 400 }
      );
    }

    // Check for duplicate chapter IDs
    const chapterIds = validatedData.chapters.map((c) => c.id);
    const uniqueIds = new Set(chapterIds);
    if (uniqueIds.size !== chapterIds.length) {
      return NextResponse.json(
        {
          success: false,
          error: 'Duplicate chapter IDs are not allowed',
        },
        { status: 400 }
      );
    }

    const updatedChapters = await reorderChapters(
      projectId,
      user.id,
      validatedData.chapters
    );

    return NextResponse.json({
      success: true,
      data: updatedChapters,
      message: 'Chapters reordered successfully',
    });
  } catch (error) {
    console.error('Error reordering chapters:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid reorder data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Project not found or access denied',
          },
          { status: 404 }
        );
      }

      if (error.message.includes('do not belong')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Some chapters do not belong to this project',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to reorder chapters',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const PUT = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 reorder operations per minute
})(withAuth(handlePut));
