import { NextRequest, NextResponse } from 'next/server';
import { initiatePasswordReset } from '@/lib/auth';
import { sendPasswordResetEmail } from '@/lib/email';
import {
  validatePasswordResetRequest,
  sanitizeEmail,
} from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

interface ForgotPasswordRequestData {
  email: string;
}

// Validation function for forgot password data
function validateForgotPasswordData(data: any) {
  const validation = validatePasswordResetRequest(data.email);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        email: sanitizeEmail(data.email),
      } as ForgotPasswordRequestData,
    };
  }

  return validation;
}

async function handleForgotPassword(
  req: NextRequest,
  validatedData: ForgotPasswordRequestData
) {
  try {
    const { email } = validatedData;

    // Initiate password reset
    const result = await initiatePasswordReset(email);

    // If successful and user exists, send reset email
    if (result.success) {
      // Get user to send personalized email (only if user exists)
      const user = await prisma.user.findUnique({
        where: { email },
        select: {
          email: true,
          firstName: true,
          passwordResetToken: true,
        },
      });

      if (user && user.passwordResetToken) {
        const emailResult = await sendPasswordResetEmail(
          user.email,
          user.passwordResetToken,
          user.firstName || undefined
        );

        if (!emailResult.success) {
          console.error(
            'Failed to send password reset email:',
            emailResult.message
          );
          // Don't reveal if email sending failed for security reasons
        }
      }
    }

    // Always return success message for security (don't reveal if email exists)
    return NextResponse.json(
      {
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Forgot password endpoint error:', error);
    return NextResponse.json(
      { error: 'Password reset request failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 3, // 3 password reset requests per 15 minutes
    message: 'Too many password reset requests. Please try again later.',
  })(withValidation(validateForgotPasswordData, handleForgotPassword))
);

export { handler as POST };
