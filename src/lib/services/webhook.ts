import { WebhookEvent } from '@clerk/nextjs/server'
import { UserService } from './user'
import { DatabaseService } from './database.service'
import { ClerkUserData, ClerkSessionData } from '../types/webhook'

type ExtendedDatabaseService = typeof DatabaseService & {
  logUserActivity: (activity: {
    userId: string
    activity: string
    sessionId?: string
    metadata?: Record<string, unknown>
  }) => Promise<void>
}

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
   * Logs session creation for analytics
   */
  private static async handleSessionCreated(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // Log session creation
    await (DatabaseService as ExtendedDatabaseService).logUserActivity({
      userId: sessionData.user_id || '',
      activity: 'session_created',
      sessionId: sessionData.id || '',
      metadata: {
        lastActiveAt: new Date(sessionData.last_active_at || Date.now()),
        createdAt: new Date(sessionData.created_at || Date.now()),
      },
    })

    console.log(`Session created for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.ended webhook event
   * Logs session end for analytics
   */
  private static async handleSessionEnded(event: WebhookEvent): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // Log session end
    await (DatabaseService as ExtendedDatabaseService).logUserActivity({
      userId: sessionData.user_id || '',
      activity: 'session_ended',
      sessionId: sessionData.id || '',
      metadata: {
        endedAt: new Date(),
        duration:
          (sessionData.last_active_at || 0) - (sessionData.created_at || 0),
      },
    })

    console.log(`Session ended for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.removed webhook event
   * Logs session removal for security tracking
   */
  private static async handleSessionRemoved(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // Log session removal
    await (DatabaseService as ExtendedDatabaseService).logUserActivity({
      userId: sessionData.user_id || '',
      activity: 'session_removed',
      sessionId: sessionData.id || '',
      metadata: {
        removedAt: new Date(),
        reason: 'manual_removal',
      },
    })

    console.log(`Session removed for user: ${sessionData.user_id}`)
  }

  /**
   * Handle session.revoked webhook event
   * Logs session revocation for security tracking
   */
  private static async handleSessionRevoked(
    event: WebhookEvent
  ): Promise<void> {
    const sessionData = event.data as ClerkSessionData

    // Log session revocation
    await (DatabaseService as ExtendedDatabaseService).logUserActivity({
      userId: sessionData.user_id || '',
      activity: 'session_revoked',
      sessionId: sessionData.id || '',
      metadata: {
        revokedAt: new Date(),
        reason: 'security_revocation',
      },
    })

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
