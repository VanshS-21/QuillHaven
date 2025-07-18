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
  try {
    const { email, password, firstName, lastName } = validatedData;

    // Register user
    const result = await registerUser(email, password, firstName, lastName);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

    // Send verification email if user was created successfully
    if (result.user) {
      const emailResult = await sendVerificationEmail(
        result.user.email,
        result.user.emailVerificationToken!,
        result.user.firstName || undefined
      );

      if (!emailResult.success) {
        console.error(
          'Failed to send verification email:',
          emailResult.message
        );
        // Don't fail registration if email fails, just log it
      }
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
  } catch (error) {
    console.error('Registration endpoint error:', error);
    return NextResponse.json(
      { error: 'Registration failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 50, // 50 registration attempts per 15 minutes (more lenient for testing)
    message: 'Too many registration attempts. Please try again later.',
  })(withValidation(validateRegisterData, handleRegister))
);

export { handler as POST };
