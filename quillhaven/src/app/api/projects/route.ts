import { NextRequest, NextResponse } from 'next/server';
import { withApiCache } from '@/lib/apiCache';
import { listProjects } from '@/services/projectService';
import { parsePaginationParams, parseSearchParams } from '@/utils/pagination';
import { verifyAuth } from '@/lib/auth';

async function handleGetProjects(req: NextRequest): Promise<NextResponse> {
  try {
    // Verify authentication
    const authResult = await verifyAuth(req);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
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

    // Get projects with caching
    const result = await listProjects(authResult.user.id, {
      page: paginationParams.page,
      limit: paginationParams.limit,
      status: searchParams.get('status') as any,
      genre: searchParams.get('genre') || undefined,
      search: searchParamsData.query,
      sortBy: (searchParams.get('sortBy') as any) || 'updatedAt',
      sortOrder: (searchParams.get('sortOrder') as any) || 'desc',
    });

    return NextResponse.json(result, {
      headers: {
        'X-Total-Count': result.pagination.total.toString(),
        'X-Page': result.pagination.page.toString(),
        'X-Per-Page': result.pagination.limit.toString(),
      },
    });
  } catch (error) {
    console.error('Error in GET /api/projects:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply caching middleware
export const GET = withApiCache(handleGetProjects, {
  ttl: 180, // 3 minutes
  varyByUser: true,
  varyByQuery: true,
  shouldCache: (req, res) => {
    // Only cache successful responses
    return res.status === 200;
  },
});