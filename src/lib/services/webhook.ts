import { WebhookEvent } from '@clerk/nextjs/server'
import { UserService } from './user'
import { SessionService } from './session'
import { ProfileSyncService } from './profile-sync'
import { ClerkUserData, ClerkSessionData } from '../types/webhook'

// ExtendedDatabaseService type removed as it's not used

/**
 * Webhook service for processing Clerk webhook events
 * Handles user lifecycle events and synchronizes data
 */
export class WebhookService {
  /**
   * Process incoming webhook events from Clerk
   * @param event - The verified webhook event
   */
  static async processWebhookEvent(event: WebhookEvent): Promise<void> {
    const { type, data } = event

    try {
      switch (type) {
        case 'user.created':
          await this.handleUserCreated(event)
          break

        case 'user.updated':
          await this.handleUserUpdated(event)
          break

        case 'user.deleted':
          await this.handleUserDeleted(event)
          break

        case 'session.created':
          await this.handleSessionCreated(event)
          break

        case 'session.ended':
          await this.handleSessionEnded(event)
          break

        case 'session.removed':
          await this.handleSessionRemoved(event)
          break

        case 'session.revoked':
          await this.handleSessionRevoked(event)
          break

        default:
          console.log(`Unhandled webhook event type: ${type}`)
          break
      }

      // Log successful processing
      console.log(
        `Successfully processed webhook event: ${type} for ${data.id}`
      )
    } catch (error) {
      console.error(`Error processing webhook event ${type}:`, error)
      throw error
    }
  }

  /**
   * Handle user.created webhook event
   * Creates a new user record in the database
   */
  private static async handleUserCreated(event: WebhookEvent): Promise<void> {
    const userData = event.data as ClerkUserData

    // Extract user information from Clerk webhook payload
    const userProfile = {
      clerkId: userData.id || '',
      email: userData.email_addresses?.[0]?.email_address || '',
      firstName: userData.first_name || '',
      lastName: userData.last_name || '',
      imageUrl: userData.image_url || userData.profile_image_url || '',
      emailVerified:
        userData.email_addresses?.[0]?.verification?.status === 'verified',
      createdAt: new Date(userData.created_at || Date.now()),
      updatedAt: new Date(userData.updated_at || Date.now()),
    }

    // Create user in database
    await UserService.createUserFromWebhook(userProfile)

    console.log(`Created user profile for Clerk ID: ${userData.id}`)
  }

  /**
   * Handle user.updated webhook event
   * Updates existing user record in the database
   */
  private static async handleUserUpdated(event: WebhookEvent): Promise<void> {
    const userData = event.data as ClerkUserData

    // Extract updated user information
    const userUpdates = {
      email: userData.email_addresses?.[0]?.email_address || '',
      firstName: userData.first_name || '',
      lastName: userData.last_name || '',
      imageUrl: userData.image_url || userData.profile_image_url || '',
      emailVerified:
        userData.email_addresses?.[0]?.verification?.status === 'verified',
      updatedAt: new Date(userData.updated_at || Date.now()),
    }

    // Update user in database
    await UserService.updateUserFromWebhook(userData.id || '', userUpdates)

    console.log(`Updated user profile for Clerk ID: ${userData.id}`)
  }

  /**
   * Handle user.deleted webhook event
   * Soft deletes or anonymizes user data
   */
  private static async handleUserDeleted(event: WebhookEvent): Promise<void> {
    const userData = event.data as { id: string }

    // Soft delete user and associated data
    await UserService.deleteUserFromWebhook(userData.id || '')

    console.log(`Deleted user profile for Clerk ID: ${userData.id}`)
  }

  /**
   * Handle session.created webhook event
   * Creates session record and performs security checks
   */
  private static async handleSessionCreated(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // Create session with security tracking
    await SessionService.createSession(
      sessionData.user_id || '',
      sessionData.id || '',
      {
        expiresAt: new Date(
          sessionData.last_active_at || Date.now() + 24 * 60 * 60 * 1000
        ),
        ipAddress: 'unknown', // IP not available in webhook data
        userAgent: 'unknown', // User agent not available in webhook data
      }
    )

    // Trigger profile sync
    await ProfileSyncService.syncFromClerk(sessionData.user_id || '')

    console.log(`Session created for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.ended webhook event
   * Ends session and logs activity
   */
  private static async handleSessionEnded(event: WebhookEvent): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // End session with proper tracking
    await SessionService.endSession(sessionData.id || '', 'user_logout')

    console.log(`Session ended for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.removed webhook event
   * Ends session and logs removal for security tracking
   */
  private static async handleSessionRemoved(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // End session with removal reason
    await SessionService.endSession(sessionData.id || '', 'manual_removal')

    console.log(`Session removed for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.revoked webhook event
   * Ends session and logs revocation for security tracking
   */
  private static async handleSessionRevoked(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // End session with revocation reason
    await SessionService.endSession(sessionData.id || '', 'security_revocation')

    console.log(`Session revoked for user: ${sessionData.user_id}`)
  }
}

/**
 * Type definitions for webhook processing
 */
export interface WebhookUserProfile {
  clerkId: string
  email: string
  firstName: string
  lastName: string
  imageUrl: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}

export interface WebhookUserUpdates {
  email: string
  firstName: string
  lastName: string
  imageUrl: string
  emailVerified: boolean
  updatedAt: Date
}

export interface UserActivity {
  userId: string
  activity: string
  sessionId?: string
  metadata?: Record<string, unknown>
}
