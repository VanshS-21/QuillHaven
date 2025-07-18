import { NextRequest, NextResponse } from 'next/server';
import { initiatePasswordReset } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import {
  validatePasswordResetRequest,
  sanitizeEmail,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';
import { withErrorHandler, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, SecurityLogger } from '@/lib/logger';
import { withEmailDegradation } from '@/lib/gracefulDegradation';

interface ForgotPasswordRequestData {
  email: string;
}

// Validation function for forgot password data
function validateForgotPasswordData(data: unknown) {
  const typedData = data as { email?: string };
  const validation = validatePasswordResetRequest(typedData.email || '');

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        email: sanitizeEmail(typedData.email || ''),
      } as ForgotPasswordRequestData,
    };
  }

  return validation;
}

async function handleForgotPassword(
  req: NextRequest,
  validatedData: ForgotPasswordRequestData
) {
  const { email } = validatedData;
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  // Initiate password reset with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'password_reset_initiation',
    async () => {
      try {
        return await initiatePasswordReset(email);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { email, clientIP }
  );

  // If successful and user exists, send reset email
  if (result.success) {
    // Get user to send personalized email (only if user exists)
    const user = await PerformanceLogger.measureAsync(
      'user_lookup_for_reset',
      async () => {
        try {
          return await prisma.user.findUnique({
            where: { email },
            select: {
              email: true,
              firstName: true,
              passwordResetToken: true,
            },
          });
        } catch (error) {
          throw handleDatabaseError(error);
        }
      },
      { email }
    );

    if (user && user.passwordResetToken) {
      await withEmailDegradation(
        async () => {
          const emailResult = await sendPasswordResetEmail(
            user.email,
            user.passwordResetToken!,
            user.firstName || undefined
          );

          if (!emailResult.success) {
            logger.warn('Failed to send password reset email', {
              email: user.email,
              error: emailResult.message,
              clientIP,
            });
          }

          return emailResult;
        },
        async () => {
          logger.warn('Email service unavailable for password reset', {
            email: user.email,
            clientIP,
          });
          return {
            success: false,
            message: 'Email service temporarily unavailable',
          };
        }
      );
    }
  }

  // Log security event
  SecurityLogger.logAuthAttempt(
    result.success,
    email,
    clientIP,
    req.headers.get('user-agent') || 'unknown'
  );

  logger.info('Password reset request processed', {
    email,
    success: result.success,
    clientIP,
    userAgent: req.headers.get('user-agent'),
  });

  // Always return success message for security (don't reveal if email exists)
  return NextResponse.json(
    {
      message: result.message,
    },
    { status: 200 }
  );
}

// Apply middleware
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 20, // 20 password reset requests per 15 minutes (more lenient for testing)
      message: 'Too many password reset requests. Please try again later.',
    })(withValidation(validateForgotPasswordData, handleForgotPassword))
  )
);

export { handler as POST };
