import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getPlotThread,
  updatePlotThread,
  deletePlotThread,
  type UpdatePlotThreadData,
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

async function handleGetPlotThread(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, plotThreadId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!plotThreadId || typeof plotThreadId !== 'string') {
    throw new ValidationError('Invalid plot thread ID');
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

  // Get plot thread with performance monitoring
  const plotThread = await PerformanceLogger.measureAsync(
    'plot_thread_retrieval',
    async () => {
      try {
        return await getPlotThread(plotThreadId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, plotThreadId }
  );

  if (!plotThread) {
    throw new NotFoundError('Plot thread not found');
  }

  logger.info('Plot thread retrieved', {
    userId: user.id,
    projectId,
    plotThreadId,
    plotThreadTitle: plotThread.title,
  });

  return NextResponse.json({
    success: true,
    data: plotThread,
  });
}

async function handleUpdatePlotThread(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, plotThreadId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!plotThreadId || typeof plotThreadId !== 'string') {
    throw new ValidationError('Invalid plot thread ID');
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

  // Validate and sanitize input fields (only if provided)
  const updateData: UpdatePlotThreadData = {};

  if (body.title !== undefined) {
    const titleValidation = validateString(body.title, 'title', {
      required: false,
      minLength: 1,
      maxLength: 200,
    });

    if (!titleValidation.isValid) {
      throw new ValidationError(titleValidation.errors.join(', '));
    }

    if (titleValidation.sanitizedData) {
      updateData.title = sanitizeText(titleValidation.sanitizedData as string);
    }
  }

  if (body.description !== undefined) {
    updateData.description = body.description
      ? sanitizeText(body.description)
      : undefined;
    if (updateData.description && updateData.description.length > 2000) {
      throw new ValidationError(
        'Plot thread description too long (max 2000 characters)'
      );
    }
  }

  if (body.status !== undefined) {
    const validStatuses = ['ACTIVE', 'RESOLVED', 'ABANDONED'];
    if (body.status && !validStatuses.includes(body.status)) {
      throw new ValidationError('Invalid plot thread status');
    }
    updateData.status = body.status;
  }

  if (body.relatedCharacterIds !== undefined) {
    updateData.relatedCharacterIds = Array.isArray(body.relatedCharacterIds)
      ? body.relatedCharacterIds
      : [];
  }

  // Update plot thread with performance monitoring
  const plotThread = await PerformanceLogger.measureAsync(
    'plot_thread_update',
    async () => {
      try {
        return await updatePlotThread(plotThreadId, projectId, updateData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, plotThreadId }
  );

  if (!plotThread) {
    throw new NotFoundError('Plot thread not found');
  }

  // Log business event
  BusinessLogger.logUserAction('plot_thread_updated', user.id, {
    projectId,
    plotThreadId,
    plotThreadTitle: plotThread.title,
    fieldsUpdated: Object.keys(updateData),
    timestamp: new Date().toISOString(),
  });

  logger.info('Plot thread updated successfully', {
    userId: user.id,
    projectId,
    plotThreadId,
    plotThreadTitle: plotThread.title,
    fieldsUpdated: Object.keys(updateData),
  });

  return NextResponse.json({
    success: true,
    data: plotThread,
  });
}

async function handleDeletePlotThread(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, plotThreadId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!plotThreadId || typeof plotThreadId !== 'string') {
    throw new ValidationError('Invalid plot thread ID');
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

  // Delete plot thread with performance monitoring
  const success = await PerformanceLogger.measureAsync(
    'plot_thread_deletion',
    async () => {
      try {
        return await deletePlotThread(plotThreadId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, plotThreadId }
  );

  if (!success) {
    throw new NotFoundError('Plot thread not found');
  }

  // Log business event
  BusinessLogger.logUserAction('plot_thread_deleted', user.id, {
    projectId,
    plotThreadId,
    timestamp: new Date().toISOString(),
  });

  logger.info('Plot thread deleted successfully', {
    userId: user.id,
    projectId,
    plotThreadId,
  });

  return NextResponse.json({
    success: true,
    message: 'Plot thread deleted successfully',
  });
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetPlotThread))
);

export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 updates per minute
  })(withAuth(handleUpdatePlotThread))
);

export const DELETE = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 deletions per minute
  })(withAuth(handleDeletePlotThread))
);
