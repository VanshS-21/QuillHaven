import { NextRequest, NextResponse } from 'next/server';
import { withApiCache } from '@/lib/apiCache';
import { listProjects, createProject } from '@/services/projectService';
import { parsePaginationParams, parseSearchParams } from '@/utils/pagination';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger } from '@/lib/logger';

async function handleGetProjects(req: NextRequest): Promise<NextResponse> {
  const user = (req as AuthenticatedRequest).user;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  const url = new URL(req.url);
  const searchParams = url.searchParams;

  // Parse pagination parameters
  const paginationParams = parsePaginationParams(searchParams, {
    limit: 10,
    maxLimit: 50,
  });

  // Parse search parameters
  const searchParamsData = parseSearchParams(searchParams);

  // Get projects with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'list_projects',
    async () => {
      try {
        return await listProjects(user.id, {
          page: paginationParams.page,
          limit: paginationParams.limit,
          status: (() => {
            const statusParam = searchParams.get('status');
            if (!statusParam) return undefined;
            switch (statusParam.toLowerCase()) {
              case 'draft':
                return 'DRAFT';
              case 'in-progress':
                return 'IN_PROGRESS';
              case 'completed':
                return 'COMPLETED';
              default:
                return undefined;
            }
          })(),
          genre: searchParams.get('genre') || undefined,
          search: searchParamsData.query,
          sortBy:
            (searchParams.get('sortBy') as
              | 'title'
              | 'createdAt'
              | 'updatedAt') || 'updatedAt',
          sortOrder:
            (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
        });
      } catch (error) {
        // Convert database errors to appropriate app errors
        throw handleDatabaseError(error);
      }
    },
    {
      userId: user.id,
      page: paginationParams.page,
      limit: paginationParams.limit,
    }
  );

  logger.info('Projects listed successfully', {
    userId: user.id,
    projectCount: result.projects.length,
    totalProjects: result.pagination.total,
    page: result.pagination.page,
  });

  return NextResponse.json(result, {
    headers: {
      'X-Total-Count': result.pagination.total.toString(),
      'X-Page': result.pagination.page.toString(),
      'X-Per-Page': result.pagination.limit.toString(),
    },
  });
}

async function handleCreateProject(req: NextRequest): Promise<NextResponse> {
  const user = (req as AuthenticatedRequest).user;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  let body;
  try {
    body = await req.json();
  } catch (error) {
    throw new ValidationError('Invalid JSON in request body');
  }

  const { title, description, genre, targetLength } = body;

  // Validate required fields
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    throw new ValidationError(
      'Title is required and must be a non-empty string'
    );
  }

  if (!genre || typeof genre !== 'string' || genre.trim().length === 0) {
    throw new ValidationError(
      'Genre is required and must be a non-empty string'
    );
  }

  if (targetLength && (typeof targetLength !== 'number' || targetLength <= 0)) {
    throw new ValidationError('Target length must be a positive number');
  }

  // Create project with performance monitoring
  const project = await PerformanceLogger.measureAsync(
    'create_project',
    async () => {
      try {
        return await createProject(user.id, {
          title: title.trim(),
          description: description?.trim(),
          genre: genre.trim(),
          targetLength: targetLength || 50000,
        });
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    {
      userId: user.id,
      title: title.trim(),
      genre: genre.trim(),
    }
  );

  logger.info('Project created successfully', {
    userId: user.id,
    projectId: project.id,
    title: project.title,
    genre: project.genre,
  });

  return NextResponse.json(project, { status: 201 });
}

// Apply error handling, rate limiting, and caching middleware
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(
    withAuth(
      withApiCache(handleGetProjects, {
        ttl: 180, // 3 minutes
        varyByUser: true,
        varyByQuery: true,
        shouldCache: (req, res) => {
          // Only cache successful responses
          return res.status === 200;
        },
      })
    )
  )
);

export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 20, // 20 project creations per minute
  })(withAuth(handleCreateProject))
);
