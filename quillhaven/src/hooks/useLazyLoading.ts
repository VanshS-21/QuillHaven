'use client';

import { useState, useCallback, useEffect } from 'react';

export interface UseLazyLoadingOptions<T> {
  initialData?: T[];
  fetchFunction: (page: number, limit: number) => Promise<{
    data: T[];
    hasMore: boolean;
    total?: number;
  }>;
  limit?: number;
  enabled?: boolean;
}

export interface UseLazyLoadingResult<T> {
  items: T[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  reset: () => void;
  total?: number;
}

export function useLazyLoading<T>({
  initialData = [],
  fetchFunction,
  limit = 10,
  enabled = true,
}: UseLazyLoadingOptions<T>): UseLazyLoadingResult<T> {
  const [items, setItems] = useState<T[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState<number | undefined>();

  const loadMore = useCallback(async () => {
    if (!enabled || loading || !hasMore) return;

    setLoading(true);
    setError(null);

    try {
      const result = await fetchFunction(page, limit);
      
      setItems(prev => [...prev, ...result.data]);
      setHasMore(result.hasMore);
      setPage(prev => prev + 1);
      
      if (result.total !== undefined) {
        setTotal(result.total);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [enabled, loading, hasMore, page, limit, fetchFunction]);

  const refresh = useCallback(async () => {
    if (!enabled) return;

    setLoading(true);
    setError(null);
    setPage(1);
    setItems([]);
    setHasMore(true);

    try {
      const result = await fetchFunction(1, limit);
      
      setItems(result.data);
      setHasMore(result.hasMore);
      setPage(2);
      
      if (result.total !== undefined) {
        setTotal(result.total);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [enabled, limit, fetchFunction]);

  const reset = useCallback(() => {
    setItems(initialData);
    setLoading(false);
    setError(null);
    setHasMore(true);
    setPage(1);
    setTotal(undefined);
  }, [initialData]);

  // Load initial data
  useEffect(() => {
    if (enabled && items.length === 0 && !loading) {
      loadMore();
    }
  }, [enabled, items.length, loading, loadMore]);

  return {
    items,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    reset,
    total,
  };
}

export default useLazyLoading;