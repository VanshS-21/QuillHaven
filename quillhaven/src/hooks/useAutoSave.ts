import { useCallback, useEffect, useRef } from 'react';
import { useDebounce } from './useDebounce';

interface UseAutoSaveOptions {
  delay?: number;
  enabled?: boolean;
}

/**
 * Custom hook for auto-save functionality with debouncing
 * @param data - The data to auto-save
 * @param onSave - The save function to call
 * @param options - Configuration options
 */
export function useAutoSave<T>(
  data: T,
  onSave: (data: T) => Promise<void> | void,
  options: UseAutoSaveOptions = {}
) {
  const { delay = 30000, enabled = true } = options; // 30 seconds default
  const debouncedData = useDebounce(data, delay);
  const initialDataRef = useRef<T>(data);
  const isFirstRender = useRef(true);

  // Update initial data when data changes externally (e.g., when loading new chapter)
  useEffect(() => {
    if (isFirstRender.current) {
      initialDataRef.current = data;
      isFirstRender.current = false;
    }
  }, [data]);

  // Auto-save when debounced data changes
  useEffect(() => {
    if (!enabled || isFirstRender.current) {
      return;
    }

    // Only save if data has actually changed from initial
    if (
      JSON.stringify(debouncedData) !== JSON.stringify(initialDataRef.current)
    ) {
      onSave(debouncedData);
      initialDataRef.current = debouncedData;
    }
  }, [debouncedData, onSave, enabled]);

  // Manual save function
  const saveNow = useCallback(async () => {
    if (enabled) {
      await onSave(data);
      initialDataRef.current = data;
    }
  }, [data, onSave, enabled]);

  // Reset function to update the baseline
  const resetAutoSave = useCallback((newData: T) => {
    initialDataRef.current = newData;
  }, []);

  return {
    saveNow,
    resetAutoSave,
  };
}
