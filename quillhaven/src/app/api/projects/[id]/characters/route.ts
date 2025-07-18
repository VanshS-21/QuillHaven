import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createCharacter,
  getProjectCharacters,
  type CreateCharacterData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, ValidationError, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

async function handleGetCharacters(
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
    { userId: authResult.user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_characters_viewed', authResult.user.id, {
    projectId,
    charactersCount: characters.length,
    timestamp: new Date().toISOString()
  });

  logger.info('Project characters retrieved', {
    userId: authResult.user.id,
    projectId,
    charactersCount: characters.length
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

  const characterData: CreateCharacterData = {
    name: body.name,
    description: body.description,
    role: body.role,
    developmentArc: body.developmentArc,
    firstAppearance: body.firstAppearance,
  };

  // Validate required fields
  if (!characterData.name || characterData.name.trim().length === 0) {
    throw new ValidationError('Character name is required');
  }

  if (characterData.name.length > 100) {
    throw new ValidationError('Character name too long');
  }

  if (characterData.description && characterData.description.length > 2000) {
    throw new ValidationError('Character description too long');
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
    { userId: authResult.user.id, projectId, characterName: characterData.name }
  );

  // Log business event
  BusinessLogger.logUserAction('character_created', authResult.user.id, {
    projectId,
    characterId: character.id,
    characterName: character.name,
    role: character.role,
    timestamp: new Date().toISOString()
  });

  logger.info('Character created successfully', {
    userId: authResult.user.id,
    projectId,
    characterId: character.id,
    characterName: character.name,
    role: character.role
  });

  return NextResponse.json(
    {
      success: true,
      data: character,
    },
    { status: 201 }
  );
}

export const GET = withErrorHandler(handleGetCharacters);
export const POST = withErrorHandler(handleCreateCharacter);
