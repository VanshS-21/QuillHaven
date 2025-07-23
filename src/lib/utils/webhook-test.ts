/**
 * Webhook testing utilities
 * Provides helper functions for testing webhook functionality
 */

import { WebhookEvent } from '@clerk/nextjs/server'

/**
 * Create a mock webhook event for testing
 * @param type - The webhook event type
 * @param data - The event data
 * @returns Mock webhook event
 */
export function createMockWebhookEvent(
  type: string,
  data: Record<string, unknown>
): WebhookEvent {
  return {
    type,
    data,
    object: 'event',
    timestamp: Date.now(),
    instance_id: 'ins_test_123',
    event_attributes: {},
  } as unknown as WebhookEvent
}

/**
 * Create a mock user.created webhook event
 * @param overrides - Optional data overrides
 * @returns Mock user.created webhook event
 */
export function createMockUserCreatedEvent(
  overrides: Partial<Record<string, unknown>> = {}
): WebhookEvent {
  const defaultData = {
    id: 'user_test_123',
    email_addresses: [
      {
        email_address: 'test@example.com',
        verification: { status: 'verified' },
      },
    ],
    first_name: 'Test',
    last_name: 'User',
    image_url: 'https://example.com/avatar.jpg',
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  }

  return createMockWebhookEvent('user.created', defaultData)
}

/**
 * Create a mock user.updated webhook event
 * @param overrides - Optional data overrides
 * @returns Mock user.updated webhook event
 */
export function createMockUserUpdatedEvent(
  overrides: Partial<Record<string, unknown>> = {}
): WebhookEvent {
  const defaultData = {
    id: 'user_test_123',
    email_addresses: [
      {
        email_address: 'updated@example.com',
        verification: { status: 'verified' },
      },
    ],
    first_name: 'Updated',
    last_name: 'User',
    image_url: 'https://example.com/new-avatar.jpg',
    updated_at: Date.now(),
    ...overrides,
  }

  return createMockWebhookEvent('user.updated', defaultData)
}

/**
 * Create a mock session.created webhook event
 * @param overrides - Optional data overrides
 * @returns Mock session.created webhook event
 */
export function createMockSessionCreatedEvent(
  overrides: Partial<Record<string, unknown>> = {}
): WebhookEvent {
  const defaultData = {
    id: 'sess_test_123',
    user_id: 'user_test_123',
    created_at: Date.now(),
    last_active_at: Date.now(),
    ...overrides,
  }

  return createMockWebhookEvent('session.created', defaultData)
}

/**
 * Validate webhook event structure
 * @param event - The webhook event to validate
 * @returns True if the event structure is valid
 */
export function validateWebhookEvent(event: unknown): event is WebhookEvent {
  if (!event || typeof event !== 'object') return false
  const e = event as Record<string, unknown>
  return (
    typeof e.type === 'string' &&
    typeof e.data === 'object' &&
    e.object === 'event' &&
    typeof e.timestamp === 'number' &&
    typeof e.instance_id === 'string'
  )
}

/**
 * Extract user ID from webhook event data
 * @param event - The webhook event
 * @returns User ID if found, null otherwise
 */
export function extractUserIdFromEvent(event: WebhookEvent): string | null {
  const data = event.data as unknown as Record<string, unknown>

  // For user events, the ID is in data.id
  if (event.type.startsWith('user.') && data.id) {
    return data.id as string
  }

  // For session events, the user ID is in data.user_id
  if (event.type.startsWith('session.') && data.user_id) {
    return data.user_id as string
  }

  return null
}

/**
 * Check if webhook event is a user lifecycle event
 * @param event - The webhook event
 * @returns True if it's a user lifecycle event
 */
export function isUserLifecycleEvent(event: WebhookEvent): boolean {
  return ['user.created', 'user.updated', 'user.deleted'].includes(event.type)
}

/**
 * Check if webhook event is a session event
 * @param event - The webhook event
 * @returns True if it's a session event
 */
export function isSessionEvent(event: WebhookEvent): boolean {
  return event.type.startsWith('session.')
}
