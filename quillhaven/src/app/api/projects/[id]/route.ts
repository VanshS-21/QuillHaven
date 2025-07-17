import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { 
  getProject, 
  updateProject, 
  deleteProject,
  validateProjectOwnership 
} from '@/services/projectService';
import { z } from 'zod';

// Validation schema for project updates
const updateProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long').optional(),
  description: z.string().max(1000, 'Description too long').optional(),
  genre: z.string().min(1, 'Genre is required').max(100, 'Genre too long').optional(),
  targetLength: z.number().min(1000, 'Target length must be at least 1,000 words').max(1000000, 'Target length too large').optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
});

/**
 * GET /api/projects/[id] - Get a specific project with full details
 */
async function handleGet(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (req as any).user;
    const projectId = params.id;

    // Validate project ID format (basic check)
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    const project = await getProject(projectId, user.id);

    if (!project) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: project,
    });
  } catch (error) {
    console.error('Error getting project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get project',
      },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/projects/[id] - Update a specific project
 */
async function handlePut(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (req as any).user;
    const projectId = params.id;
    const body = await req.json();

    // Validate project ID format
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validatedData = updateProjectSchema.parse(body);

    // Check if there's actually data to update
    if (Object.keys(validatedData).length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid fields to update',
        },
        { status: 400 }
      );
    }

    const updatedProject = await updateProject(projectId, user.id, validatedData);

    if (!updatedProject) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: updatedProject,
      message: 'Project updated successfully',
    });
  } catch (error) {
    console.error('Error updating project:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project data',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update project',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/projects/[id] - Delete a specific project
 */
async function handleDelete(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = (req as any).user;
    const projectId = params.id;

    // Validate project ID format
    if (!projectId || typeof projectId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid project ID',
        },
        { status: 400 }
      );
    }

    const deleted = await deleteProject(projectId, user.id);

    if (!deleted) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project not found or access denied',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting project:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete project',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const GET = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // 100 requests per minute
})(withAuth(handleGet));

export const PUT = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 30, // 30 updates per minute
})(withAuth(handlePut));

export const DELETE = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 deletions per minute
})(withAuth(handleDelete));