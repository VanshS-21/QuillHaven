import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { getProjectStats } from '@/services/projectService';

/**
 * GET /api/projects/stats - Get user's project statistics for dashboard
 */
async function handleGet(req: NextRequest) {
  try {
    const user = (req as any).user;

    const stats = await getProjectStats(user.id);

    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting project stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get project statistics',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handler
export const GET = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
})(withAuth(handleGet));