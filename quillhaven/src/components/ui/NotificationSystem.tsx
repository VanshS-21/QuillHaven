'use client';

import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
} from 'react';
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Button } from './button';

export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message?: string;
  duration?: number;
  persistent?: boolean;
  action?: {
    label: string;
    onClick: () => void;
  };
  onDismiss?: () => void;
}

interface NotificationState {
  notifications: Notification[];
}

type NotificationAction =
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'CLEAR_ALL' };

const initialState: NotificationState = {
  notifications: [],
};

function notificationReducer(
  state: NotificationState,
  action: NotificationAction
): NotificationState {
  switch (action.type) {
    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case 'REMOVE_NOTIFICATION':
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== action.payload
        ),
      };
    case 'CLEAR_ALL':
      return {
        ...state,
        notifications: [],
      };
    default:
      return state;
  }
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id'>) => string;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  notifySuccess: (
    title: string,
    message?: string,
    options?: Partial<Notification>
  ) => string;
  notifyError: (
    title: string,
    message?: string,
    options?: Partial<Notification>
  ) => string;
  notifyWarning: (
    title: string,
    message?: string,
    options?: Partial<Notification>
  ) => string;
  notifyInfo: (
    title: string,
    message?: string,
    options?: Partial<Notification>
  ) => string;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined
);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      'useNotifications must be used within a NotificationProvider'
    );
  }
  return context;
};

interface NotificationProviderProps {
  children: React.ReactNode;
  maxNotifications?: number;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
  children,
  maxNotifications = 5,
}) => {
  const [state, dispatch] = useReducer(notificationReducer, initialState);

  const addNotification = useCallback(
    (notification: Omit<Notification, 'id'>): string => {
      const id = `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const newNotification: Notification = {
        ...notification,
        id,
        duration: notification.duration ?? 5000,
      };

      dispatch({ type: 'ADD_NOTIFICATION', payload: newNotification });

      // Remove oldest notifications if we exceed the limit
      if (state.notifications.length >= maxNotifications) {
        const oldestId = state.notifications[0].id;
        dispatch({ type: 'REMOVE_NOTIFICATION', payload: oldestId });
      }

      // Auto-remove notification after duration (unless persistent)
      if (
        !newNotification.persistent &&
        newNotification.duration &&
        newNotification.duration > 0
      ) {
        setTimeout(() => {
          dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
        }, newNotification.duration);
      }

      return id;
    },
    [state.notifications, maxNotifications]
  );

  const removeNotification = useCallback((id: string) => {
    dispatch({ type: 'REMOVE_NOTIFICATION', payload: id });
  }, []);

  const clearAll = useCallback(() => {
    dispatch({ type: 'CLEAR_ALL' });
  }, []);

  const notifySuccess = useCallback(
    (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'success', title, message }),
    [addNotification]
  );

  const notifyError = useCallback(
    (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({
        ...options,
        type: 'error',
        title,
        message,
        persistent: options?.persistent ?? true, // Errors are persistent by default
      }),
    [addNotification]
  );

  const notifyWarning = useCallback(
    (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'warning', title, message }),
    [addNotification]
  );

  const notifyInfo = useCallback(
    (title: string, message?: string, options?: Partial<Notification>) =>
      addNotification({ ...options, type: 'info', title, message }),
    [addNotification]
  );

  const value: NotificationContextType = {
    notifications: state.notifications,
    addNotification,
    removeNotification,
    clearAll,
    notifySuccess,
    notifyError,
    notifyWarning,
    notifyInfo,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationContainer />
    </NotificationContext.Provider>
  );
};

const NotificationContainer: React.FC = () => {
  const { notifications, removeNotification } = useNotifications();

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {notifications.map((notification) => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => {
            notification.onDismiss?.();
            removeNotification(notification.id);
          }}
        />
      ))}
    </div>
  );
};

interface NotificationItemProps {
  notification: Notification;
  onDismiss: () => void;
}

const NotificationItem: React.FC<NotificationItemProps> = ({
  notification,
  onDismiss,
}) => {
  const [isVisible, setIsVisible] = React.useState(false);

  useEffect(() => {
    // Trigger animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 150); // Wait for animation
  };

  const getIcon = () => {
    switch (notification.type) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'error':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-600" />;
    }
  };

  const getBackgroundColor = () => {
    switch (notification.type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
    }
  };

  return (
    <div
      className={`
        transform transition-all duration-300 ease-in-out
        ${isVisible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
        ${getBackgroundColor()}
        border rounded-lg shadow-lg p-4 min-w-0 max-w-sm
      `}
    >
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">{getIcon()}</div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 truncate">
            {notification.title}
          </h4>
          {notification.message && (
            <p className="text-sm text-gray-600 mt-1 break-words">
              {notification.message}
            </p>
          )}
          {notification.action && (
            <div className="mt-3">
              <Button
                size="sm"
                variant="outline"
                onClick={notification.action.onClick}
                className="text-xs"
              >
                {notification.action.label}
              </Button>
            </div>
          )}
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

// Hook for handling API errors with notifications
export const useErrorHandler = () => {
  const { notifyError, notifyWarning } = useNotifications();

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

  const handleApiError = useCallback(
    async (response: Response, context?: string) => {
      try {
        const errorData = await response.json();
        const title = errorData.message || `HTTP ${response.status} Error`;
        const message = context ? `Error in ${context}` : errorData.error || '';

        if (response.status >= 500) {
          notifyError(title, message);
        } else if (response.status >= 400) {
          notifyWarning(title, message);
        }
      } catch {
        notifyError(
          `HTTP ${response.status} Error`,
          context ? `Error in ${context}` : 'Please try again later'
        );
      }
    },
    [notifyError, notifyWarning]
  );

  return { handleError, handleApiError };
};

// Global error handler for unhandled promise rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Unhandled promise rejection:', event.reason);

    // You could dispatch a notification here if the provider is available
    // This would require a global reference to the notification system
  });
}
