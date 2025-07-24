import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SecurityService } from '@/lib/services/security'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@/generated/prisma'

/**
 * GET /api/auth/roles
 * Get user roles and permissions
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

    // Get user's role and permissions
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      select: {
        id: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Define role permissions
    const permissions = getRolePermissions(user.role)

    return NextResponse.json({
      role: user.role,
      permissions,
      status: user.status,
      canManageUsers: user.role === 'ADMIN',
      canEditContent: ['ADMIN', 'EDITOR'].includes(user.role),
      canViewAnalytics: ['ADMIN', 'EDITOR'].includes(user.role),
    })
  } catch (error) {
    console.error('Error getting user roles:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve user roles' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/roles
 * Update user role (admin only)
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

    // Check if user has admin role
    await SecurityService.requireRole(userId, 'ADMIN')

    const body = await req.json()
    const { targetUserId, newRole } = body

    if (!targetUserId || !newRole) {
      return NextResponse.json(
        { error: 'targetUserId and newRole are required' },
        { status: 400 }
      )
    }

    if (!['USER', 'EDITOR', 'ADMIN'].includes(newRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Prevent self-demotion from admin
    if (userId === targetUserId && newRole !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Cannot change your own admin role' },
        { status: 400 }
      )
    }

    // Update user role
    await SecurityService.updateUserRole(
      targetUserId,
      newRole as UserRole,
      userId
    )

    return NextResponse.json({
      success: true,
      message: `User role updated to ${newRole}`,
      targetUserId,
      newRole,
    })
  } catch (error) {
    console.error('Error updating user role:', error)

    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to update user role' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/roles/users
 * Get all users with their roles (admin only)
 */
export async function GET_USERS(req: NextRequest) {
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

    const { searchParams } = new URL(req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const role = searchParams.get('role')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    // Build where clause
    const where: Record<string, unknown> = {}
    if (role && ['USER', 'EDITOR', 'ADMIN'].includes(role)) {
      where.role = role
    }
    if (status && ['ACTIVE', 'SUSPENDED', 'DELETED'].includes(status)) {
      where.status = status
    }

    // Get users with pagination
    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          clerkId: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          twoFactorEnabled: true,
          _count: {
            select: {
              projects: true,
              sessions: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error getting users:', error)

    if (error instanceof Error && error.message.includes('Access denied')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to retrieve users' },
      { status: 500 }
    )
  }
}

/**
 * Helper function to get role permissions
 */
function getRolePermissions(role: UserRole): string[] {
  const permissions: Record<UserRole, string[]> = {
    USER: [
      'read_own_profile',
      'update_own_profile',
      'create_projects',
      'read_own_projects',
      'update_own_projects',
      'delete_own_projects',
    ],
    EDITOR: [
      'read_own_profile',
      'update_own_profile',
      'create_projects',
      'read_own_projects',
      'update_own_projects',
      'delete_own_projects',
      'read_all_projects',
      'moderate_content',
      'view_analytics',
    ],
    ADMIN: [
      'read_own_profile',
      'update_own_profile',
      'create_projects',
      'read_own_projects',
      'update_own_projects',
      'delete_own_projects',
      'read_all_projects',
      'moderate_content',
      'view_analytics',
      'manage_users',
      'manage_roles',
      'view_system_logs',
      'manage_system_settings',
    ],
  }

  return permissions[role] || permissions.USER
}
