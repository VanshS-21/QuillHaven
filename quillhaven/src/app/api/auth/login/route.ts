import { NextRequest, NextResponse } from 'next/server';
import { loginUser } from '@/lib/auth';
import { validateLogin, sanitizeEmail } from '@/utils/validation/auth';
import { withRateLimit, withCors, withValidation } from '@/lib/middleware';

interface LoginRequestData {
  email: string;
  password: string;
}

// Validation function for login data
function validateLoginData(data: any) {
  const validation = validateLogin(data);

  if (validation.isValid) {
    return {
      isValid: true,
      errors: [],
      data: {
        email: sanitizeEmail(data.email),
        password: data.password,
      } as LoginRequestData,
    };
  }

  return validation;
}

async function handleLogin(req: NextRequest, validatedData: LoginRequestData) {
  try {
    const { email, password } = validatedData;

    // Authenticate user
    const result = await loginUser(email, password);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 401 });
    }

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
  } catch (error) {
    console.error('Login endpoint error:', error);
    return NextResponse.json(
      { error: 'Login failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(
  withRateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 10, // 10 login attempts per 15 minutes
    message: 'Too many login attempts. Please try again later.',
  })(withValidation(validateLoginData, handleLogin))
);

export { handler as POST };
