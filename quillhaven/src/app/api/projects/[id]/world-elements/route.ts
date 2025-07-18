import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createWorldElement,
  getProjectWorldElements,
  type CreateWorldElementData,
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

async function handleGetWorldElements(
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

  // Get project world elements with performance monitoring
  const worldElements = await PerformanceLogger.measureAsync(
    'project_world_elements_retrieval',
    async () => {
      try {
        return await getProjectWorldElements(projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_world_elements_viewed', user.id, {
    projectId,
    worldElementsCount: worldElements.length,
    timestamp: new Date().toISOString(),
  });

  logger.info('Project world elements retrieved', {
    userId: user.id,
    projectId,
    worldElementsCount: worldElements.length,
  });

  return NextResponse.json({
    success: true,
    data: worldElements,
  });
}

async function handleCreateWorldElement(
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
  const nameValidation = validateString(body.name, 'name', {
    required: true,
    minLength: 1,
    maxLength: 100,
  });

  if (!nameValidation.isValid) {
    throw new ValidationError(nameValidation.errors.join(', '));
  }

  const typeValidation = validateString(body.type, 'type', {
    required: true,
    minLength: 1,
    maxLength: 50,
  });

  if (!typeValidation.isValid) {
    throw new ValidationError(typeValidation.errors.join(', '));
  }

  // Validate world element type
  const validTypes = ['LOCATION', 'RULE', 'CULTURE', 'HISTORY'];
  if (!validTypes.includes(typeValidation.sanitizedData as string)) {
    throw new ValidationError('Invalid world element type');
  }

  const worldElementData: CreateWorldElementData = {
    type: typeValidation.sanitizedData as WorldElementType,
    name: sanitizeText(nameValidation.sanitizedData as string),
    description: body.description ? sanitizeText(body.description) : undefined,
    significance: body.significance
      ? sanitizeText(body.significance)
      : undefined,
    relatedElementIds: Array.isArray(body.relatedElementIds)
      ? body.relatedElementIds
      : [],
  };

  // Additional validation for description length
  if (
    worldElementData.description &&
    worldElementData.description.length > 2000
  ) {
    throw new ValidationError(
      'World element description too long (max 2000 characters)'
    );
  }

  if (
    worldElementData.significance &&
    worldElementData.significance.length > 1000
  ) {
    throw new ValidationError(
      'World element significance too long (max 1000 characters)'
    );
  }

  // Create world element with performance monitoring
  const worldElement = await PerformanceLogger.measureAsync(
    'world_element_creation',
    async () => {
      try {
        return await createWorldElement(projectId, worldElementData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, worldElementName: worldElementData.name }
  );

  // Log business event
  BusinessLogger.logUserAction('world_element_created', user.id, {
    projectId,
    worldElementId: worldElement.id,
    worldElementName: worldElement.name,
    type: worldElement.type,
    timestamp: new Date().toISOString(),
  });

  logger.info('World element created successfully', {
    userId: user.id,
    projectId,
    worldElementId: worldElement.id,
    worldElementName: worldElement.name,
    type: worldElement.type,
  });

  return NextResponse.json(
    {
      success: true,
      data: worldElement,
    },
    { status: 201 }
  );
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetWorldElements))
);

export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 creations per minute
  })(withAuth(handleCreateWorldElement))
);
