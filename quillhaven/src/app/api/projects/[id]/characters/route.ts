import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createCharacter,
  getProjectCharacters,
  type CreateCharacterData,
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

async function handleGetCharacters(
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

  // Get project characters with performance monitoring
  const characters = await PerformanceLogger.measureAsync(
    'project_characters_retrieval',
    async () => {
      try {
        return await getProjectCharacters(projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_characters_viewed', user.id, {
    projectId,
    charactersCount: characters.length,
    timestamp: new Date().toISOString(),
  });

  logger.info('Project characters retrieved', {
    userId: user.id,
    projectId,
    charactersCount: characters.length,
  });

  return NextResponse.json({
    success: true,
    data: characters,
  });
}

async function handleCreateCharacter(
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

  // Validate role if provided
  if (body.role) {
    const validRoles = ['PROTAGONIST', 'ANTAGONIST', 'SUPPORTING', 'MINOR'];
    if (!validRoles.includes(body.role)) {
      throw new ValidationError('Invalid character role');
    }
  }

  const characterData: CreateCharacterData = {
    name: sanitizeText(nameValidation.sanitizedData as string),
    description: body.description ? sanitizeText(body.description) : undefined,
    role: body.role ? (body.role as CharacterRole) : undefined,
    developmentArc: body.developmentArc
      ? sanitizeText(body.developmentArc)
      : undefined,
    firstAppearance: body.firstAppearance
      ? sanitizeText(body.firstAppearance)
      : undefined,
  };

  // Additional validation for field lengths
  if (characterData.description && characterData.description.length > 2000) {
    throw new ValidationError(
      'Character description too long (max 2000 characters)'
    );
  }

  if (characterData.role && characterData.role.length > 100) {
    throw new ValidationError('Character role too long (max 100 characters)');
  }

  if (
    characterData.developmentArc &&
    characterData.developmentArc.length > 1000
  ) {
    throw new ValidationError(
      'Character development arc too long (max 1000 characters)'
    );
  }

  if (
    characterData.firstAppearance &&
    characterData.firstAppearance.length > 200
  ) {
    throw new ValidationError(
      'Character first appearance too long (max 200 characters)'
    );
  }

  // Create character with performance monitoring
  const character = await PerformanceLogger.measureAsync(
    'character_creation',
    async () => {
      try {
        return await createCharacter(projectId, characterData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, characterName: characterData.name }
  );

  // Log business event
  BusinessLogger.logUserAction('character_created', user.id, {
    projectId,
    characterId: character.id,
    characterName: character.name,
    role: character.role,
    timestamp: new Date().toISOString(),
  });

  logger.info('Character created successfully', {
    userId: user.id,
    projectId,
    characterId: character.id,
    characterName: character.name,
    role: character.role,
  });

  return NextResponse.json(
    {
      success: true,
      data: character,
    },
    { status: 201 }
  );
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetCharacters))
);

export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 creations per minute
  })(withAuth(handleCreateCharacter))
);
