export interface PaginationResult {
  page: number;
  limit: number;
  offset: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  total: number;
}

export interface PaginationQuery {
  skip: number;
  take: number;
}

export function calculatePagination(
  page: number,
  limit: number,
  total: number
): PaginationResult {
  // Sanitize inputs
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));
  const safeTotal = Math.max(0, Math.floor(Number(total) || 0));

  const totalPages = safeTotal > 0 ? Math.ceil(safeTotal / safeLimit) : 0;
  const offset = (safePage - 1) * safeLimit;
  const hasNext = safePage < totalPages;
  const hasPrev = safePage > 1;

  return {
    page: safePage,
    limit: safeLimit,
    offset,
    totalPages,
    hasNext,
    hasPrev,
    total: safeTotal,
  };
}

export function createPaginationQuery(
  page: number,
  limit: number
): PaginationQuery {
  const safePage = Math.max(1, Math.floor(Number(page) || 1));
  const safeLimit = Math.min(100, Math.max(1, Math.floor(Number(limit) || 10)));

  return {
    skip: (safePage - 1) * safeLimit,
    take: safeLimit,
  };
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationOptions {
  limit?: number;
  maxLimit?: number;
}

export function parsePaginationParams(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): PaginationParams {
  const defaultLimit = options.limit || 10;
  const maxLimit = options.maxLimit || 100;

  const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
  const limit = Math.min(
    maxLimit,
    Math.max(1, parseInt(searchParams.get('limit') || defaultLimit.toString(), 10))
  );

  return { page, limit };
}

export interface SearchParams {
  query?: string;
  filters?: Record<string, string>;
}

export function parseSearchParams(searchParams: URLSearchParams): SearchParams {
  const query = searchParams.get('search') || searchParams.get('q') || undefined;
  const filters: Record<string, string> = {};

  // Extract common filter parameters
  const filterKeys = ['status', 'genre', 'sortBy', 'sortOrder'];
  filterKeys.forEach(key => {
    const value = searchParams.get(key);
    if (value) {
      filters[key] = value;
    }
  });

  return { query, filters };
}
