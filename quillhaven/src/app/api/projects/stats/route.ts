import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { getProjectStats } from '@/services/projectService';
import {
  withErrorHandler,
  AuthenticationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

/**
 * GET /api/projects/stats - Get user's project statistics for dashboard
 */
async function handleGet(req: NextRequest) {
  const user = (req as AuthenticatedRequest).user;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Get project stats with performance monitoring
  const stats = await PerformanceLogger.measureAsync(
    'project_stats_generation',
    async () => {
      try {
        return await getProjectStats(user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id }
  );

  // Log business event
  BusinessLogger.logUserAction('project_stats_viewed', user.id, {
    statsData: {
      totalProjects: stats.totalProjects,
      totalChapters: 0, // totalChapters not available in stats
      totalWords: stats.totalWordCount,
    },
    timestamp: new Date().toISOString(),
  });

  logger.info('Project stats retrieved', {
    userId: user.id,
    totalProjects: stats.totalProjects,
    totalChapters: 0, // totalChapters not available in stats
    totalWords: stats.totalWordCount,
  });

  return NextResponse.json({
    success: true,
    data: stats,
  });
}

// Apply middleware and export handler
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  })(withAuth(handleGet))
);
