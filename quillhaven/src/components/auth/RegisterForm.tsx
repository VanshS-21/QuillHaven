'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import Link from 'next/link';
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
import { AlertCircle, Eye, EyeOff, Loader2, WifiOff, CheckCircle, Clock } from 'lucide-react';
import type { RegisterFormData } from '@/types/auth';

const registerSchema = z
  .object({
    email: z
      .string()
      .min(1, 'Email is required')
      .email('Please enter a valid email address'),
    password: z
      .string()
      .min(1, 'Password is required')
      .min(8, 'Password must be at least 8 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

interface RegisterFormProps {
  onSwitchToLogin?: () => void;
}

const verificationSchema = z.object({
  code: z
    .string()
    .min(6, 'Verification code must be 6 characters')
    .max(6, 'Verification code must be 6 characters'),
});

type VerificationFormData = z.infer<typeof verificationSchema>;

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const { register, isLoading, error: authError } = useAuth();
  const { notifyError, notifySuccess, notifyInfo } = useNotifications();
  const [localError, setLocalError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showVerification, setShowVerification] = useState(false);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);

  const form = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      password: '',
      confirmPassword: '',
      firstName: '',
      lastName: '',
    },
  });

  const verificationForm = useForm<VerificationFormData>({
    resolver: zodResolver(verificationSchema),
    defaultValues: {
      code: '',
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

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setLocalError('');
      setSuccess('');
      
      if (!isOnline) {
        setLocalError('You appear to be offline. Please check your connection.');
        return;
      }

      await register(data);
      setRegisteredEmail(data.email);
      setShowVerification(true);
      const successMessage =
        'Account created successfully! Please check your email for verification or enter the verification code below.';
      setSuccess(successMessage);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Registration failed';
      setLocalError(errorMessage);
      
      // Provide helpful error messages
      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        notifyError(
          'Connection Error', 
          'Unable to connect to server. Please check your internet connection.',
          { persistent: true }
        );
      } else if (errorMessage.includes('already exists')) {
        notifyError(
          'Account Exists', 
          'An account with this email already exists. Try signing in instead.',
          {
            action: {
              label: 'Sign In',
              onClick: () => onSwitchToLogin?.()
            }
          }
        );
      }
      
      console.error('Registration error:', err);
    }
  };

  const onVerificationSubmit = async (data: VerificationFormData) => {
    try {
      setLocalError('');
      setVerificationLoading(true);

      const response = await fetch(`/api/auth/verify-email?token=${data.code}`);

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Invalid verification code');
      }

      const successMessage =
        'Email verified successfully! You can now sign in to your account.';
      setSuccess(successMessage);
      setShowVerification(false);
      notifySuccess(
        'Email Verified',
        'Your account is now active. You can sign in.'
      );

      // Switch to login after successful verification
      setTimeout(() => {
        if (onSwitchToLogin) {
          onSwitchToLogin();
        }
      }, 2000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Invalid verification code';
      setLocalError(errorMessage);
      
      if (errorMessage.includes('expired')) {
        notifyError(
          'Code Expired',
          'Your verification code has expired. Please request a new one.',
          {
            action: {
              label: 'Resend Code',
              onClick: () => handleResendVerification()
            }
          }
        );
      }
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    try {
      setLocalError('');
      setResendCooldown(60); // 60 second cooldown
      
      const response = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: registeredEmail }),
      });

      if (response.ok) {
        const successMessage = 'Verification code resent! Please check your email.';
        setSuccess(successMessage);
        notifyInfo(
          'Code Resent',
          'Please check your email for the new verification code.'
        );
      } else {
        const error = await response.json();
        const errorMessage = error.error || 'Failed to resend verification code';
        setLocalError(errorMessage);
        notifyError('Resend Failed', errorMessage);
        setResendCooldown(0); // Reset cooldown on error
      }
    } catch (error) {
      setLocalError('Failed to resend verification code');
      setResendCooldown(0); // Reset cooldown on error
    }
  };

  const displayError = localError || authError;
  const isFormDisabled = isLoading || !isOnline;

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordValue = form.watch('password');
  const passwordStrength = passwordValue ? getPasswordStrength(passwordValue) : 0;

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Create account
        </CardTitle>
        <CardDescription className="text-center">
          Join QuillHaven and start your writing journey
        </CardDescription>
        
        {!isOnline && (
          <div className="flex items-center justify-center space-x-2 text-sm text-orange-600 bg-orange-50 p-2 rounded-md">
            <WifiOff className="w-4 h-4" />
            <span>You are currently offline</span>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!showVerification ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {displayError && (
                <div className="flex items-start space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium">Registration Failed</p>
                    <p>{displayError}</p>
                  </div>
                </div>
              )}

              {success && (
                <div className="flex items-start space-x-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                  <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{success}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John" 
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
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Doe" 
                          disabled={isFormDisabled}
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

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
                          placeholder="Create a password"
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
                    {passwordValue && (
                      <div className="mt-2">
                        <div className="flex space-x-1">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <div
                              key={level}
                              className={`h-1 flex-1 rounded ${
                                level <= passwordStrength
                                  ? passwordStrength <= 2
                                    ? 'bg-red-500'
                                    : passwordStrength <= 3
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                                  : 'bg-gray-200'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Password strength: {
                            passwordStrength <= 2 ? 'Weak' :
                            passwordStrength <= 3 ? 'Medium' : 'Strong'
                          }
                        </p>
                      </div>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          disabled={isFormDisabled}
                          {...field}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                          disabled={isFormDisabled}
                        >
                          {showConfirmPassword ? (
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

              <Button type="submit" className="w-full" disabled={isFormDisabled}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    {!isOnline && <WifiOff className="w-4 h-4 mr-2" />}
                    Create account
                  </>
                )}
              </Button>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            {displayError && (
              <div className="flex items-start space-x-2 p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{displayError}</p>
              </div>
            )}

            {success && (
              <div className="flex items-start space-x-2 p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{success}</p>
              </div>
            )}

            <div className="text-center text-sm text-gray-600 mb-4">
              We&apos;ve sent a verification code to{' '}
              <strong>{registeredEmail}</strong>
            </div>

            <Form {...verificationForm}>
              <form
                onSubmit={verificationForm.handleSubmit(onVerificationSubmit)}
                className="space-y-4"
              >
                <FormField
                  control={verificationForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Verification Code</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder="Enter 6-digit code"
                          maxLength={6}
                          className="text-center text-lg tracking-widest"
                          disabled={!isOnline}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={verificationLoading || !isOnline}
                >
                  {verificationLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Email'
                  )}
                </Button>
              </form>
            </Form>

            <div className="text-center text-sm space-y-2">
              <div>
                Didn&apos;t receive the code?{' '}
                <button
                  type="button"
                  className="text-blue-600 hover:text-blue-500 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleResendVerification}
                  disabled={resendCooldown > 0 || !isOnline}
                >
                  {resendCooldown > 0 ? (
                    <>
                      <Clock className="w-3 h-3 inline mr-1" />
                      Resend in {resendCooldown}s
                    </>
                  ) : (
                    'Resend'
                  )}
                </button>
              </div>
              <div>
                Or{' '}
                <Link
                  href="/auth/verify-email"
                  className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
                >
                  verify via email link
                </Link>
              </div>
            </div>
          </div>
        )}

        {!showVerification && (
          <div className="mt-6 text-center text-sm">
            {onSwitchToLogin && (
              <div>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={onSwitchToLogin}
                  className="text-blue-600 hover:text-blue-500 hover:underline font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isFormDisabled}
                >
                  Sign in
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
