'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthContext';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
  showError?: boolean;
}

export function AuthGuard({
  children,
  requireAuth = true,
  redirectTo = '/auth',
  fallback,
  showError = true,
}: AuthGuardProps) {
  const { user, isLoading, isInitialized, error } = useAuth();
  const router = useRouter();
  const [shouldRedirect, setShouldRedirect] = useState(false);
  const [redirectDelay, setRedirectDelay] = useState(false);

  /**
   * Handle retry for authentication errors
   */
  const handleRetry = useCallback(() => {
    window.location.reload();
  }, []);

  /**
   * Handle manual redirect
   */
  const handleManualRedirect = useCallback(() => {
    if (requireAuth && !user) {
      router.push(redirectTo);
    } else if (!requireAuth && user) {
      router.push('/dashboard');
    }
  }, [requireAuth, user, redirectTo, router]);

  /**
   * Determine if we should redirect and handle the redirect
   */
  useEffect(() => {
    if (!isInitialized || isLoading) {
      return;
    }

    const needsRedirect = 
      (requireAuth && !user) || 
      (!requireAuth && user);

    if (needsRedirect) {
      setShouldRedirect(true);
      setRedirectDelay(true);
      
      const timer = setTimeout(() => {
        setRedirectDelay(false);
        const targetPath = requireAuth && !user ? redirectTo : '/dashboard';
        router.push(targetPath);
      }, 100); // Small delay to prevent hydration issues

      return () => clearTimeout(timer);
    } else {
      setShouldRedirect(false);
      setRedirectDelay(false);
    }
  }, [user, isLoading, isInitialized, requireAuth, redirectTo, router]);

  /**
   * Loading state while initializing authentication
   */
  if (!isInitialized || isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <div
              className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
              role="status"
              aria-label="Loading authentication status"
            />
            <p className="mt-4 text-gray-600">
              {isLoading ? 'Checking authentication...' : 'Loading...'}
            </p>
            
            {/* Show additional info if loading takes too long */}
            <div className="mt-6 text-sm text-gray-500">
              <p>This is taking longer than usual.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRetry}
                className="mt-2"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            </div>
          </div>
        </div>
      )
    );
  }

  /**
   * Error state with retry option
   */
  if (error && showError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Error
          </h2>
          <p className="text-gray-600 mb-6">
            {error}
          </p>
          <div className="space-y-3">
            <Button onClick={handleRetry} className="w-full">
              <RefreshCw className="w-4 h-4 mr-2" />
              Try Again
            </Button>
            <Button 
              variant="outline" 
              onClick={handleManualRedirect}
              className="w-full"
            >
              {requireAuth ? 'Go to Login' : 'Go to Dashboard'}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Redirecting state
   */
  if (shouldRedirect) {
    const redirectMessage = requireAuth && !user 
      ? 'Redirecting to login...' 
      : 'Redirecting to dashboard...';

    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <div
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"
            role="status"
            aria-label="Redirecting"
          />
          <p className="mt-4 text-gray-600">{redirectMessage}</p>
          
          {/* Manual redirect option if automatic redirect fails */}
          {redirectDelay && (
            <div className="mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualRedirect}
              >
                Continue Manually
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  /**
   * Access denied state (shouldn't normally reach here due to redirects)
   */
  if (requireAuth && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Authentication Required
          </h2>
          <p className="text-gray-600 mb-6">
            You need to be logged in to access this page.
          </p>
          <Button onClick={() => router.push(redirectTo)} className="w-full">
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  if (!requireAuth && user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Already Logged In
          </h2>
          <p className="text-gray-600 mb-6">
            You are already authenticated.
          </p>
          <Button onClick={() => router.push('/dashboard')} className="w-full">
            Go to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
