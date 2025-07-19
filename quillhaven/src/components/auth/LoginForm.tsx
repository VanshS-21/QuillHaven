'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAuth } from './AuthContext';
import { useNotifications } from '@/components/ui/NotificationSystem';
import { AlertCircle, Eye, EyeOff, Loader2, Wifi, WifiOff } from 'lucide-react';
import type { LoginFormData } from '@/types/auth';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(6, 'Password must be at least 6 characters'),
});

interface LoginFormProps {
  onSwitchToRegister?: () => void;
  onSwitchToReset?: () => void;
}

export function LoginForm({
  onSwitchToRegister,
  onSwitchToReset,
}: LoginFormProps) {
  const { login, isLoading, error: authError } = useAuth();
  const { notifyError } = useNotifications();
  const [localError, setLocalError] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [attemptCount, setAttemptCount] = useState(0);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Clear local error when auth error changes
  useEffect(() => {
    if (authError) {
      setLocalError('');
    }
  }, [authError]);

  const onSubmit = async (data: LoginFormData) => {
    try {
      setLocalError('');
      setAttemptCount(prev => prev + 1);
      
      // Check if user is online
      if (!isOnline) {
        setLocalError('You appear to be offline. Please check your connection.');
        return;
      }

      await login(data.email, data.password);
      // Success handling is done in AuthContext
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setLocalError(errorMessage);
      
      // Provide helpful error messages based on error type
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        notifyError(
          'Connection Error', 
          'Unable to connect to server. Please check your internet connection.',
          { persistent: true }
        );
      } else if (errorMessage.includes('timeout')) {
        notifyError(
          'Request Timeout', 
          'The request took too long. Please try again.',
          { 
            action: {
              label: 'Retry',
              onClick: () => form.handleSubmit(onSubmit)()
            }
          }
        );
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('Too many')) {
        notifyError(
          'Too Many Attempts', 
          'Please wait a moment before trying again.',
          { persistent: true }
        );
      }
      
      console.error('Login error:', err);
    }
  };

  const displayError = localError || authError;
  const isFormDisabled = isLoading || !isOnline;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Welcome back
        </CardTitle>
        <CardDescription className="text-center">
          Sign in to your QuillHaven account
        </CardDescription>
        
        {/* Connection status indicator */}
        {!isOnline && (
          <div className="flex items-center justify-center space-x-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {displayError && (
              <div className="flex items-start space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Login Failed</p>
                  <p>{displayError}</p>
                  {attemptCount > 2 && (
                    <p className="mt-1 text-xs">
                      Having trouble? Try{' '}
                      <button
                        type="button"
                        onClick={onSwitchToReset}
                        className="underline hover:no-underline"
                      >
                        resetting your password
                      </button>
                    </p>
                  )}
                </div>
              </div>
            )}

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      disabled={isFormDisabled}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        disabled={isFormDisabled}
                        {...field}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                        disabled={isFormDisabled}
                      >
                        {showPassword ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button 
              type="submit" 
              className="w-full" 
              disabled={isFormDisabled}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  {!isOnline && <WifiOff className="w-4 h-4 mr-2" />}
                  Sign in
                </>
              )}
            </Button>

            {/* Connection status help */}
            {!isOnline && (
              <div className="text-xs text-center text-gray-500">
                <Wifi className="w-3 h-3 inline mr-1" />
                Please check your internet connection to continue
              </div>
            )}
          </form>
        </Form>

        <div className="mt-6 space-y-2 text-center text-sm">
          {onSwitchToReset && (
            <button
              type="button"
              onClick={onSwitchToReset}
              className="text-blue-600 hover:text-blue-500 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={isFormDisabled}
            >
              Forgot your password?
            </button>
          )}

          {onSwitchToRegister && (
            <div>
              Don&apos;t have an account?{' '}
              <button
                type="button"
                onClick={onSwitchToRegister}
                className="text-blue-600 hover:text-blue-500 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isFormDisabled}
              >
                Sign up
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
