import { NextRequest, NextResponse } from 'next/server';
import { resetPassword } from '@/lib/auth';
import { validatePasswordReset } from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';

interface ResetPasswordRequestData {
  token: string;
  password: string;
  confirmPassword: string;
}

// Validation function for reset password data
function validateResetPasswordData(data: any) {
  const validation = validatePasswordReset(data);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        token: data.token,
        password: data.password,
        confirmPassword: data.confirmPassword,
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
    maxRequests: 5, // 5 password reset attempts per 15 minutes
    message: 'Too many password reset attempts. Please try again later.',
  })(withValidation(validateResetPasswordData, handleResetPassword))
);

export { handler as POST };
