import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import { getProjectContext } from '@/services/contextService';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import {
  withErrorHandler,
  AuthenticationError,
  NotFoundError,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

async function handleGetProjectContext(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Verify project ownership with performance monitoring
  const hasAccess = await PerformanceLogger.measureAsync(
    'project_ownership_validation',
    async () => {
      try {
        return await validateProjectOwnership(projectId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  if (!hasAccess) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Get complete project context with performance monitoring
  const projectContext = await PerformanceLogger.measureAsync(
    'project_context_retrieval',
    async () => {
      try {
        return await getProjectContext(projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_context_viewed', user.id, {
    projectId,
    charactersCount: projectContext.characters?.length || 0,
    plotThreadsCount: projectContext.plotThreads?.length || 0,
    worldElementsCount: projectContext.worldElements?.length || 0,
    timestamp: new Date().toISOString(),
  });

  logger.info('Project context retrieved', {
    userId: user.id,
    projectId,
    charactersCount: projectContext.characters?.length || 0,
    plotThreadsCount: projectContext.plotThreads?.length || 0,
    worldElementsCount: projectContext.worldElements?.length || 0,
  });

  return NextResponse.json({
    success: true,
    data: projectContext,
  });
}

// Apply middleware with error handling and rate limiting
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  })(withAuth(handleGetProjectContext))
);
