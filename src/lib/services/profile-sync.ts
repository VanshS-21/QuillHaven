import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '../prisma'
// UserRole imported but not used - removed

/**
 * Profile synchronization service for keeping Clerk and database in sync
 * Handles bidirectional synchronization of user profile data
 */
export class ProfileSyncService {
  /**
   * Synchronize user profile from Clerk to database
   * @param clerkId - Clerk user ID
   * @param options - Sync options
   * @returns Promise<SyncResult>
   */
  static async syncFromClerk(
    clerkId: string,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const startTime = Date.now()

    try {
      // Get user data from Clerk
      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(clerkId)

      if (!clerkUser) {
        throw new Error('User not found in Clerk')
      }

      // Get existing user from database
      const existingUser = await prisma.user.findUnique({
        where: { clerkId },
        include: { profile: true, preferences: true },
      })

      const changes: string[] = []
      const conflicts: string[] = []

      // Prepare user data for sync
      const userData = {
        email: clerkUser.emailAddresses[0]?.emailAddress || '',
        firstName: clerkUser.firstName || '',
        lastName: clerkUser.lastName || '',
        imageUrl: clerkUser.imageUrl || '',
        emailVerified:
          clerkUser.emailAddresses[0]?.verification?.status === 'verified',
        twoFactorEnabled: clerkUser.twoFactorEnabled || false,
        updatedAt: new Date(),
      }

      // Extract role from Clerk metadata
      const clerkRole = clerkUser.publicMetadata?.role as string
      const validRole = ['USER', 'EDITOR', 'ADMIN'].includes(clerkRole)
        ? clerkRole
        : 'USER'

      if (existingUser) {
        // Update existing user
        const updateData: Record<string, unknown> = {}

        // Check for conflicts if force sync is not enabled
        if (
          !options.force &&
          existingUser.updatedAt > new Date(clerkUser.updatedAt)
        ) {
          conflicts.push('user_data_newer_in_database')
        }

        if (existingUser.email !== userData.email) {
          updateData.email = userData.email
          changes.push('email')
        }

        if (existingUser.firstName !== userData.firstName) {
          updateData.firstName = userData.firstName
          changes.push('firstName')
        }

        if (existingUser.lastName !== userData.lastName) {
          updateData.lastName = userData.lastName
          changes.push('lastName')
        }

        if (existingUser.imageUrl !== userData.imageUrl) {
          updateData.imageUrl = userData.imageUrl
          changes.push('imageUrl')
        }

        if (existingUser.emailVerified !== userData.emailVerified) {
          updateData.emailVerified = userData.emailVerified
          changes.push('emailVerified')
        }

        if (existingUser.twoFactorEnabled !== userData.twoFactorEnabled) {
          updateData.twoFactorEnabled = userData.twoFactorEnabled
          changes.push('twoFactorEnabled')
        }

        if (existingUser.role !== validRole) {
          updateData.role = validRole
          changes.push('role')
        }

        if (
          Object.keys(updateData).length > 0 &&
          (options.force || conflicts.length === 0)
        ) {
          updateData.updatedAt = new Date()

          await prisma.user.update({
            where: { clerkId },
            data: updateData,
          })
        }

        // Sync profile data
        const profileChanges = await this.syncProfileData(
          clerkId,
          clerkUser as unknown as Record<string, unknown>,
          options
        )
        changes.push(...profileChanges)
      } else {
        // Create new user
        const newUser = await prisma.user.create({
          data: {
            clerkId,
            ...userData,
            role: validRole as 'USER' | 'EDITOR' | 'ADMIN',
            status: 'ACTIVE',
          },
        })

        // Create default preferences
        await prisma.userPreferences.create({
          data: {
            userId: newUser.id,
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

        // Create default profile
        await prisma.userProfile.create({
          data: {
            userId: newUser.id,
            bio: null,
            location: null,
            website: null,
            writingGenres: [],
            experienceLevel: null,
            socialLinks: [],
            goals: [],
            preferences: {},
          },
        })

        changes.push('user_created', 'preferences_created', 'profile_created')
      }

      const duration = Date.now() - startTime

      // Log sync activity
      await this.logSyncActivity({
        userId: clerkId,
        direction: 'from_clerk',
        changes,
        success: true,
        conflicts,
        duration,
      })

      return {
        success: true,
        changes,
        conflicts,
        message: `Synchronized ${changes.length} changes from Clerk`,
        duration,
      }
    } catch (error) {
      const duration = Date.now() - startTime
      console.error('Error syncing from Clerk:', error)

      await this.logSyncActivity({
        userId: clerkId,
        direction: 'from_clerk',
        changes: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      })

      return {
        success: false,
        changes: [],
        conflicts: [],
        message: 'Failed to sync from Clerk',
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
      }
    }
  }

  /**
   * Synchronize user profile from database to Clerk
   * @param clerkId - Clerk user ID
   * @returns Promise<SyncResult>
   */
  static async syncToClerk(clerkId: string): Promise<SyncResult> {
    try {
      // Get user data from database
      const dbUser = await prisma.user.findUnique({
        where: { clerkId },
        include: { profile: true, preferences: true },
      })

      if (!dbUser) {
        throw new Error('User not found in database')
      }

      // Get current Clerk user data
      const clerk = await clerkClient()
      const clerkUser = await clerk.users.getUser(clerkId)

      if (!clerkUser) {
        throw new Error('User not found in Clerk')
      }

      const changes: string[] = []
      const updates: Record<string, unknown> = {}

      // Sync basic profile data
      if (clerkUser.firstName !== dbUser.firstName) {
        updates.firstName = dbUser.firstName
        changes.push('firstName')
      }

      if (clerkUser.lastName !== dbUser.lastName) {
        updates.lastName = dbUser.lastName
        changes.push('lastName')
      }

      // Update Clerk user if there are changes
      if (Object.keys(updates).length > 0) {
        await clerk.users.updateUser(clerkId, updates)
      }

      // Sync metadata
      const metadata = {
        role: dbUser.role,
        preferences: dbUser.preferences
          ? {
              theme: dbUser.preferences.theme,
              language: dbUser.preferences.language,
              timezone: dbUser.preferences.timezone,
            }
          : {},
        profile: dbUser.profile
          ? {
              bio: dbUser.profile.bio,
              location: dbUser.profile.location,
              website: dbUser.profile.website,
              writingGenres: dbUser.profile.writingGenres,
              experienceLevel: dbUser.profile.experienceLevel,
            }
          : {},
      }

      await clerk.users.updateUserMetadata(clerkId, {
        publicMetadata: {
          role: dbUser.role,
        },
        privateMetadata: metadata,
      })

      changes.push('metadata')

      // Log sync activity
      await this.logSyncActivity({
        userId: clerkId,
        direction: 'to_clerk',
        changes,
        success: true,
      })

      return {
        success: true,
        changes,
        message: `Synchronized ${changes.length} changes to Clerk`,
      }
    } catch (error) {
      console.error('Error syncing to Clerk:', error)

      await this.logSyncActivity({
        userId: clerkId,
        direction: 'to_clerk',
        changes: [],
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      return {
        success: false,
        changes: [],
        message: 'Failed to sync to Clerk',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Perform bidirectional sync
   * @param clerkId - Clerk user ID
   * @returns Promise<BidirectionalSyncResult>
   */
  static async bidirectionalSync(
    clerkId: string
  ): Promise<BidirectionalSyncResult> {
    try {
      const [fromClerkResult, toClerkResult] = await Promise.all([
        this.syncFromClerk(clerkId),
        this.syncToClerk(clerkId),
      ])

      return {
        success: fromClerkResult.success && toClerkResult.success,
        fromClerk: fromClerkResult,
        toClerk: toClerkResult,
        totalChanges:
          fromClerkResult.changes.length + toClerkResult.changes.length,
      }
    } catch (error) {
      console.error('Error in bidirectional sync:', error)
      return {
        success: false,
        fromClerk: { success: false, changes: [], message: 'Sync failed' },
        toClerk: { success: false, changes: [], message: 'Sync failed' },
        totalChanges: 0,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Sync profile-specific data
   * @param clerkId - Clerk user ID
   * @param clerkUser - Clerk user object
   * @param options - Sync options
   * @returns Promise<string[]> - Array of changes made
   */
  private static async syncProfileData(
    clerkId: string,
    clerkUser: Record<string, unknown>,
    options: SyncOptions = {}
  ): Promise<string[]> {
    const changes: string[] = []

    try {
      const user = await prisma.user.findUnique({
        where: { clerkId },
        include: { profile: true, preferences: true },
      })

      if (!user) return changes

      // Extract profile data from Clerk metadata
      const privateMetadata =
        (clerkUser.privateMetadata as Record<string, unknown>) || {}
      const profileData =
        (privateMetadata.profile as Record<string, unknown>) || {}

      // Check if profile data has changed
      const existingProfile = user.profile
      let profileChanged = false

      if (!existingProfile) {
        profileChanged = true
        changes.push('profile_created')
      } else {
        // Check for profile changes
        if (existingProfile.bio !== (profileData.bio || null)) {
          profileChanged = true
          changes.push('profile_bio')
        }
        if (existingProfile.location !== (profileData.location || null)) {
          profileChanged = true
          changes.push('profile_location')
        }
        if (existingProfile.website !== (profileData.website || null)) {
          profileChanged = true
          changes.push('profile_website')
        }
        if (
          JSON.stringify(existingProfile.writingGenres) !==
          JSON.stringify(profileData.writingGenres || [])
        ) {
          profileChanged = true
          changes.push('profile_writing_genres')
        }
        if (
          existingProfile.experienceLevel !==
          (profileData.experienceLevel || null)
        ) {
          profileChanged = true
          changes.push('profile_experience_level')
        }
      }

      // Update profile if changed
      if (profileChanged && (options.force || !options.skipConflicts)) {
        await prisma.userProfile.upsert({
          where: { userId: user.id },
          create: {
            userId: user.id,
            bio: (profileData.bio as string) || null,
            location: (profileData.location as string) || null,
            website: (profileData.website as string) || null,
            writingGenres: (profileData.writingGenres as string[]) || [],
            experienceLevel: (profileData.experienceLevel as string) || null,
            socialLinks: profileData.socialLinks || [],
            goals: profileData.goals || [],
            preferences: profileData.preferences || {},
          },
          update: {
            bio: (profileData.bio as string) || null,
            location: (profileData.location as string) || null,
            website: (profileData.website as string) || null,
            writingGenres: (profileData.writingGenres as string[]) || [],
            experienceLevel: (profileData.experienceLevel as string) || null,
            socialLinks: profileData.socialLinks || [],
            goals: profileData.goals || [],
            preferences: profileData.preferences || {},
            updatedAt: new Date(),
          },
        })
      }

      // Sync preferences if available
      const preferencesData =
        (privateMetadata.preferences as Record<string, unknown>) || {}

      if (Object.keys(preferencesData).length > 0) {
        const existingPreferences = user.preferences
        let preferencesChanged = false

        if (!existingPreferences) {
          preferencesChanged = true
          changes.push('preferences_created')
        } else {
          // Check for preference changes
          if (
            existingPreferences.theme !== (preferencesData.theme || 'system')
          ) {
            preferencesChanged = true
            changes.push('preferences_theme')
          }
          if (
            existingPreferences.language !== (preferencesData.language || 'en')
          ) {
            preferencesChanged = true
            changes.push('preferences_language')
          }
          if (
            existingPreferences.timezone !== (preferencesData.timezone || 'UTC')
          ) {
            preferencesChanged = true
            changes.push('preferences_timezone')
          }
        }

        if (preferencesChanged && (options.force || !options.skipConflicts)) {
          await prisma.userPreferences.upsert({
            where: { userId: user.id },
            create: {
              userId: user.id,
              theme: (preferencesData.theme as string) || 'system',
              language: (preferencesData.language as string) || 'en',
              timezone: (preferencesData.timezone as string) || 'UTC',
              emailNotifications:
                (preferencesData.emailNotifications as boolean) ?? true,
              marketingEmails:
                (preferencesData.marketingEmails as boolean) ?? false,
              weeklyDigest: (preferencesData.weeklyDigest as boolean) ?? true,
              autoSave: (preferencesData.autoSave as boolean) ?? true,
              autoSaveInterval:
                (preferencesData.autoSaveInterval as number) || 30,
            },
            update: {
              theme: (preferencesData.theme as string) || 'system',
              language: (preferencesData.language as string) || 'en',
              timezone: (preferencesData.timezone as string) || 'UTC',
              emailNotifications:
                (preferencesData.emailNotifications as boolean) ?? true,
              marketingEmails:
                (preferencesData.marketingEmails as boolean) ?? false,
              weeklyDigest: (preferencesData.weeklyDigest as boolean) ?? true,
              autoSave: (preferencesData.autoSave as boolean) ?? true,
              autoSaveInterval:
                (preferencesData.autoSaveInterval as number) || 30,
              updatedAt: new Date(),
            },
          })
        }
      }

      return changes
    } catch (error) {
      console.error('Error syncing profile data:', error)
      return changes
    }
  }

  /**
   * Bulk sync multiple users
   * @param clerkIds - Array of Clerk user IDs
   * @returns Promise<BulkSyncResult>
   */
  static async bulkSync(clerkIds: string[]): Promise<BulkSyncResult> {
    const results: SyncResult[] = []
    let successCount = 0
    let errorCount = 0

    for (const clerkId of clerkIds) {
      try {
        const result = await this.syncFromClerk(clerkId)
        results.push(result)

        if (result.success) {
          successCount++
        } else {
          errorCount++
        }
      } catch (error) {
        errorCount++
        results.push({
          success: false,
          changes: [],
          message: 'Sync failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      }
    }

    return {
      totalUsers: clerkIds.length,
      successCount,
      errorCount,
      results,
    }
  }

  /**
   * Log synchronization activity
   * @param activity - Sync activity data
   */
  private static async logSyncActivity(activity: SyncActivity): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId: activity.userId,
          activity: `profile_sync_${activity.direction}`,
          metadata: {
            changes: activity.changes,
            success: activity.success,
            error: activity.error,
            conflicts: activity.conflicts,
            duration: activity.duration,
            timestamp: new Date(),
          },
          createdAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error logging sync activity:', error)
    }
  }

  /**
   * Get sync history for a user
   * @param clerkId - Clerk user ID
   * @param limit - Number of records to retrieve
   * @returns Promise<SyncHistory[]>
   */
  static async getSyncHistory(
    clerkId: string,
    limit = 20
  ): Promise<SyncHistory[]> {
    try {
      const activities = await prisma.userActivity.findMany({
        where: {
          userId: clerkId,
          activity: {
            startsWith: 'profile_sync_',
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return activities.map((activity) => ({
        direction: activity.activity.replace('profile_sync_', '') as
          | 'from_clerk'
          | 'to_clerk',
        changes:
          ((activity.metadata as Record<string, unknown>)
            ?.changes as string[]) || [],
        success:
          ((activity.metadata as Record<string, unknown>)
            ?.success as boolean) || false,
        error: (activity.metadata as Record<string, unknown>)?.error as string,
        timestamp: activity.createdAt,
      }))
    } catch (error) {
      console.error('Error getting sync history:', error)
      return []
    }
  }
}

/**
 * Type definitions for profile sync service
 */
export interface SyncOptions {
  force?: boolean
  skipConflicts?: boolean
  syncProfile?: boolean
  syncPreferences?: boolean
}

export interface SyncResult {
  success: boolean
  changes: string[]
  conflicts?: string[]
  message: string
  error?: string
  duration?: number
}

export interface BidirectionalSyncResult {
  success: boolean
  fromClerk: SyncResult
  toClerk: SyncResult
  totalChanges: number
  error?: string
}

export interface BulkSyncResult {
  totalUsers: number
  successCount: number
  errorCount: number
  results: SyncResult[]
}

export interface SyncActivity {
  userId: string
  direction: 'from_clerk' | 'to_clerk'
  changes: string[]
  success: boolean
  error?: string
  conflicts?: string[]
  duration?: number
}

export interface SyncHistory {
  direction: 'from_clerk' | 'to_clerk'
  changes: string[]
  success: boolean
  error?: string
  timestamp: Date
}
