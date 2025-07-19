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
