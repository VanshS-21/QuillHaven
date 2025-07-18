import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import { checkContextConsistency } from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

async function handleContextConsistencyCheck(
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

  // Check context consistency with AI degradation
  const consistencyReport = await withGeminiDegradation(
    async () => {
      return await PerformanceLogger.measureAsync(
        'context_consistency_check',
        async () => {
          try {
            return await checkContextConsistency(projectId);
          } catch (error) {
            throw handleDatabaseError(error);
          }
        },
        { userId: authResult.user!.id, projectId }
      );
    },
    async () => {
      logger.warn('AI service unavailable for consistency check', {
        userId: authResult.user!.id,
        projectId
      });
      return {
        score: 0,
        issues: [],
        summary: 'AI service temporarily unavailable for consistency analysis'
      };
    }
  );

  // Log business event
  BusinessLogger.logUserAction('context_consistency_checked', authResult.user.id, {
    projectId,
    overallScore: consistencyReport.score || 0,
    issuesFound: consistencyReport.issues?.length || 0,
    suggestionsCount: 0, // suggestions not available in ConsistencyReport
    timestamp: new Date().toISOString()
  });

  logger.info('Context consistency check completed', {
    userId: authResult.user.id,
    projectId,
    overallScore: consistencyReport.score || 0,
    issuesFound: consistencyReport.issues?.length || 0,
    suggestionsCount: 0 // suggestions not available in ConsistencyReport
  });

  return NextResponse.json({
    success: true,
    data: consistencyReport,
  });
}

export const GET = withErrorHandler(handleContextConsistencyCheck);
