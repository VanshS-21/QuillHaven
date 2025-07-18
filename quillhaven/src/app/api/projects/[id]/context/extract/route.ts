import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  extractContextFromContent,
  updateContextFromExtraction,
} from '@/services/contextService';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { validateString, sanitizeText } from '@/utils/validation/input';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

async function handleContextExtraction(
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

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  // Validate content field
  const contentValidation = validateString(body.content, 'content', {
    required: true,
    minLength: 1,
    maxLength: 100000,
  });

  if (!contentValidation.isValid) {
    throw new ValidationError(contentValidation.errors.join(', '));
  }

  const content = sanitizeText(contentValidation.sanitizedData as string);
  const autoUpdate = Boolean(body.autoUpdate);

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
        { userId: user.id, projectId, contentLength: content.length }
      );
    },
    async () => {
      logger.warn('AI service unavailable for context extraction', {
        userId: user.id,
        projectId,
      });
      return {
        characters: [],
        plotPoints: [],
        worldElements: [],
        timelineEvents: [],
        message: 'AI service temporarily unavailable',
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
      { userId: user.id, projectId }
    );
  }

  // Log business event
  BusinessLogger.logUserAction('context_extracted', user.id, {
    projectId,
    contentLength: content.length,
    charactersFound: extractedContext.characters?.length || 0,
    plotThreadsFound: extractedContext.plotPoints?.length || 0,
    worldElementsFound: extractedContext.worldElements?.length || 0,
    autoUpdate,
    timestamp: new Date().toISOString(),
  });

  logger.info('Context extraction completed', {
    userId: user.id,
    projectId,
    contentLength: content.length,
    charactersFound: extractedContext.characters?.length || 0,
    plotThreadsFound: extractedContext.plotPoints?.length || 0,
    worldElementsFound: extractedContext.worldElements?.length || 0,
    autoUpdate,
  });

  return NextResponse.json({
    success: true,
    data: {
      extractedContext,
      autoUpdated: autoUpdate,
    },
  });
}

// Apply middleware with error handling and rate limiting (AI operations are resource intensive)
export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 context extractions per minute (AI operations are expensive)
  })(withAuth(handleContextExtraction))
);
