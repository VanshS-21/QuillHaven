import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SessionService } from '@/lib/services/session'

/**
 * POST /api/auth/session/activity
 * Update session activity timestamp
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId } = await auth()

    if (!userId || !sessionId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { sessionId: requestSessionId } = body

    // Verify the session ID matches the authenticated session
    if (requestSessionId && requestSessionId !== sessionId) {
      return NextResponse.json({ error: 'Invalid session ID' }, { status: 400 })
    }

    // Update session activity
    await SessionService.updateSessionActivity(sessionId, {
      ipAddress:
        req.headers.get('x-forwarded-for') ||
        req.headers.get('x-real-ip') ||
        'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
    })

    return NextResponse.json({
      success: true,
      message: 'Session activity updated',
    })
  } catch (error) {
    console.error('Error updating session activity:', error)
    return NextResponse.json(
      { error: 'Failed to update session activity' },
      { status: 500 }
    )
  }
}
