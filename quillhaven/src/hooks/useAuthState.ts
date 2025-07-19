'use client';

import { useState, useEffect, useCallback } from 'react';
import { authService } from '@/services/authService';
import { useNotifications } from '@/components/ui/NotificationSystem';
import type { AuthUser } from '@/types/auth';

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;
}

interface UseAuthStateOptions {
  autoRefresh?: boolean;
  refreshInterval?: number;
  onAuthChange?: (user: AuthUser | null) => void;
  onError?: (error: string) => void;
}

/**
 * Custom hook for managing authentication state with automatic refresh
 * and error handling. Can be used independently of the main AuthContext.
 */
export function useAuthState(options: UseAuthStateOptions = {}) {
  const {
    autoRefresh = true,
    refreshInterval = 5 * 60 * 1000, // 5 minutes
    onAuthChange,
    onError,
  } = options;

  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
    error: null,
  });

  const { notifyError, notifyWarning } = useNotifications();

  /**
   * Update authentication state
   */
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => {
      const newState = { ...prev, ...updates };
      
      // Trigger callback if user changed
      if (updates.user !== undefined && updates.user !== prev.user) {
        onAuthChange?.(updates.user);
      }
      
      // Trigger error callback if error changed
      if (updates.error && updates.error !== prev.error) {
        onError?.(updates.error);
      }
      
      return newState;
    });
  }, [onAuthChange, onError]);

  /**
   * Check current authentication status
   */
  const checkAuth = useCallback(async (showErrors = true) => {
    try {
      updateState({ isLoading: true, error: null });

      if (!authService.isAuthenticated()) {
        updateState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return null;
      }

      const user = await authService.getCurrentUser();
      
      if (user) {
        updateState({
          user,
          isLoading: false,
          isAuthenticated: true,
          error: null,
        });
        return user;
      } else {
        updateState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
        return null;
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Authentication check failed';
      
      updateState({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        error: errorMessage,
      });

      if (showErrors) {
        if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
          notifyWarning(
            'Connection Issue',
            'Unable to verify authentication status. You may be offline.'
          );
        } else {
          notifyError('Authentication Error', errorMessage);
        }
      }

      return null;
    }
  }, [updateState, notifyError, notifyWarning]);

  /**
   * Refresh authentication state
   */
  const refresh = useCallback(async () => {
    return await checkAuth(false); // Don't show errors for automatic refresh
  }, [checkAuth]);

  /**
   * Force logout
   */
  const logout = useCallback(async () => {
    try {
      await authService.logout();
      updateState({
        user: null,
        isAuthenticated: false,
        error: null,
      });
    } catch (error) {
      // Even if logout fails, clear local state
      updateState({
        user: null,
        isAuthenticated: false,
        error: null,
      });
    }
  }, [updateState]);

  /**
   * Get time until token expires
   */
  const getTimeUntilExpiry = useCallback(() => {
    return authService.getTimeUntilExpiry();
  }, []);

  /**
   * Check if token needs refresh soon
   */
  const needsRefresh = useCallback(() => {
    const timeUntilExpiry = getTimeUntilExpiry();
    return timeUntilExpiry > 0 && timeUntilExpiry <= 5 * 60 * 1000; // 5 minutes
  }, [getTimeUntilExpiry]);

  // Initial authentication check
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Set up automatic refresh
  useEffect(() => {
    if (!autoRefresh || !state.isAuthenticated) {
      return;
    }

    const interval = setInterval(async () => {
      if (needsRefresh()) {
        await refresh();
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, state.isAuthenticated, refreshInterval, refresh, needsRefresh]);

  // Handle visibility change to refresh auth state
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.isAuthenticated) {
        refresh();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.isAuthenticated, refresh]);

  // Handle storage events for multi-tab synchronization
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_token' || event.key === 'auth_token_data') {
        if (!event.newValue) {
          // Token was removed in another tab
          updateState({
            user: null,
            isAuthenticated: false,
          });
        } else {
          // Token was updated in another tab, refresh
          refresh();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updateState, refresh]);

  return {
    ...state,
    checkAuth,
    refresh,
    logout,
    getTimeUntilExpiry,
    needsRefresh,
  };
}

/**
 * Hook for components that need to ensure authentication
 */
export function useRequireAuth() {
  const authState = useAuthState();
  const { notifyError } = useNotifications();

  useEffect(() => {
    if (!authState.isLoading && !authState.isAuthenticated) {
      notifyError(
        'Authentication Required',
        'Please log in to access this feature.',
        {
          persistent: true,
          action: {
            label: 'Go to Login',
            onClick: () => {
              window.location.href = '/auth';
            },
          },
        }
      );
    }
  }, [authState.isLoading, authState.isAuthenticated, notifyError]);

  return authState;
}

/**
 * Hook for getting authentication headers for API requests
 */
export function useAuthHeaders() {
  const getHeaders = useCallback(async () => {
    const token = await authService.getToken();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  const getHeadersSync = useCallback(() => {
    const token = authService.getTokenSync();
    
    if (!token) {
      throw new Error('No authentication token available');
    }

    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }, []);

  return {
    getHeaders,
    getHeadersSync,
  };
}