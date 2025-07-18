'use client';

import { useCallback } from 'react';
import { useNotifications } from '@/components/ui/NotificationSystem';

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
  details?: unknown;
}

export const useErrorHandling = () => {
  const { notifyError, notifyWarning, notifyInfo } = useNotifications();

  const handleApiError = useCallback(
    async (response: Response, context?: string) => {
      try {
        const errorData: ApiError = await response.json();
        
        const title = errorData.message || `HTTP ${response.status} Error`;
        const message = context ? `Error in ${context}` : errorData.error || '';
        
        // Different handling based on status code
        if (response.status >= 500) {
          notifyError(title, message, {
            persistent: true,
            action: errorData.requestId ? {
              label: 'Copy Error ID',
              onClick: () => {
                navigator.clipboard.writeText(errorData.requestId!);
                notifyInfo('Error ID copied to clipboard');
              },
            } : undefined,
          });
        } else if (response.status === 429) {
          notifyWarning('Rate limit exceeded', 'Please wait before trying again', {
            duration: 10000,
          });
        } else if (response.status === 401) {
          notifyWarning('Authentication required', 'Please log in to continue', {
            persistent: true,
            action: {
              label: 'Go to Login',
              onClick: () => {
                window.location.href = '/auth';
              },
            },
          });
        } else if (response.status === 403) {
          notifyWarning('Access denied', 'You do not have permission to perform this action');
        } else if (response.status >= 400) {
          notifyWarning(title, message);
        }
      } catch {
        // If we can't parse the error response, show a generic error
        notifyError(
          `HTTP ${response.status} Error`,
          context ? `Error in ${context}` : 'Please try again later'
        );
      }
    },
    [notifyError, notifyWarning, notifyInfo]
  );

  const handleError = useCallback(
    (error: unknown, context?: string) => {
      let title = 'An error occurred';
      let message = 'Please try again later';

      if (error instanceof Error) {
        title = error.message;
        message = context ? `Error in ${context}` : '';
      } else if (typeof error === 'string') {
        title = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        title = String(error.message);
      }

      notifyError(title, message);
    },
    [notifyError]
  );

  const handleNetworkError = useCallback(
    (context?: string) => {
      notifyError(
        'Network Error',
        context 
          ? `Unable to connect to server while ${context}. Please check your internet connection.`
          : 'Unable to connect to server. Please check your internet connection.',
        {
          persistent: true,
          action: {
            label: 'Retry',
            onClick: () => {
              window.location.reload();
            },
          },
        }
      );
    },
    [notifyError]
  );

  const withErrorHandling = useCallback(
    <T extends unknown[], R>(
      fn: (...args: T) => Promise<R>,
      context?: string
    ) => {
      return async (...args: T): Promise<R | undefined> => {
        try {
          return await fn(...args);
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('fetch')) {
            handleNetworkError(context);
          } else {
            handleError(error, context);
          }
          return undefined;
        }
      };
    },
    [handleError, handleNetworkError]
  );

  const withApiErrorHandling = useCallback(
    <T extends unknown[], R>(
      fn: (...args: T) => Promise<Response>,
      context?: string,
      successHandler?: (response: Response) => Promise<R>
    ) => {
      return async (...args: T): Promise<R | undefined> => {
        try {
          const response = await fn(...args);
          
          if (!response.ok) {
            await handleApiError(response, context);
            return undefined;
          }
          
          if (successHandler) {
            return await successHandler(response);
          }
          
          return response.json() as Promise<R>;
        } catch (error) {
          if (error instanceof TypeError && error.message.includes('fetch')) {
            handleNetworkError(context);
          } else {
            handleError(error, context);
          }
          return undefined;
        }
      };
    },
    [handleApiError, handleError, handleNetworkError]
  );

  return {
    handleError,
    handleApiError,
    handleNetworkError,
    withErrorHandling,
    withApiErrorHandling,
  };
};