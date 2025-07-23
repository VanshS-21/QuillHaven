/**
 * Type definitions for Clerk webhook events
 * These types provide better type safety for webhook data processing
 */

export interface ClerkUserData {
  id: string
  email_addresses?: Array<{
    email_address: string
    verification?: {
      status: string
    }
  }>
  first_name?: string
  last_name?: string
  image_url?: string
  profile_image_url?: string
  created_at?: number
  updated_at?: number
}

export interface ClerkSessionData {
  id: string
  user_id: string
  created_at?: number
  last_active_at?: number
}

export interface ClerkDeletedData {
  id: string
}

export interface WebhookEventData {
  user?: ClerkUserData
  session?: ClerkSessionData
  deleted?: ClerkDeletedData
  [key: string]: unknown
}

export type WebhookEventType =
  | 'user.created'
  | 'user.updated'
  | 'user.deleted'
  | 'session.created'
  | 'session.ended'
  | 'session.removed'
  | 'session.revoked'

export interface TypedWebhookEvent {
  type: WebhookEventType
  data: WebhookEventData
  object: string
  timestamp: number
  instance_id: string
}
