import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import {
  getProject,
  updateProject,
  deleteProject,
} from '@/services/projectService';
import { z } from 'zod';
import { withErrorHandler, ValidationError, NotFoundError, AuthenticationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Validation schema for project updates
const updateProjectSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title too long')
    .optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  genre: z
    .string()
    .min(1, 'Genre is required')
    .max(100, 'Genre too long')
    .optional(),
  targetLength: z
    .number()
    .min(1000, 'Target length must be at least 1,000 words')
    .max(1000000, 'Target length too large')
    .optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
});

/**
 * GET /api/projects/[id] - Get a specific project with full details
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format (basic check)
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  const project = await PerformanceLogger.measureAsync(
    'get_project',
    async () => {
      try {
        return await getProject(projectId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  if (!project) {
    throw new NotFoundError('Project not found or access denied');
  }

  logger.info('Project retrieved successfully', {
    userId: user.id,
    projectId,
    projectTitle: project.title,
    chapterCount: project.chapters?.length || 0,
  });

  return NextResponse.json({
    success: true,
    data: project,
  });
}

/**
 * PUT /api/projects/[id] - Update a specific project
 */
async function handlePut(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;
  const body = await req.json();

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Validate request body
  let validatedData;
  try {
    validatedData = updateProjectSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid project data', error.issues);
    }
    throw error;
  }

  // Check if there's actually data to update
  if (Object.keys(validatedData).length === 0) {
    throw new ValidationError('No valid fields to update');
  }

  const updatedProject = await PerformanceLogger.measureAsync(
    'update_project',
    async () => {
      try {
        return await updateProject(projectId, user.id, validatedData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { 
      userId: user.id, 
      projectId,
      fieldsUpdated: Object.keys(validatedData),
    }
  );

  if (!updatedProject) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Log business event
  BusinessLogger.logUserAction('project_updated', user.id, {
    projectId,
    fieldsUpdated: Object.keys(validatedData),
    newStatus: validatedData.status,
  });

  logger.info('Project updated successfully', {
    userId: user.id,
    projectId,
    fieldsUpdated: Object.keys(validatedData),
    projectTitle: updatedProject.title,
  });

  return NextResponse.json({
    success: true,
    data: updatedProject,
    message: 'Project updated successfully',
  });
}

/**
 * DELETE /api/projects/[id] - Delete a specific project
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  const deleted = await PerformanceLogger.measureAsync(
    'delete_project',
    async () => {
      try {
        return await deleteProject(projectId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  if (!deleted) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Log business event
  BusinessLogger.logUserAction('project_deleted', user.id, {
    projectId,
  });

  logger.info('Project deleted successfully', {
    userId: user.id,
    projectId,
  });

  return NextResponse.json({
    success: true,
    message: 'Project deleted successfully',
  });
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGet))
);

export const PUT = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 updates per minute
  })(withAuth(handlePut))
);

export const DELETE = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 deletions per minute
  })(withAuth(handleDelete))
);
