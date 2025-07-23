import { NextResponse } from 'next/server'
import { AuthService } from '@/lib/services/auth'

/**
 * GET /api/auth/user
 * Returns the current authenticated user information
 */
export async function GET() {
  try {
    // Check if user is authenticated
    const isAuthenticated = await AuthService.isAuthenticated()

    if (!isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get current user information
    const user = await AuthService.getCurrentUser()
    const { userId, sessionId } = await AuthService.getSession()

    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        firstName: user?.firstName,
        lastName: user?.lastName,
        emailAddress: user?.emailAddresses?.[0]?.emailAddress,
        imageUrl: user?.imageUrl,
        createdAt: user?.createdAt,
        updatedAt: user?.updatedAt,
      },
      session: {
        userId,
        sessionId,
      },
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
