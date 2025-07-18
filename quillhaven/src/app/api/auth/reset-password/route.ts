import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth';
import {
  validatePasswordReset,
  type PasswordResetData,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';

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
  const validation = validatePasswordReset(typedData as PasswordResetData);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        token: typedData.token || '',
        password: typedData.password || '',
        confirmPassword: typedData.confirmPassword || '',
      } as ResetPasswordRequestData,
    };
  }

  return validation;
}

async function handleResetPassword(
  req: NextRequest,
  validatedData: ResetPasswordRequestData
) {
  try {
    const { token, password } = validatedData;

    // Reset password
    const result = await resetPassword(token, password);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 });
    }

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
  } catch (error) {
    console.error('Reset password endpoint error:', error);
    return NextResponse.json(
      { error: 'Password reset failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 25, // 25 password reset attempts per 15 minutes (more lenient for testing)
    message: 'Too many password reset attempts. Please try again later.',
  })(withValidation(validateResetPasswordData, handleResetPassword))
);

export { handler as POST };
