import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';
import { sendVerificationEmail } from '@/lib/email';
import {
  validateRegistration,
  sanitizeEmail,
  sanitizeName,
  type RegistrationData,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';
import {
  withErrorHandler,
  ValidationError,
  ConflictError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger } from '@/lib/logger';
import { withEmailDegradation } from '@/lib/gracefulDegradation';

interface RegisterRequestData {
  email: string;
  password: string;
  confirmPassword: string;
  firstName?: string;
  lastName?: string;
}

// Validation function for registration data
function validateRegisterData(data: unknown) {
  const typedData = data as {
    email?: string;
    password?: string;
    confirmPassword?: string;
    firstName?: string;
    lastName?: string;
  };
  const validation = validateRegistration(typedData as RegistrationData);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        email: sanitizeEmail(typedData.email || ''),
        password: typedData.password || '',
        confirmPassword: typedData.confirmPassword || '',
        firstName: typedData.firstName
          ? sanitizeName(typedData.firstName)
          : undefined,
        lastName: typedData.lastName
          ? sanitizeName(typedData.lastName)
          : undefined,
      } as RegisterRequestData,
    };
  }

  return validation;
}

async function handleRegister(
  req: NextRequest,
  validatedData: RegisterRequestData
) {
  const { email, password, firstName, lastName } = validatedData;
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = req.headers.get('user-agent');

  // Register user with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'user_registration',
    async () => {
      try {
        return await registerUser(email, password, firstName, lastName);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { email, clientIP }
  );

  if (!result.success) {
    logger.warn('Registration attempt failed', {
      email,
      reason: result.message,
      clientIP,
      userAgent,
    });

    // Check if it's a conflict (user already exists)
    if (
      result.message?.toLowerCase().includes('already exists') ||
      result.message?.toLowerCase().includes('already registered')
    ) {
      throw new ConflictError(result.message || 'User already exists');
    }

    throw new ValidationError(result.message || 'Registration failed');
  }

  logger.info('User registered successfully', {
    userId: result.user?.id,
    email,
    clientIP,
    hasFirstName: !!firstName,
    hasLastName: !!lastName,
  });

  // Send verification email with graceful degradation
  if (result.user) {
    await withEmailDegradation(
      async () => {
        const emailResult = await sendVerificationEmail(
          result.user!.email,
          result.user!.emailVerificationToken!,
          result.user!.firstName || undefined
        );

        if (!emailResult.success) {
          throw new Error(`Email sending failed: ${emailResult.message}`);
        }

        logger.info('Verification email sent successfully', {
          userId: result.user!.id,
          email: result.user!.email,
        });

        return emailResult;
      },
      async () => {
        // Fallback: Log that email couldn't be sent but don't fail registration
        logger.warn(
          'Verification email could not be sent - email service unavailable',
          {
            userId: result.user!.id,
            email: result.user!.email,
          }
        );
        return {
          success: false,
          message: 'Email service temporarily unavailable',
        };
      }
    );
  }

  return NextResponse.json(
    {
      message: result.message,
      user: {
        id: result.user?.id,
        email: result.user?.email,
        firstName: result.user?.firstName,
        lastName: result.user?.lastName,
        emailVerified: result.user?.emailVerified,
      },
    },
    { status: 201 }
  );
}

// Apply middleware with error handling
const handler = withErrorHandler(
  withCors(
    withRateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 50, // 50 registration attempts per 15 minutes (more lenient for testing)
      message: 'Too many registration attempts. Please try again later.',
    })(withValidation(validateRegisterData, handleRegister))
  )
);

export { handler as POST };
