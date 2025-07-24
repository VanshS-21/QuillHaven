import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { ProfileSyncService } from '@/lib/services/profile-sync'
import { SecurityService } from '@/lib/services/security'

/**
 * GET /api/auth/profile-sync
 * Get profile synchronization status and history
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get sync history
    const syncHistory = await ProfileSyncService.getSyncHistory(userId, 20)

    return NextResponse.json({
      syncHistory,
      lastSync: syncHistory[0]?.timestamp || null,
      totalSyncs: syncHistory.length,
    })
  } catch (error) {
    console.error('Error getting profile sync status:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve sync status' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/profile-sync
 * Trigger profile synchronization
 */
export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { direction = 'bidirectional' } = body

    let result

    switch (direction) {
      case 'from_clerk':
        result = await ProfileSyncService.syncFromClerk(userId)
        break

      case 'to_clerk':
        result = await ProfileSyncService.syncToClerk(userId)
        break

      case 'bidirectional':
      default:
        result = await ProfileSyncService.bidirectionalSync(userId)
        break
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing profile:', error)
    return NextResponse.json(
      { error: 'Failed to sync profile' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/auth/profile-sync
 * Admin endpoint for bulk profile synchronization
 */
export async function PUT(req: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Check if user has admin role
    await SecurityService.requireRole(userId, 'ADMIN')

    const body = await req.json()
    const { userIds } = body

    if (!Array.isArray(userIds)) {
      return NextResponse.json(
        { error: 'userIds must be an array' },
        { status: 400 }
      )
    }

    const result = await ProfileSyncService.bulkSync(userIds)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in bulk profile sync:', error)

    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to perform bulk sync' },
      { status: 500 }
    )
  }
}
