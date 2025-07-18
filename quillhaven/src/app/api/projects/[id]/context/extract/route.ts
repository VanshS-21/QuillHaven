import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  extractContextFromContent,
  updateContextFromExtraction,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, ValidationError, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

async function handleContextExtraction(
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

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  const { content, autoUpdate = false } = body;

  // Validate required fields
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    throw new ValidationError('Content is required for context extraction');
  }

  if (content.length > 100000) {
    throw new ValidationError('Content too long for context extraction');
  }

  // Extract context from content with AI degradation
  const extractedContext = await withGeminiDegradation(
    async () => {
      return await PerformanceLogger.measureAsync(
        'context_extraction',
        async () => {
          try {
            return await extractContextFromContent(content, projectId);
          } catch (error) {
            throw handleDatabaseError(error);
          }
        },
        { userId: authResult.user!.id, projectId, contentLength: content.length }
      );
    },
    async () => {
      logger.warn('AI service unavailable for context extraction', {
        userId: authResult.user!.id,
        projectId
      });
      return {
        characters: [],
        plotPoints: [],
        worldElements: [],
        timelineEvents: [],
        message: 'AI service temporarily unavailable'
      };
    }
  );

  // Optionally update project context with extracted information
  if (autoUpdate && extractedContext.characters?.length > 0) {
    await PerformanceLogger.measureAsync(
      'context_update_from_extraction',
      async () => {
        try {
          return await updateContextFromExtraction(projectId, extractedContext);
        } catch (error) {
          throw handleDatabaseError(error);
        }
      },
      { userId: authResult.user.id, projectId }
    );
  }

  // Log business event
  BusinessLogger.logUserAction('context_extracted', authResult.user.id, {
    projectId,
    contentLength: content.length,
    charactersFound: extractedContext.characters?.length || 0,
    plotThreadsFound: extractedContext.plotPoints?.length || 0,
    worldElementsFound: extractedContext.worldElements?.length || 0,
    autoUpdate,
    timestamp: new Date().toISOString()
  });

  logger.info('Context extraction completed', {
    userId: authResult.user.id,
    projectId,
    contentLength: content.length,
    charactersFound: extractedContext.characters?.length || 0,
    plotThreadsFound: extractedContext.plotPoints?.length || 0,
    worldElementsFound: extractedContext.worldElements?.length || 0,
    autoUpdate
  });

  return NextResponse.json({
    success: true,
    data: {
      extractedContext,
      autoUpdated: autoUpdate,
    },
  });
}

export const POST = withErrorHandler(handleContextExtraction);
