import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getWorldElement,
  updateWorldElement,
  deleteWorldElement,
  type UpdateWorldElementData,
} from '@/services/contextService';
import type { WorldElementType } from '@/types/database';
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

async function handleGetWorldElement(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, worldElementId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!worldElementId || typeof worldElementId !== 'string') {
    throw new ValidationError('Invalid world element ID');
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

  // Get world element with performance monitoring
  const worldElement = await PerformanceLogger.measureAsync(
    'world_element_retrieval',
    async () => {
      try {
        return await getWorldElement(worldElementId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, worldElementId }
  );

  if (!worldElement) {
    throw new NotFoundError('World element not found');
  }

  logger.info('World element retrieved', {
    userId: user.id,
    projectId,
    worldElementId,
    worldElementName: worldElement.name,
  });

  return NextResponse.json({
    success: true,
    data: worldElement,
  });
}

async function handleUpdateWorldElement(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, worldElementId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!worldElementId || typeof worldElementId !== 'string') {
    throw new ValidationError('Invalid world element ID');
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
  const updateData: UpdateWorldElementData = {};

  if (body.name !== undefined) {
    const nameValidation = validateString(body.name, 'name', {
      required: false,
      minLength: 1,
      maxLength: 100,
    });

    if (!nameValidation.isValid) {
      throw new ValidationError(nameValidation.errors.join(', '));
    }

    if (nameValidation.sanitizedData) {
      updateData.name = sanitizeText(nameValidation.sanitizedData as string);
    }
  }

  if (body.type !== undefined) {
    const validTypes = ['LOCATION', 'RULE', 'CULTURE', 'HISTORY'];
    if (body.type && !validTypes.includes(body.type)) {
      throw new ValidationError('Invalid world element type');
    }
    updateData.type = body.type ? (body.type as WorldElementType) : undefined;
  }

  if (body.description !== undefined) {
    updateData.description = body.description
      ? sanitizeText(body.description)
      : undefined;
    if (updateData.description && updateData.description.length > 2000) {
      throw new ValidationError(
        'World element description too long (max 2000 characters)'
      );
    }
  }

  if (body.significance !== undefined) {
    updateData.significance = body.significance
      ? sanitizeText(body.significance)
      : undefined;
    if (updateData.significance && updateData.significance.length > 1000) {
      throw new ValidationError(
        'World element significance too long (max 1000 characters)'
      );
    }
  }

  if (body.relatedElementIds !== undefined) {
    updateData.relatedElementIds = Array.isArray(body.relatedElementIds)
      ? body.relatedElementIds
      : [];
  }

  // Update world element with performance monitoring
  const worldElement = await PerformanceLogger.measureAsync(
    'world_element_update',
    async () => {
      try {
        return await updateWorldElement(worldElementId, projectId, updateData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, worldElementId }
  );

  if (!worldElement) {
    throw new NotFoundError('World element not found');
  }

  // Log business event
  BusinessLogger.logUserAction('world_element_updated', user.id, {
    projectId,
    worldElementId,
    worldElementName: worldElement.name,
    fieldsUpdated: Object.keys(updateData),
    timestamp: new Date().toISOString(),
  });

  logger.info('World element updated successfully', {
    userId: user.id,
    projectId,
    worldElementId,
    worldElementName: worldElement.name,
    fieldsUpdated: Object.keys(updateData),
  });

  return NextResponse.json({
    success: true,
    data: worldElement,
  });
}

async function handleDeleteWorldElement(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, worldElementId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!worldElementId || typeof worldElementId !== 'string') {
    throw new ValidationError('Invalid world element ID');
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

  // Delete world element with performance monitoring
  const success = await PerformanceLogger.measureAsync(
    'world_element_deletion',
    async () => {
      try {
        return await deleteWorldElement(worldElementId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, worldElementId }
  );

  if (!success) {
    throw new NotFoundError('World element not found');
  }

  // Log business event
  BusinessLogger.logUserAction('world_element_deleted', user.id, {
    projectId,
    worldElementId,
    timestamp: new Date().toISOString(),
  });

  logger.info('World element deleted successfully', {
    userId: user.id,
    projectId,
    worldElementId,
  });

  return NextResponse.json({
    success: true,
    message: 'World element deleted successfully',
  });
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetWorldElement))
);

export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 updates per minute
  })(withAuth(handleUpdateWorldElement))
);

export const DELETE = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 deletions per minute
  })(withAuth(handleDeleteWorldElement))
);
