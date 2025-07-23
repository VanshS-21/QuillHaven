import { createClerkClient } from '@clerk/nextjs/server'

const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
})
import { UserService } from './user'
import { DatabaseService } from './database.service'

type ExtendedDatabaseService = typeof DatabaseService & {
  logUserActivity: (activity: {
    userId: string
    activity: string
    sessionId?: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
}

/**
 * Custom authentication flows service
 * Handles specialized authentication logic and user onboarding
 */
export class CustomAuthService {
  /**
   * Handle post-authentication user setup
   * Called after successful authentication to ensure user data is properly initialized
   * @param clerkUserId - Clerk user ID
   */
  static async handlePostAuthSetup(clerkUserId: string): Promise<void> {
    try {
      // Get user from Clerk
      const clerkUser = await clerkClient.users.getUser(clerkUserId)

      // Check if user exists in our database
      const existingUser = await UserService.getUserByClerkId(clerkUserId)

      if (!existingUser) {
        // Create user profile if it doesn't exist
        const userProfile = {
          clerkId: clerkUserId,
          email: clerkUser.emailAddresses?.[0]?.emailAddress || '',
          firstName: clerkUser.firstName || '',
          lastName: clerkUser.lastName || '',
          imageUrl: clerkUser.imageUrl || '',
          emailVerified:
            clerkUser.emailAddresses?.[0]?.verification?.status === 'verified',
          createdAt: new Date(clerkUser.createdAt),
          updatedAt: new Date(clerkUser.updatedAt),
        }

        await UserService.createUserFromWebhook(userProfile)
        console.log(
          `Created user profile during post-auth setup for: ${clerkUserId}`
        )
      }

      // Update last login time
      await this.updateLastLogin(clerkUserId)

      // Log authentication event
      await (DatabaseService as ExtendedDatabaseService).logUserActivity({
        userId: clerkUserId,
        activity: 'user_authenticated',
        metadata: {
          timestamp: new Date().toISOString(),
          method: 'clerk_auth',
        },
      })
    } catch (error) {
      console.error('Error in post-auth setup:', error)
      // Don't throw error to avoid breaking authentication flow
    }
  }

  /**
   * Handle user onboarding flow
   * Sets up initial user preferences and creates welcome content
   * @param clerkUserId - Clerk user ID
   */
  static async handleUserOnboarding(clerkUserId: string): Promise<void> {
    try {
      const user = await UserService.getUserByClerkId(clerkUserId)

      if (!user) {
        console.error(`User not found for onboarding: ${clerkUserId}`)
        return
      }

      // Check if user has already been onboarded
      const hasProjects = user.projects && user.projects.length > 0
      if (hasProjects) {
        console.log(
          `User ${clerkUserId} already has projects, skipping onboarding`
        )
        return
      }

      // Create welcome project (optional)
      await this.createWelcomeProject(user.id)

      // Log onboarding completion
      await (DatabaseService as ExtendedDatabaseService).logUserActivity({
        userId: clerkUserId,
        activity: 'user_onboarded',
        metadata: {
          timestamp: new Date().toISOString(),
          onboardingVersion: '1.0',
        },
      })

      console.log(`Completed onboarding for user: ${clerkUserId}`)
    } catch (error) {
      console.error('Error in user onboarding:', error)
    }
  }

  /**
   * Handle OAuth provider connection
   * Processes additional data from OAuth providers
   * @param clerkUserId - Clerk user ID
   * @param provider - OAuth provider name
   * @param providerData - Additional data from OAuth provider
   */
  static async handleOAuthConnection(
    clerkUserId: string,
    provider: string,
    providerData?: Record<string, unknown>
  ): Promise<void> {
    try {
      // Log OAuth connection
      await (DatabaseService as ExtendedDatabaseService).logUserActivity({
        userId: clerkUserId,
        activity: 'oauth_connected',
        metadata: {
          provider,
          timestamp: new Date().toISOString(),
          additionalData: providerData || {},
        },
      })

      // Handle provider-specific logic
      switch (provider) {
        case 'google':
          await this.handleGoogleConnection(clerkUserId, providerData)
          break
        case 'github':
          await this.handleGitHubConnection(clerkUserId, providerData)
          break
        case 'discord':
          await this.handleDiscordConnection(clerkUserId, providerData)
          break
        default:
          console.log(`No specific handler for OAuth provider: ${provider}`)
      }
    } catch (error) {
      console.error(`Error handling OAuth connection for ${provider}:`, error)
    }
  }

  /**
   * Handle account linking
   * Merges data when user connects additional OAuth providers
   * @param clerkUserId - Clerk user ID
   * @param newProviderData - Data from newly connected provider
   */
  static async handleAccountLinking(
    clerkUserId: string,
    newProviderData: Record<string, unknown>
  ): Promise<void> {
    try {
      // Log account linking
      await (DatabaseService as ExtendedDatabaseService).logUserActivity({
        userId: clerkUserId,
        activity: 'account_linked',
        metadata: {
          timestamp: new Date().toISOString(),
          providerData: newProviderData,
        },
      })

      console.log(`Account linked for user: ${clerkUserId}`)
    } catch (error) {
      console.error('Error handling account linking:', error)
    }
  }

  /**
   * Update user's last login timestamp
   * @param clerkUserId - Clerk user ID
   */
  private static async updateLastLogin(clerkUserId: string): Promise<void> {
    try {
      await DatabaseService.transaction(async (tx) => {
        await tx.user.update({
          where: { clerkId: clerkUserId },
          data: { lastLoginAt: new Date() },
        })
      })
    } catch (error) {
      console.error('Error updating last login:', error)
    }
  }

  /**
   * Create a welcome project for new users
   * @param userId - Internal user ID
   */
  private static async createWelcomeProject(userId: string): Promise<void> {
    try {
      await DatabaseService.transaction(async (tx) => {
        const project = await tx.project.create({
          data: {
            userId,
            title: 'Welcome to QuillHaven',
            description:
              'Your first project to get started with AI-powered writing',
            genre: 'Tutorial',
            targetWordCount: 1000,
            currentWordCount: 0,
            status: 'DRAFT',
            visibility: 'PRIVATE',
            tags: ['welcome', 'tutorial'],
            settings: {
              autoSave: true,
              aiAssistance: true,
              spellCheck: true,
              grammarCheck: true,
            },
          },
        })

        // Create project statistics
        await tx.projectStatistics.create({
          data: {
            projectId: project.id,
            totalWords: 0,
            totalChapters: 0,
            completedChapters: 0,
            averageWordsPerChapter: 0,
            writingStreak: 0,
            totalWritingTime: 0,
            sessionsCount: 0,
            progressPercentage: 0,
            dailyWordCounts: [],
          },
        })
      })
    } catch (error) {
      console.error('Error creating welcome project:', error)
    }
  }

  /**
   * Handle Google OAuth connection
   * @param clerkUserId - Clerk user ID
   * @param providerData - Google OAuth data
   */
  private static async handleGoogleConnection(
    clerkUserId: string,
    _providerData?: Record<string, unknown>
  ): Promise<void> {
    // Handle Google-specific data if needed
    console.log(`Google OAuth connected for user: ${clerkUserId}`)
  }

  /**
   * Handle GitHub OAuth connection
   * @param clerkUserId - Clerk user ID
   * @param providerData - GitHub OAuth data
   */
  private static async handleGitHubConnection(
    clerkUserId: string,
    _providerData?: Record<string, unknown>
  ): Promise<void> {
    // Handle GitHub-specific data if needed
    console.log(`GitHub OAuth connected for user: ${clerkUserId}`)
  }

  /**
   * Handle Discord OAuth connection
   * @param clerkUserId - Clerk user ID
   * @param providerData - Discord OAuth data
   */
  private static async handleDiscordConnection(
    clerkUserId: string,
    _providerData?: Record<string, unknown>
  ): Promise<void> {
    // Handle Discord-specific data if needed
    console.log(`Discord OAuth connected for user: ${clerkUserId}`)
  }
}
