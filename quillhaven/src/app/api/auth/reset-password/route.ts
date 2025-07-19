import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth';
import {
  validatePasswordReset,
  type PasswordResetData,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';
import {
  withErrorHandler,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import {
  logger,
  PerformanceLogger,
  SecurityLogger,
  BusinessLogger,
} from '@/lib/logger';

interface ResetPasswordRequestData {
  token: string;
  password: string;
  confirmPassword: string;
}

// Validation function for reset password data
function validateResetPasswordData(data: unknown) {
  const typedData = data as {
    token?: string;
    password?: string;
    confirmPassword?: string;
  };
  
  // Create a proper PasswordResetData object with defaults
  const resetData: PasswordResetData = {
    token: typedData.token || '',
    password: typedData.password || '',
    confirmPassword: typedData.confirmPassword || '',
  };
  
  const validation = validatePasswordReset(resetData);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        token: resetData.token,
        password: resetData.password,
        confirmPassword: resetData.confirmPassword,
      } as ResetPasswordRequestData,
    };
  }

  return validation;
}

async function handleResetPassword(
  req: NextRequest,
  validatedData: ResetPasswordRequestData
) {
  const { token, password } = validatedData;
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Reset password with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'password_reset_execution',
    async () => {
      try {
        return await resetPassword(token, password);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { token: token.substring(0, 8) + '...', clientIP }
  );

  if (!result.success) {
    // Log failed password reset attempt
    SecurityLogger.logAuthAttempt(
      false,
      result.user?.email || 'unknown',
      clientIP,
      userAgent
    );

    logger.warn('Password reset failed', {
      token: token.substring(0, 8) + '...',
      reason: result.message,
      clientIP,
      userAgent,
    });

    if (
      result.message?.toLowerCase().includes('expired') ||
      result.message?.toLowerCase().includes('invalid')
    ) {
      throw new ValidationError(result.message || 'Password reset failed');
    }

    throw new ValidationError('Password reset failed');
  }

  // Log successful password reset
  SecurityLogger.logAuthAttempt(
    true,
    result.user?.email || 'unknown',
    clientIP,
    userAgent
  );

  BusinessLogger.logUserAction('password_reset', result.user?.id || 'unknown', {
    clientIP,
    userAgent,
    timestamp: new Date().toISOString(),
  });

  logger.info('Password reset successful', {
    userId: result.user?.id,
    email: result.user?.email,
    clientIP,
    userAgent,
  });

  return NextResponse.json(
    {
      message: result.message,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        firstName: result.user?.firstName,
        lastName: result.user?.lastName,
      },
    },
    { status: 200 }
  );
}

// Apply middleware
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 1000, // 1000 password reset attempts per 15 minutes (very lenient for testing)
      message: 'Too many password reset attempts. Please try again later.',
    })(withValidation(validateResetPasswordData, handleResetPassword))
  )
);

export { handler as POST };
