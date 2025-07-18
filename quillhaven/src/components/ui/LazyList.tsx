'use client';

import React, { useEffect, useRef, useCallback, useState } from 'react';
import { Loader2 } from 'lucide-react';

export interface LazyListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  loading?: boolean;
  threshold?: number;
  className?: string;
  loadingComponent?: React.ReactNode;
  emptyComponent?: React.ReactNode;
  errorComponent?: React.ReactNode;
  error?: string | null;
  onRetry?: () => void;
}

export function LazyList<T>({
  items,
  renderItem,
  loadMore,
  hasMore,
  loading = false,
  threshold = 200,
  className = '',
  loadingComponent,
  emptyComponent,
  errorComponent,
  error,
  onRetry,
}: LazyListProps<T>) {
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadingElementRef = useRef<HTMLDivElement | null>(null);

  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || loading) return;

    setIsLoadingMore(true);
    try {
      await loadMore();
    } catch (error) {
      console.error('Error loading more items:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, loading, loadMore]);

  useEffect(() => {
    const currentElement = loadingElementRef.current;

    if (!currentElement || !hasMore) return;

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          handleLoadMore();
        }
      },
      {
        rootMargin: `${threshold}px`,
      }
    );

    observerRef.current.observe(currentElement);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [hasMore, threshold, handleLoadMore]);

  const defaultLoadingComponent = (
    <div className="flex items-center justify-center p-4">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span className="ml-2">Loading...</span>
    </div>
  );

  const defaultEmptyComponent = (
    <div className="flex items-center justify-center p-8 text-gray-500">
      <p>No items found</p>
    </div>
  );

  const defaultErrorComponent = (
    <div className="flex flex-col items-center justify-center p-8 text-red-500">
      <p className="mb-2">{error || 'An error occurred'}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  );

  if (error) {
    return errorComponent || defaultErrorComponent;
  }

  if (loading && items.length === 0) {
    return loadingComponent || defaultLoadingComponent;
  }

  if (items.length === 0) {
    return emptyComponent || defaultEmptyComponent;
  }

  return (
    <div className={className}>
      {items.map((item, index) => (
        <div key={index}>{renderItem(item, index)}</div>
      ))}

      {hasMore && (
        <div ref={loadingElementRef} className="h-4">
          {isLoadingMore && (loadingComponent || defaultLoadingComponent)}
        </div>
      )}
    </div>
  );
}

export default LazyList;
