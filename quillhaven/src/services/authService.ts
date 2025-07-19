import type {
  LoginFormData,
  RegisterFormData,
  AuthResponse,
  AuthUser,
} from '@/types/auth';
import { tokenStorage } from '@/utils/secureStorage';

const API_BASE = '/api/auth';
const TOKEN_REFRESH_THRESHOLD = 5 * 60 * 1000; // 5 minutes before expiration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 1000; // 1 second

interface TokenData {
  token: string;
  expiresAt: number;
  refreshToken?: string;
}

class AuthService {
  private refreshPromise: Promise<boolean> | null = null;
  private isRefreshing = false;

  /**
   * Enhanced fetch with retry logic and timeout handling
   */
  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    retries = MAX_RETRY_ATTEMPTS
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }

      if (retries > 0 && this.isNetworkError(error)) {
        await this.delay(RETRY_DELAY);
        return this.fetchWithRetry(url, options, retries - 1);
      }

      throw error;
    }
  }

  /**
   * Check if error is a network error that should be retried
   */
  private isNetworkError(error: unknown): boolean {
    return (
      error instanceof TypeError ||
      (error instanceof Error && 
       (error.message.includes('fetch') || 
        error.message.includes('network') ||
        error.message.includes('Failed to fetch')))
    );
  }

  /**
   * Delay utility for retry logic
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Store token with expiration tracking using secure storage
   */
  private storeToken(token: string): void {
    try {
      // Decode JWT to get expiration time
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds

      const tokenData: TokenData = {
        token,
        expiresAt,
      };

      // Use secure storage for token data
      const { tokenStorage } = require('@/utils/secureStorage');
      tokenStorage.storeToken(token, expiresAt);
      
      // Also store token data for quick access
      localStorage.setItem('auth_token_data', JSON.stringify(tokenData));
      localStorage.setItem('auth_token', token); // Keep for backward compatibility
    } catch (error) {
      console.error('Error storing token:', error);
      // Fallback to simple storage
      localStorage.setItem('auth_token', token);
    }
  }

  /**
   * Get stored token data with secure storage fallback
   */
  private getTokenData(): TokenData | null {
    try {
      // Try secure storage first
      const { tokenStorage } = require('@/utils/secureStorage');
      const secureToken = tokenStorage.getToken();
      
      if (secureToken) {
        try {
          const payload = JSON.parse(atob(secureToken.split('.')[1]));
          const expiresAt = payload.exp * 1000;
          return { token: secureToken, expiresAt };
        } catch {
          // Invalid token format, remove it
          tokenStorage.removeToken();
        }
      }

      // Fallback to regular storage
      const tokenDataStr = localStorage.getItem('auth_token_data');
      if (tokenDataStr) {
        return JSON.parse(tokenDataStr);
      }

      // Fallback to old token storage
      const token = localStorage.getItem('auth_token');
      if (token) {
        return { token, expiresAt: Date.now() + 24 * 60 * 60 * 1000 }; // Assume 24h expiry
      }

      return null;
    } catch (error) {
      console.error('Error getting token data:', error);
      return null;
    }
  }

  /**
   * Check if token needs refresh
   */
  private shouldRefreshToken(): boolean {
    const tokenData = this.getTokenData();
    if (!tokenData) return false;

    const timeUntilExpiry = tokenData.expiresAt - Date.now();
    return timeUntilExpiry <= TOKEN_REFRESH_THRESHOLD;
  }

  /**
   * Refresh token if needed
   */
  private async refreshTokenIfNeeded(): Promise<boolean> {
    if (this.isRefreshing) {
      // Wait for existing refresh to complete
      return this.refreshPromise || Promise.resolve(false);
    }

    if (!this.shouldRefreshToken()) {
      return true; // Token is still valid
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const result = await this.refreshPromise;
      return result;
    } finally {
      this.isRefreshing = false;
      this.refreshPromise = null;
    }
  }

  /**
   * Perform actual token refresh
   */
  private async performTokenRefresh(): Promise<boolean> {
    try {
      const tokenData = this.getTokenData();
      if (!tokenData) return false;

      const response = await this.fetchWithRetry(`${API_BASE}/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tokenData.token}`,
        },
      });

      if (!response.ok) {
        this.logout();
        return false;
      }

      const result = await response.json();
      if (result.token) {
        this.storeToken(result.token);
        if (result.user) {
          localStorage.setItem('auth_user', JSON.stringify(result.user));
        }
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      this.logout();
      return false;
    }
  }

  /**
   * Enhanced login with better error handling
   */
  async login(data: LoginFormData): Promise<AuthResponse> {
    try {
      const response = await this.fetchWithRetry(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Login failed' }));
        
        // Provide specific error messages based on status
        if (response.status === 401) {
          throw new Error('Invalid email or password');
        } else if (response.status === 429) {
          throw new Error('Too many login attempts. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        throw new Error(error.error || error.message || 'Login failed');
      }

      const result = await response.json();

      // Store token and user data securely
      if (result.token) {
        this.storeToken(result.token);
        
        // Store user data securely
        const { tokenStorage } = require('@/utils/secureStorage');
        tokenStorage.storeUser(result.user);
        localStorage.setItem('auth_user', JSON.stringify(result.user)); // Keep for backward compatibility
      }

      return result;
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Enhanced registration with better error handling
   */
  async register(data: RegisterFormData): Promise<AuthResponse> {
    try {
      const response = await this.fetchWithRetry(`${API_BASE}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Registration failed' }));
        
        // Provide specific error messages
        if (response.status === 409) {
          throw new Error('An account with this email already exists');
        } else if (response.status === 429) {
          throw new Error('Too many registration attempts. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        throw new Error(error.error || error.message || 'Registration failed');
      }

      const result = await response.json();

      // Handle different registration flows
      if (result.requiresVerification) {
        localStorage.setItem('pending_verification', data.email);
      } else if (result.token) {
        this.storeToken(result.token);
        
        // Store user data securely
        const { tokenStorage } = require('@/utils/secureStorage');
        tokenStorage.storeUser(result.user);
        localStorage.setItem('auth_user', JSON.stringify(result.user)); // Keep for backward compatibility
      }

      return result;
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Enhanced password reset with better error handling
   */
  async resetPassword(email: string): Promise<void> {
    try {
      const response = await this.fetchWithRetry(`${API_BASE}/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: 'Password reset failed' }));
        
        if (response.status === 429) {
          throw new Error('Too many password reset attempts. Please try again later.');
        } else if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        throw new Error(error.error || error.message || 'Password reset failed');
      }
    } catch (error) {
      if (this.isNetworkError(error)) {
        throw new Error('Network error. Please check your connection and try again.');
      }
      throw error;
    }
  }

  /**
   * Enhanced getCurrentUser with automatic token refresh
   */
  async getCurrentUser(): Promise<AuthUser | null> {
    const tokenData = this.getTokenData();
    if (!tokenData) return null;

    try {
      // Refresh token if needed
      const refreshSuccess = await this.refreshTokenIfNeeded();
      if (!refreshSuccess) {
        return null;
      }

      // Get fresh token data after potential refresh
      const currentTokenData = this.getTokenData();
      if (!currentTokenData) return null;

      // Try secure cached user data first
      let cachedUser = tokenStorage.getUser();
      
      // Fallback to regular storage
      if (!cachedUser) {
        const cachedUserStr = localStorage.getItem('auth_user');
        if (cachedUserStr) {
          try {
            cachedUser = JSON.parse(cachedUserStr);
          } catch {
            // Invalid cached data, ignore
          }
        }
      }
      
      if (cachedUser) {
        try {
          // Verify token is still valid with a lightweight check
          const response = await this.fetchWithRetry('/api/auth/me', {
            method: 'HEAD', // Use HEAD for lightweight check
            headers: {
              Authorization: `Bearer ${currentTokenData.token}`,
            },
          });

          if (response.ok) {
            return cachedUser;
          }
        } catch {
          // Fall through to full API call
        }
      }

      // Make full API call to get user data
      const response = await this.fetchWithRetry('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${currentTokenData.token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          this.logout();
        }
        return null;
      }

      const result = await response.json();
      const user = result.user || result;
      
      // Cache user data securely
      tokenStorage.storeUser(user);
      localStorage.setItem('auth_user', JSON.stringify(user)); // Keep for backward compatibility
      return user;
    } catch (error) {
      console.error('Error getting current user:', error);
      if (this.isNetworkError(error)) {
        // Don't logout on network errors, return cached data if available
        const { tokenStorage } = require('@/utils/secureStorage');
        let cachedUser = tokenStorage.getUser();
        
        // Fallback to regular storage
        if (!cachedUser) {
          const cachedUserStr = localStorage.getItem('auth_user');
          if (cachedUserStr) {
            try {
              cachedUser = JSON.parse(cachedUserStr);
            } catch {
              // Invalid cached data, ignore
            }
          }
        }
        
        if (cachedUser) {
          return cachedUser;
        }
      }
      this.logout();
      return null;
    }
  }

  /**
   * Enhanced logout with proper cleanup
   */
  async logout(): Promise<void> {
    const tokenData = this.getTokenData();
    
    // Clear all storage immediately
    const { tokenStorage } = require('@/utils/secureStorage');
    tokenStorage.clearAuth();
    
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_data');
    localStorage.removeItem('auth_user');
    localStorage.removeItem('pending_verification');

    // Try to notify server about logout (best effort)
    if (tokenData) {
      try {
        await this.fetchWithRetry(`${API_BASE}/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenData.token}`,
          },
        });
      } catch (error) {
        // Ignore logout API errors - local cleanup is more important
        console.warn('Logout API call failed:', error);
      }
    }
  }

  /**
   * Get current token (with automatic refresh)
   */
  async getToken(): Promise<string | null> {
    const refreshSuccess = await this.refreshTokenIfNeeded();
    if (!refreshSuccess) {
      return null;
    }

    const tokenData = this.getTokenData();
    return tokenData?.token || null;
  }

  /**
   * Get token synchronously (without refresh)
   */
  getTokenSync(): string | null {
    const tokenData = this.getTokenData();
    return tokenData?.token || null;
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const tokenData = this.getTokenData();
    if (!tokenData) return false;

    // Check if token is expired
    return tokenData.expiresAt > Date.now();
  }

  /**
   * Get time until token expires (in milliseconds)
   */
  getTimeUntilExpiry(): number {
    const tokenData = this.getTokenData();
    if (!tokenData) return 0;

    return Math.max(0, tokenData.expiresAt - Date.now());
  }
}

export const authService = new AuthService();
