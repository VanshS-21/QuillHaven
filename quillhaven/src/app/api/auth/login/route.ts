import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import {
  validateLogin,
  sanitizeEmail,
  type LoginData,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';
import { withErrorHandler, AuthenticationError, ValidationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, SecurityLogger, PerformanceLogger } from '@/lib/logger';

interface LoginRequestData {
  email: string;
  password: string;
}

// Validation function for login data
function validateLoginData(data: unknown) {
  const typedData = data as { email?: string; password?: string };
  const validation = validateLogin(typedData as LoginData);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        email: sanitizeEmail(typedData.email || ''),
        password: typedData.password || '',
      } as LoginRequestData,
    };
  }

  return validation;
}

async function handleLogin(req: NextRequest, validatedData: LoginRequestData) {
  const { email, password } = validatedData;
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent');

  // Authenticate user with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'user_login',
    async () => {
      try {
        return await loginUser(email, password);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { email, clientIP }
  );

  // Log authentication attempt
  SecurityLogger.logAuthAttempt(result.success, email, clientIP, userAgent || undefined);

  if (!result.success) {
    logger.warn('Login attempt failed', {
      email,
      reason: result.message,
      clientIP,
      userAgent,
    });
    throw new AuthenticationError(result.message);
  }

  logger.info('User logged in successfully', {
    userId: result.user?.id,
    email,
    clientIP,
    subscriptionTier: result.user?.subscriptionTier,
  });

  // Return success response with token and user data
  return NextResponse.json(
    {
      message: result.message,
      token: result.token,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        firstName: result.user?.firstName,
        lastName: result.user?.lastName,
        emailVerified: result.user?.emailVerified,
        subscriptionTier: result.user?.subscriptionTier,
        writingPreferences: result.user?.writingPreferences,
      },
    },
    { status: 200 }
  );
}

// Apply middleware with error handling
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100, // 100 login attempts per 15 minutes (more lenient for testing)
      message: 'Too many login attempts. Please try again later.',
    })(withValidation(validateLoginData, handleLogin))
  )
);

export { handler as POST };
