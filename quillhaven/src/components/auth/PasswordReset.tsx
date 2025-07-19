'use client';

import { useState } from 'react';
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
import type { PasswordResetFormData } from '@/types/auth';

const resetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

interface PasswordResetProps {
  onSwitchToLogin?: () => void;
}

export function PasswordReset({ onSwitchToLogin }: PasswordResetProps) {
  const { resetPassword } = useAuth();
  const { notifyError, notifySuccess, notifyInfo } = useNotifications();
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const form = useForm<PasswordResetFormData>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      email: '',
    },
  });

  const onSubmit = async (data: PasswordResetFormData) => {
    try {
      setError('');
      setSuccess('');
      setIsLoading(true);
      await resetPassword(data.email);
      const successMessage = `Password reset instructions have been sent to ${data.email}. Please check your email and follow the instructions to reset your password.`;
      setSuccess(successMessage);
      setEmailSent(true);
      form.reset();
      notifySuccess(
        'Reset Email Sent',
        `Check your email at ${data.email} for reset instructions.`
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Password reset failed';
      setError(errorMessage);
      notifyError('Reset Failed', errorMessage);
      console.error('Password reset error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendEmail = async () => {
    const email = form.getValues('email');
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      setError('');
      setIsLoading(true);
      await resetPassword(email);
      const successMessage =
        'Password reset instructions have been resent to your email.';
      setSuccess(successMessage);
      notifyInfo(
        'Email Resent',
        'Please check your email for the new reset instructions.'
      );
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to resend email';
      setError(errorMessage);
      notifyError('Resend Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl font-bold text-center">
          Reset password
        </CardTitle>
        <CardDescription className="text-center">
          Enter your email address and we&apos;ll send you a link to reset your
          password
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {error}
              </div>
            )}

            {success && (
              <div className="p-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md">
                {success}
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
                      placeholder="Enter your email address"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Sending...' : 'Send reset link'}
            </Button>
          </form>
        </Form>

        {emailSent && (
          <div className="mt-4 text-center">
            <p className="text-sm text-gray-600 mb-2">
              Didn&apos;t receive the email?
            </p>
            <button
              type="button"
              onClick={handleResendEmail}
              disabled={isLoading}
              className="text-blue-600 hover:text-blue-500 hover:underline font-medium text-sm"
            >
              Resend reset link
            </button>
          </div>
        )}

        <div className="mt-6 text-center text-sm">
          {onSwitchToLogin && (
            <div>
              Remember your password?{' '}
              <button
                type="button"
                onClick={onSwitchToLogin}
                className="text-blue-600 hover:text-blue-500 hover:underline font-medium"
              >
                Sign in
              </button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
