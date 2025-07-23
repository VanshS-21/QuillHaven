import { prisma } from '../prisma'
import { DatabaseService } from './database.service'
import { WebhookUserProfile, WebhookUserUpdates } from './webhook'
import { Prisma } from '../../generated/prisma'

/**
 * User service for managing user data and profiles
 * Handles user CRUD operations and webhook synchronization
 */
export class UserService {
  /**
   * Create a new user from webhook data
   * @param userProfile - User profile data from webhook
   */
  static async createUserFromWebhook(
    userProfile: WebhookUserProfile
  ): Promise<void> {
    try {
      await DatabaseService.transaction(async (tx) => {
        // Check if user already exists
        const existingUser = await tx.user.findUnique({
          where: { clerkId: userProfile.clerkId },
        })

        if (existingUser) {
          console.log(
            `User with Clerk ID ${userProfile.clerkId} already exists`
          )
          return
        }

        // Create new user record
        const user = await tx.user.create({
          data: {
            clerkId: userProfile.clerkId,
            email: userProfile.email,
            firstName: userProfile.firstName,
            lastName: userProfile.lastName,
            imageUrl: userProfile.imageUrl,
            emailVerified: userProfile.emailVerified,
            createdAt: userProfile.createdAt,
            updatedAt: userProfile.updatedAt,
            status: 'ACTIVE',
            role: 'USER',
          },
        })

        // Create default user preferences
        await tx.userPreferences.create({
          data: {
            userId: user.id,
            theme: 'system',
            language: 'en',
            timezone: 'UTC',
            emailNotifications: true,
            marketingEmails: false,
            weeklyDigest: true,
            autoSave: true,
            autoSaveInterval: 30,
          },
        })

        console.log(`Created user profile for ${userProfile.email}`)
      })
    } catch (error) {
      console.error('Error creating user from webhook:', error)
      throw error
    }
  }

  /**
   * Update user from webhook data
   * @param clerkId - Clerk user ID
   * @param updates - User update data from webhook
   */
  static async updateUserFromWebhook(
    clerkId: string,
    updates: WebhookUserUpdates
  ): Promise<void> {
    try {
      await DatabaseService.transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { clerkId },
        })

        if (!user) {
          console.log(`User with Clerk ID ${clerkId} not found for update`)
          return
        }

        // Update user record
        await tx.user.update({
          where: { clerkId },
          data: {
            email: updates.email,
            firstName: updates.firstName,
            lastName: updates.lastName,
            imageUrl: updates.imageUrl,
            emailVerified: updates.emailVerified,
            updatedAt: updates.updatedAt,
          },
        })

        console.log(`Updated user profile for Clerk ID: ${clerkId}`)
      })
    } catch (error) {
      console.error('Error updating user from webhook:', error)
      throw error
    }
  }

  /**
   * Delete user from webhook data (soft delete)
   * @param clerkId - Clerk user ID
   */
  static async deleteUserFromWebhook(clerkId: string): Promise<void> {
    try {
      await DatabaseService.transaction(async (tx) => {
        const user = await tx.user.findUnique({
          where: { clerkId },
        })

        if (!user) {
          console.log(`User with Clerk ID ${clerkId} not found for deletion`)
          return
        }

        // Soft delete user (mark as deleted instead of removing)
        await tx.user.update({
          where: { clerkId },
          data: {
            status: 'DELETED',
            email: `deleted_${Date.now()}@deleted.local`,
            firstName: 'Deleted',
            lastName: 'User',
            imageUrl: '',
            updatedAt: new Date(),
          },
        })

        // Archive user projects
        await tx.project.updateMany({
          where: { userId: user.id },
          data: {
            isArchived: true,
            updatedAt: new Date(),
          },
        })

        console.log(`Soft deleted user profile for Clerk ID: ${clerkId}`)
      })
    } catch (error) {
      console.error('Error deleting user from webhook:', error)
      throw error
    }
  }

  /**
   * Get user by Clerk ID
   * @param clerkId - Clerk user ID
   * @returns User record or null
   */
  static async getUserByClerkId(clerkId: string) {
    try {
      return await prisma.user.findUnique({
        where: { clerkId },
        include: {
          preferences: true,
          projects: {
            where: { isArchived: false },
            orderBy: { updatedAt: 'desc' },
          },
        },
      })
    } catch (error) {
      console.error('Error getting user by Clerk ID:', error)
      throw DatabaseService.handleDatabaseError(error)
    }
  }

  /**
   * Get user profile with statistics
   * @param clerkId - Clerk user ID
   * @returns User profile with statistics
   */
  static async getUserProfile(clerkId: string) {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId },
        include: {
          preferences: true,
          projects: {
            where: { isArchived: false },
            select: {
              id: true,
              title: true,
              status: true,
              currentWordCount: true,
              targetWordCount: true,
              updatedAt: true,
            },
          },
          _count: {
            select: {
              projects: {
                where: { isArchived: false },
              },
            },
          },
        },
      })

      if (!user) {
        return null
      }

      // Calculate user statistics
      const totalWords = user.projects.reduce(
        (sum, project) => sum + project.currentWordCount,
        0
      )

      const completedProjects = user.projects.filter(
        (project) => project.status === 'COMPLETED'
      ).length

      return {
        ...user,
        statistics: {
          totalProjects: user._count.projects,
          completedProjects,
          totalWords,
          averageWordsPerProject:
            user._count.projects > 0
              ? Math.round(totalWords / user._count.projects)
              : 0,
        },
      }
    } catch (error) {
      console.error('Error getting user profile:', error)
      throw DatabaseService.handleDatabaseError(error)
    }
  }
}

/**
 * Log user activity to the database
 * @param activity - Activity data to log
 */
export async function logUserActivity(activity: {
  userId: string
  activity: string
  sessionId?: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    await prisma.userActivity.create({
      data: {
        userId: activity.userId,
        activity: activity.activity,
        sessionId: activity.sessionId,
        metadata: (activity.metadata || {}) as Prisma.JsonObject,
        createdAt: new Date(),
      },
    })
  } catch (error) {
    console.error('Error logging user activity:', error)
    // Don't throw error for activity logging to avoid breaking main flow
  }
}

// Extend DatabaseService with user activity logging
type ExtendedDatabaseService = typeof DatabaseService & {
  logUserActivity: typeof logUserActivity
}
;(DatabaseService as ExtendedDatabaseService).logUserActivity = logUserActivity
