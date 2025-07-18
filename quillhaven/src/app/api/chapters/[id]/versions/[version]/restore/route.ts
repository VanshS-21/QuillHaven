import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { restoreChapterVersion } from '@/services/chapterService';

/**
 * POST /api/chapters/[id]/versions/[version]/restore - Restore chapter to specific version
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId, version: versionStr } = await params;

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

    // Validate and parse version number
    const version = parseInt(versionStr, 10);
    if (isNaN(version) || version < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid version number',
        },
        { status: 400 }
      );
    }

    const restoredChapter = await restoreChapterVersion(
      chapterId,
      user.id,
      version
    );

    return NextResponse.json({
      success: true,
      data: restoredChapter,
      message: `Chapter restored to version ${version}`,
    });
  } catch (error) {
    console.error('Error restoring chapter version:', error);

    if (error instanceof Error) {
      if (error.message.includes('Chapter not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Chapter not found or access denied',
          },
          { status: 404 }
        );
      }

      if (error.message.includes('Version not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Version not found',
          },
          { status: 404 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to restore chapter version',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const POST = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 20, // 20 restore operations per minute
})(withAuth(handlePost));
