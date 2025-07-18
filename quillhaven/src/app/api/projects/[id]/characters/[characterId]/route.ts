import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getCharacter,
  updateCharacter,
  deleteCharacter,
  type UpdateCharacterData,
} from '@/services/contextService';
import type { CharacterRole } from '@/types/database';
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

async function handleGetCharacter(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, characterId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!characterId || typeof characterId !== 'string') {
    throw new ValidationError('Invalid character ID');
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

  // Get character with performance monitoring
  const character = await PerformanceLogger.measureAsync(
    'character_retrieval',
    async () => {
      try {
        return await getCharacter(characterId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, characterId }
  );

  if (!character) {
    throw new NotFoundError('Character not found');
  }

  logger.info('Character retrieved', {
    userId: user.id,
    projectId,
    characterId,
    characterName: character.name,
  });

  return NextResponse.json({
    success: true,
    data: character,
  });
}

async function handleUpdateCharacter(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, characterId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!characterId || typeof characterId !== 'string') {
    throw new ValidationError('Invalid character ID');
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
  const updateData: UpdateCharacterData = {};

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

  if (body.description !== undefined) {
    updateData.description = body.description
      ? sanitizeText(body.description)
      : undefined;
    if (updateData.description && updateData.description.length > 2000) {
      throw new ValidationError(
        'Character description too long (max 2000 characters)'
      );
    }
  }

  if (body.role !== undefined) {
    const validRoles = ['PROTAGONIST', 'ANTAGONIST', 'SUPPORTING', 'MINOR'];
    if (body.role && !validRoles.includes(body.role)) {
      throw new ValidationError('Invalid character role');
    }
    updateData.role = body.role
      ? (sanitizeText(body.role) as CharacterRole)
      : undefined;
  }

  if (body.developmentArc !== undefined) {
    updateData.developmentArc = body.developmentArc
      ? sanitizeText(body.developmentArc)
      : undefined;
    if (updateData.developmentArc && updateData.developmentArc.length > 1000) {
      throw new ValidationError(
        'Character development arc too long (max 1000 characters)'
      );
    }
  }

  if (body.firstAppearance !== undefined) {
    updateData.firstAppearance = body.firstAppearance
      ? sanitizeText(body.firstAppearance)
      : undefined;
    if (updateData.firstAppearance && updateData.firstAppearance.length > 200) {
      throw new ValidationError(
        'Character first appearance too long (max 200 characters)'
      );
    }
  }

  // Update character with performance monitoring
  const character = await PerformanceLogger.measureAsync(
    'character_update',
    async () => {
      try {
        return await updateCharacter(characterId, projectId, updateData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, characterId }
  );

  if (!character) {
    throw new NotFoundError('Character not found');
  }

  // Log business event
  BusinessLogger.logUserAction('character_updated', user.id, {
    projectId,
    characterId,
    characterName: character.name,
    fieldsUpdated: Object.keys(updateData),
    timestamp: new Date().toISOString(),
  });

  logger.info('Character updated successfully', {
    userId: user.id,
    projectId,
    characterId,
    characterName: character.name,
    fieldsUpdated: Object.keys(updateData),
  });

  return NextResponse.json({
    success: true,
    data: character,
  });
}

async function handleDeleteCharacter(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId, characterId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate IDs format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  if (!characterId || typeof characterId !== 'string') {
    throw new ValidationError('Invalid character ID');
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

  // Delete character with performance monitoring
  const success = await PerformanceLogger.measureAsync(
    'character_deletion',
    async () => {
      try {
        return await deleteCharacter(characterId, projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, characterId }
  );

  if (!success) {
    throw new NotFoundError('Character not found');
  }

  // Log business event
  BusinessLogger.logUserAction('character_deleted', user.id, {
    projectId,
    characterId,
    timestamp: new Date().toISOString(),
  });

  logger.info('Character deleted successfully', {
    userId: user.id,
    projectId,
    characterId,
  });

  return NextResponse.json({
    success: true,
    message: 'Character deleted successfully',
  });
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetCharacter))
);

export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 updates per minute
  })(withAuth(handleUpdateCharacter))
);

export const DELETE = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 deletions per minute
  })(withAuth(handleDeleteCharacter))
);
