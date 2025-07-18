import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { createProject, listProjects } from '@/services/projectService';
import { z } from 'zod';

// Validation schemas
const createProjectSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(1000, 'Description too long').optional(),
  genre: z.string().min(1, 'Genre is required').max(100, 'Genre too long'),
  targetLength: z
    .number()
    .min(1000, 'Target length must be at least 1,000 words')
    .max(1000000, 'Target length too large'),
});

const listProjectsSchema = z.object({
  page: z.string().transform(Number).pipe(z.number().min(1)).optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(100))
    .optional(),
  status: z.enum(['DRAFT', 'IN_PROGRESS', 'COMPLETED']).optional(),
  genre: z.string().optional(),
  search: z.string().optional(),
  sortBy: z
    .enum(['title', 'createdAt', 'updatedAt', 'currentWordCount'])
    .optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
});

/**
 * GET /api/projects - List user's projects with pagination and filtering
 */
async function handleGet(req: NextRequest) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const { searchParams } = new URL(req.url);

    // Check if user is authenticated
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Parse and validate query parameters
    const queryParams = Object.fromEntries(searchParams.entries());
    const validatedParams = listProjectsSchema.parse(queryParams);

    const result = await listProjects(user.id, validatedParams);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error listing projects:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list projects',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects - Create a new project
 */
async function handlePost(req: NextRequest) {
  try {
    const user = (req as AuthenticatedRequest).user;
    const body = await req.json();

    // Check if user is authenticated
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Validate request body
    const validatedData = createProjectSchema.parse(body);

    const project = await createProject(user.id, validatedData);

    return NextResponse.json(
      {
        success: true,
        data: project,
        message: 'Project created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating project:', error);

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
        error: 'Failed to create project',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const GET = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 60, // 60 requests per minute
})(withAuth(handleGet));

export const POST = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 10, // 10 project creations per minute
})(withAuth(handlePost));
