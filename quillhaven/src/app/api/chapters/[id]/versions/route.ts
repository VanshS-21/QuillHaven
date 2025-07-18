import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { getChapterVersions } from '@/services/chapterService';
import { z } from 'zod';

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
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId } = await params;
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

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listVersionsSchema.parse(queryParams);

    const versions = await getChapterVersions(
      chapterId,
      user.id,
      validatedParams.limit
    );

    return NextResponse.json({
      success: true,
      data: versions,
    });
  } catch (error) {
    console.error('Error getting chapter versions:', error);

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
          error: 'Chapter not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get chapter versions',
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
