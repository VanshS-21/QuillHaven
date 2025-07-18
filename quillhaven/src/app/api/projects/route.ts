import { NextRequest, NextResponse } from 'next/server';
import { withApiCache } from '@/lib/apiCache';
import { listProjects } from '@/services/projectService';
import { parsePaginationParams, parseSearchParams } from '@/utils/pagination';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, AuthenticationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger } from '@/lib/logger';

async function handleGetProjects(req: NextRequest): Promise<NextResponse> {
  // Verify authentication
  const authResult = await verifyAuth(req);
  if (!authResult.success || !authResult.user) {
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
        return await listProjects(authResult.user!.id, {
          page: paginationParams.page,
          limit: paginationParams.limit,
          status: searchParams.get('status') as any,
          genre: searchParams.get('genre') || undefined,
          search: searchParamsData.query,
          sortBy: (searchParams.get('sortBy') as any) || 'updatedAt',
          sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
        });
      } catch (error) {
        // Convert database errors to appropriate app errors
        throw handleDatabaseError(error);
      }
    },
    {
      userId: authResult.user.id,
      page: paginationParams.page,
      limit: paginationParams.limit,
    }
  );

  logger.info('Projects listed successfully', {
    userId: authResult.user.id,
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

// Apply error handling and caching middleware
export const GET = withErrorHandler(
  withApiCache(handleGetProjects, {
    ttl: 180, // 3 minutes
    varyByUser: true,
    varyByQuery: true,
    shouldCache: (req, res) => {
      // Only cache successful responses
      return res.status === 200;
    },
  })
);