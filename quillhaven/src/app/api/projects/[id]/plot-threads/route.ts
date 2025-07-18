import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createPlotThread,
  getProjectPlotThreads,
  type CreatePlotThreadData,
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

async function handleGetPlotThreads(
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

  // Get project plot threads with performance monitoring
  const plotThreads = await PerformanceLogger.measureAsync(
    'project_plot_threads_retrieval',
    async () => {
      try {
        return await getProjectPlotThreads(projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_plot_threads_viewed', user.id, {
    projectId,
    plotThreadsCount: plotThreads.length,
    timestamp: new Date().toISOString(),
  });

  logger.info('Project plot threads retrieved', {
    userId: user.id,
    projectId,
    plotThreadsCount: plotThreads.length,
  });

  return NextResponse.json({
    success: true,
    data: plotThreads,
  });
}

async function handleCreatePlotThread(
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

  // Validate and sanitize input fields
  const titleValidation = validateString(body.title, 'title', {
    required: true,
    minLength: 1,
    maxLength: 200,
  });

  if (!titleValidation.isValid) {
    throw new ValidationError(titleValidation.errors.join(', '));
  }

  const plotThreadData: CreatePlotThreadData = {
    title: sanitizeText(titleValidation.sanitizedData as string),
    description: body.description ? sanitizeText(body.description) : undefined,
    status: body.status || 'ACTIVE',
    relatedCharacterIds: Array.isArray(body.relatedCharacterIds)
      ? body.relatedCharacterIds
      : [],
  };

  // Additional validation for description length
  if (plotThreadData.description && plotThreadData.description.length > 2000) {
    throw new ValidationError(
      'Plot thread description too long (max 2000 characters)'
    );
  }

  // Validate status enum
  const validStatuses = ['ACTIVE', 'RESOLVED', 'ABANDONED'];
  if (plotThreadData.status && !validStatuses.includes(plotThreadData.status)) {
    throw new ValidationError('Invalid plot thread status');
  }

  // Create plot thread with performance monitoring
  const plotThread = await PerformanceLogger.measureAsync(
    'plot_thread_creation',
    async () => {
      try {
        return await createPlotThread(projectId, plotThreadData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, plotThreadTitle: plotThreadData.title }
  );

  // Log business event
  BusinessLogger.logUserAction('plot_thread_created', user.id, {
    projectId,
    plotThreadId: plotThread.id,
    plotThreadTitle: plotThread.title,
    status: plotThread.status,
    timestamp: new Date().toISOString(),
  });

  logger.info('Plot thread created successfully', {
    userId: user.id,
    projectId,
    plotThreadId: plotThread.id,
    plotThreadTitle: plotThread.title,
    status: plotThread.status,
  });

  return NextResponse.json(
    {
      success: true,
      data: plotThread,
    },
    { status: 201 }
  );
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetPlotThreads))
);

export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 creations per minute
  })(withAuth(handleCreatePlotThread))
);
