import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import { getProjectContext } from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

async function handleGetProjectContext(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;

  // Verify authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError();
  }

  // Verify project ownership with performance monitoring
  const hasAccess = await PerformanceLogger.measureAsync(
    'project_ownership_validation',
    async () => {
      try {
        return await validateProjectOwnership(projectId, authResult.user!.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: authResult.user.id, projectId }
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
    { userId: authResult.user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_context_viewed', authResult.user.id, {
    projectId,
    charactersCount: projectContext.characters?.length || 0,
    plotThreadsCount: projectContext.plotThreads?.length || 0,
    worldElementsCount: projectContext.worldElements?.length || 0,
    timestamp: new Date().toISOString()
  });

  logger.info('Project context retrieved', {
    userId: authResult.user.id,
    projectId,
    charactersCount: projectContext.characters?.length || 0,
    plotThreadsCount: projectContext.plotThreads?.length || 0,
    worldElementsCount: projectContext.worldElements?.length || 0
  });

  return NextResponse.json({
    success: true,
    data: projectContext,
  });
}

export const GET = withErrorHandler(handleGetProjectContext);
