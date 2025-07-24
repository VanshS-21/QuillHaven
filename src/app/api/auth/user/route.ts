import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

/**
 * GET /api/auth/user
 * Get current user information
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

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { clerkId: userId },
      include: {
        profile: true,
        preferences: true,
        subscription: {
          include: {
            plan: true,
            usageMetrics: true,
          },
        },
        _count: {
          select: {
            projects: true,
            sessions: {
              where: {
                isActive: true,
                expiresAt: {
                  gt: new Date(),
                },
              },
            },
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Return user data without sensitive information
    const userData = {
      id: user.id,
      clerkId: user.clerkId,
      email: user.email,
      emailVerified: user.emailVerified,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatar: user.avatar,
      imageUrl: user.imageUrl,
      role: user.role,
      status: user.status,
      twoFactorEnabled: user.twoFactorEnabled,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      lastLoginAt: user.lastLoginAt,
      profile: user.profile,
      preferences: user.preferences,
      subscription: user.subscription,
      stats: {
        projectCount: user._count.projects,
        activeSessionCount: user._count.sessions,
      },
    }

    return NextResponse.json(userData)
  } catch (error) {
    console.error('Error getting user information:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve user information' },
      { status: 500 }
    )
  }
}

/**
 * PUT /api/auth/user
 * Update user information
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

    const body = await req.json()
    const { firstName, lastName, displayName } = body

    // Update user in database
    const updatedUser = await prisma.user.update({
      where: { clerkId: userId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(displayName !== undefined && { displayName }),
        updatedAt: new Date(),
      },
      include: {
        profile: true,
        preferences: true,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User information updated successfully',
      user: {
        id: updatedUser.id,
        clerkId: updatedUser.clerkId,
        email: updatedUser.email,
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        displayName: updatedUser.displayName,
        role: updatedUser.role,
        status: updatedUser.status,
        twoFactorEnabled: updatedUser.twoFactorEnabled,
        updatedAt: updatedUser.updatedAt,
        profile: updatedUser.profile,
        preferences: updatedUser.preferences,
      },
    })
  } catch (error) {
    console.error('Error updating user information:', error)
    return NextResponse.json(
      { error: 'Failed to update user information' },
      { status: 500 }
    )
  }
}
