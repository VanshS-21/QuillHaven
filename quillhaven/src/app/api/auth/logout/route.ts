import { NextRequest, NextResponse } from 'next/server';
import { logoutUser } from '@/lib/auth';
import { withCors } from '@/lib/middleware';

async function handleLogout(req: NextRequest) {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.get('authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 400 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Logout user (invalidate session)
    const result = await logoutUser(token);

    return NextResponse.json(
      {
        message: result.message,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Logout endpoint error:', error);
    return NextResponse.json(
      { error: 'Logout failed. Please try again.' },
      { status: 500 }
    );
  }
}

// Apply middleware
const handler = withCors(handleLogout);

export { handler as POST };
