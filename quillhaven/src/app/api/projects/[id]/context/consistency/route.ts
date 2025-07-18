import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import { checkContextConsistency } from '@/services/contextService';
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
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

async function handleContextConsistencyCheck(
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
        { userId: user.id, projectId }
      );
    },
    async () => {
      logger.warn('AI service unavailable for consistency check', {
        userId: user.id,
        projectId,
      });
      return {
        score: 0,
        issues: [],
        summary: 'AI service temporarily unavailable for consistency analysis',
      };
    }
  );

  // Log business event
  BusinessLogger.logUserAction('context_consistency_checked', user.id, {
    projectId,
    overallScore: consistencyReport.score || 0,
    issuesFound: consistencyReport.issues?.length || 0,
    suggestionsCount: 0, // suggestions not available in ConsistencyReport
    timestamp: new Date().toISOString(),
  });

  logger.info('Context consistency check completed', {
    userId: user.id,
    projectId,
    overallScore: consistencyReport.score || 0,
    issuesFound: consistencyReport.issues?.length || 0,
    suggestionsCount: 0, // suggestions not available in ConsistencyReport
  });

  return NextResponse.json({
    success: true,
    data: consistencyReport,
  });
}

// Apply middleware with error handling and rate limiting (AI operations are resource intensive)
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 consistency checks per minute (AI operations are expensive)
  })(withAuth(handleContextConsistencyCheck))
);
