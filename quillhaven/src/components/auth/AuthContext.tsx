'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';
import { useNotifications } from '@/components/ui/NotificationSystem';
import type { AuthContextType, AuthUser, RegisterFormData } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isLoading: true,
    isInitialized: false,
    error: null,
  });

  const router = useRouter();
  const { notifyError, notifySuccess, notifyWarning } = useNotifications();
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const initializationRef = useRef<Promise<void> | null>(null);

  /**
   * Update auth state
   */
  const updateState = useCallback((updates: Partial<AuthState>) => {
    setState(prev => ({ ...prev, ...updates }));
  }, []);

  /**
   * Set up automatic token refresh
   */
  const setupTokenRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    if (!authService.isAuthenticated()) {
      return;
    }

    const timeUntilExpiry = authService.getTimeUntilExpiry();
    const refreshTime = Math.max(0, timeUntilExpiry - 5 * 60 * 1000); // Refresh 5 minutes before expiry

    refreshTimeoutRef.current = setTimeout(async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          updateState({ user: currentUser });
          setupTokenRefresh(); // Schedule next refresh
        } else {
          await handleLogout(false); // Don't show notification for automatic logout
        }
      } catch (error) {
        console.error('Automatic token refresh failed:', error);
        await handleLogout(false);
      }
    }, refreshTime);
  }, [updateState]);

  /**
   * Initialize authentication state
   */
  const initializeAuth = useCallback(async () => {
    if (initializationRef.current) {
      return initializationRef.current;
    }

    initializationRef.current = (async () => {
      try {
        updateState({ isLoading: true, error: null });

        // Check if we have a valid token
        if (!authService.isAuthenticated()) {
          updateState({ 
            user: null, 
            isLoading: false, 
            isInitialized: true 
          });
          return;
        }

        // Get current user
        const currentUser = await authService.getCurrentUser();
        
        if (currentUser) {
          updateState({ 
            user: currentUser, 
            isLoading: false, 
            isInitialized: true 
          });
          setupTokenRefresh();
        } else {
          // Token was invalid, clear state
          updateState({ 
            user: null, 
            isLoading: false, 
            isInitialized: true 
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        
        // Clear any invalid tokens
        await authService.logout();
        
        updateState({ 
          user: null, 
          isLoading: false, 
          isInitialized: true,
          error: error instanceof Error ? error.message : 'Authentication failed'
        });
      }
    })();

    return initializationRef.current;
  }, [updateState, setupTokenRefresh]);

  /**
   * Handle login with comprehensive error handling
   */
  const handleLogin = useCallback(async (email: string, password: string) => {
    updateState({ isLoading: true, error: null });
    
    try {
      const response = await authService.login({ email, password });
      
      updateState({ 
        user: response.user, 
        isLoading: false,
        error: null
      });
      
      setupTokenRefresh();
      notifySuccess('Login successful', 'Welcome back!');

      // Redirect to dashboard
      router.push('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Login failed';
      
      updateState({ 
        isLoading: false,
        error: errorMessage
      });
      
      notifyError('Login failed', errorMessage);
      throw error; // Re-throw for component handling
    }
  }, [updateState, setupTokenRefresh, notifySuccess, notifyError, router]);

  /**
   * Handle registration with comprehensive error handling
   */
  const handleRegister = useCallback(async (data: RegisterFormData) => {
    updateState({ isLoading: true, error: null });
    
    try {
      const response = await authService.register(data);
      
      updateState({ isLoading: false, error: null });
      
      if (response.requiresVerification) {
        notifySuccess(
          'Registration successful', 
          'Please check your email to verify your account'
        );
      } else if (response.user) {
        updateState({ user: response.user });
        setupTokenRefresh();
        notifySuccess('Registration successful', 'Welcome to QuillHaven!');
        router.push('/dashboard');
      }
      
      return response;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      
      updateState({ 
        isLoading: false,
        error: errorMessage
      });
      
      notifyError('Registration failed', errorMessage);
      throw error; // Re-throw for component handling
    }
  }, [updateState, setupTokenRefresh, notifySuccess, notifyError, router]);

  /**
   * Handle logout with proper cleanup
   */
  const handleLogout = useCallback(async (showNotification = true) => {
    // Clear refresh timeout
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
    }

    try {
      await authService.logout();
      
      updateState({ 
        user: null, 
        isLoading: false,
        error: null
      });
      
      if (showNotification) {
        notifySuccess('Logged out', 'You have been successfully logged out');
      }
      
      // Redirect to auth page
      router.push('/auth');
    } catch (error) {
      console.error('Logout error:', error);
      
      // Even if logout API fails, clear local state
      updateState({ 
        user: null, 
        isLoading: false,
        error: null
      });
      
      if (showNotification) {
        notifyWarning('Logged out', 'Session ended');
      }
      
      router.push('/auth');
    }
  }, [updateState, notifySuccess, notifyWarning, router]);

  /**
   * Handle password reset with error handling
   */
  const handleResetPassword = useCallback(async (email: string) => {
    try {
      await authService.resetPassword(email);
      notifySuccess(
        'Password reset sent', 
        'Check your email for reset instructions'
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Password reset failed';
      notifyError('Password reset failed', errorMessage);
      throw error;
    }
  }, [notifySuccess, notifyError]);

  /**
   * Initialize auth on mount
   */
  useEffect(() => {
    initializeAuth();
    
    // Cleanup on unmount
    return () => {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
      }
    };
  }, [initializeAuth]);

  /**
   * Handle browser visibility changes to refresh auth state
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && state.user) {
        // Refresh user data when tab becomes visible
        authService.getCurrentUser().then(currentUser => {
          if (currentUser) {
            updateState({ user: currentUser });
          } else {
            handleLogout(false);
          }
        }).catch(() => {
          handleLogout(false);
        });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [state.user, updateState, handleLogout]);

  /**
   * Handle storage events (for multi-tab synchronization)
   */
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'auth_token' || event.key === 'auth_token_data') {
        if (!event.newValue) {
          // Token was removed in another tab
          updateState({ user: null });
        } else {
          // Token was updated in another tab, refresh user data
          initializeAuth();
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [updateState, initializeAuth]);

  const value: AuthContextType = {
    user: state.user,
    isLoading: state.isLoading,
    isInitialized: state.isInitialized,
    error: state.error,
    login: handleLogin,
    register: handleRegister,
    logout: () => handleLogout(true),
    resetPassword: handleResetPassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
