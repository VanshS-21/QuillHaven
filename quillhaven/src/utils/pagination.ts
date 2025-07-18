export interface PaginationParams {
  page?: number;
  limit?: number;
  cursor?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor?: string;
    previousCursor?: string;
  };
}

/**
 * Parse pagination parameters from URL search params
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: {
    page?: number;
    limit?: number;
    maxLimit?: number;
  } = {}
): PaginationParams {
  const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
  const limit = Math.min(
    defaults.maxLimit || 100,
    Math.max(
      1,
      parseInt(searchParams.get('limit') || String(defaults.limit || 10))
    )
  );
  const cursor = searchParams.get('cursor') || undefined;
  const sortBy = searchParams.get('sortBy') || undefined;
  const sortOrder = (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc';

  return {
    page,
    limit,
    cursor,
    sortBy,
    sortOrder,
  };
}

/**
 * Calculate pagination metadata
 */
export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationResult<never>['pagination'] {
  const totalPages = Math.ceil(total / limit);
  const hasNextPage = page < totalPages;
  const hasPreviousPage = page > 1;

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage,
    hasPreviousPage,
  };
}

/**
 * Generate Prisma skip and take values
 */
export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  };
}

/**
 * Create cursor-based pagination query
 */
export function createCursorQuery<T extends Record<string, unknown>>(
  cursor: string | undefined,
  sortBy: keyof T,
  sortOrder: 'asc' | 'desc' = 'desc'
) {
  if (!cursor) return {};

  try {
    const cursorValue = JSON.parse(Buffer.from(cursor, 'base64').toString());

    return {
      cursor: {
        [sortBy]: cursorValue,
      },
      skip: 1, // Skip the cursor item itself
      orderBy: {
        [sortBy]: sortOrder,
      },
    };
  } catch {
    return {};
  }
}

/**
 * Generate cursor from item
 */
export function generateCursor<T extends Record<string, unknown>>(
  item: T,
  sortBy: keyof T
): string {
  const cursorValue = item[sortBy];
  return Buffer.from(JSON.stringify(cursorValue)).toString('base64');
}

/**
 * Create pagination response
 */
export function createPaginationResponse<T>(
  data: T[],
  page: number,
  limit: number,
  total: number
): PaginationResult<T> {
  return {
    data,
    pagination: calculatePagination(page, limit, total),
  };
}

/**
 * Create cursor pagination response
 */
export function createCursorPaginationResponse<
  T extends Record<string, unknown>,
>(
  data: T[],
  limit: number,
  sortBy: keyof T,
  hasMore: boolean = false
): CursorPaginationResult<T> {
  const hasNextPage = data.length === limit && hasMore;
  const nextCursor =
    hasNextPage && data.length > 0
      ? generateCursor(data[data.length - 1], sortBy)
      : undefined;
  const previousCursor =
    data.length > 0 ? generateCursor(data[0], sortBy) : undefined;

  return {
    data,
    pagination: {
      limit,
      hasNextPage,
      hasPreviousPage: false, // Would need additional logic to determine
      nextCursor,
      previousCursor,
    },
  };
}

/**
 * Lazy loading hook parameters
 */
export interface LazyLoadingOptions {
  initialLimit?: number;
  loadMoreLimit?: number;
  threshold?: number; // Pixels from bottom to trigger load
  enabled?: boolean;
}

/**
 * Search and filter utilities
 */
export interface SearchParams {
  query?: string;
  filters?: Record<string, unknown>;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Parse search parameters
 */
export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const query = searchParams.get('q') || undefined;
  const filters: Record<string, unknown> = {};

  // Parse filter parameters (filter_key=value)
  for (const [key, value] of searchParams.entries()) {
    if (key.startsWith('filter_')) {
      const filterKey = key.replace('filter_', '');
      filters[filterKey] = value;
    }
  }

  // Parse date range
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');
  const dateRange =
    dateFrom || dateTo
      ? {
          from: dateFrom ? new Date(dateFrom) : undefined,
          to: dateTo ? new Date(dateTo) : undefined,
        }
      : undefined;

  return {
    query,
    filters: Object.keys(filters).length > 0 ? filters : undefined,
    dateRange,
  };
}

/**
 * Build Prisma where clause from search params
 */
export function buildSearchWhere(
  searchParams: SearchParams,
  searchableFields: string[] = []
): Record<string, unknown> {
  const where: Record<string, unknown> = {};

  // Add text search
  if (searchParams.query && searchableFields.length > 0) {
    where.OR = searchableFields.map((field) => ({
      [field]: {
        contains: searchParams.query,
        mode: 'insensitive',
      },
    }));
  }

  // Add filters
  if (searchParams.filters) {
    Object.entries(searchParams.filters).forEach(([key, value]) => {
      where[key] = value;
    });
  }

  // Add date range
  if (searchParams.dateRange) {
    const dateFilter: Record<string, unknown> = {};
    if (searchParams.dateRange.from) {
      dateFilter.gte = searchParams.dateRange.from;
    }
    if (searchParams.dateRange.to) {
      dateFilter.lte = searchParams.dateRange.to;
    }
    if (Object.keys(dateFilter).length > 0) {
      where.createdAt = dateFilter;
    }
  }

  return where;
}
