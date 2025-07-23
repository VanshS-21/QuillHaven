/**
 * Integration tests for webhook functionality
 * Tests the complete webhook processing flow
 */

import { WebhookService } from './webhook'
import { UserService } from './user'
import { DatabaseService } from './database.service'
import {
  createMockUserCreatedEvent,
  createMockUserUpdatedEvent,
} from '../utils/webhook-test'

// Note: These are integration tests that require a test database
// They should be run in a test environment with proper database setup

describe('Webhook Integration Tests', () => {
  // Skip these tests if not in test environment
  const isTestEnvironment = process.env.NODE_ENV === 'test'

  beforeAll(async () => {
    if (!isTestEnvironment) {
      console.log('Skipping integration tests - not in test environment')
      return
    }
    // Setup test database if needed
  })

  afterAll(async () => {
    if (!isTestEnvironment) return
    // Cleanup test database if needed
  })

  beforeEach(async () => {
    if (!isTestEnvironment) return
    // Clean up test data before each test
    try {
      const { prisma } = await import('../prisma')
      await prisma.user.deleteMany({
        where: {
          clerkId: {
            contains: 'test_123',
          },
        },
      })
    } catch (error) {
      // Ignore cleanup errors in test environment
    }
  })

  describe('User Webhook Flow', () => {
    it('should create user from webhook and handle subsequent updates', async () => {
      if (!isTestEnvironment) {
        console.log('Skipping test - not in test environment')
        return
      }

      const userId = 'user_integration_test_123'

      // Test user creation
      const createEvent = createMockUserCreatedEvent({
        id: userId,
        email_addresses: [
          {
            email_address: 'integration@test.com',
            verification: { status: 'verified' },
          },
        ],
        first_name: 'Integration',
        last_name: 'Test',
      })

      await WebhookService.processWebhookEvent(createEvent)

      // Verify user was created
      const createdUser = await UserService.getUserByClerkId(userId)
      expect(createdUser).toBeTruthy()
      expect(createdUser?.email).toBe('integration@test.com')
      expect(createdUser?.firstName).toBe('Integration')
      expect(createdUser?.lastName).toBe('Test')

      // Test user update
      const updateEvent = createMockUserUpdatedEvent({
        id: userId,
        email_addresses: [
          {
            email_address: 'updated-integration@test.com',
            verification: { status: 'verified' },
          },
        ],
        first_name: 'Updated',
        last_name: 'Integration',
      })

      await WebhookService.processWebhookEvent(updateEvent)

      // Verify user was updated
      const updatedUser = await UserService.getUserByClerkId(userId)
      expect(updatedUser?.email).toBe('updated-integration@test.com')
      expect(updatedUser?.firstName).toBe('Updated')
      expect(updatedUser?.lastName).toBe('Integration')
    })

    it('should handle duplicate user creation gracefully', async () => {
      if (!isTestEnvironment) {
        console.log('Skipping test - not in test environment')
        return
      }

      const userId = 'user_duplicate_test_123'

      const createEvent = createMockUserCreatedEvent({
        id: userId,
        email_addresses: [
          {
            email_address: 'duplicate@test.com',
            verification: { status: 'verified' },
          },
        ],
      })

      // Create user first time
      await WebhookService.processWebhookEvent(createEvent)

      // Try to create the same user again
      await expect(
        WebhookService.processWebhookEvent(createEvent)
      ).resolves.not.toThrow()

      // Verify only one user exists
      const user = await UserService.getUserByClerkId(userId)
      expect(user).toBeTruthy()
      expect(user?.email).toBe('duplicate@test.com')
    })
  })

  describe('Error Handling', () => {
    it('should handle malformed webhook events gracefully', async () => {
      if (!isTestEnvironment) {
        console.log('Skipping test - not in test environment')
        return
      }

      const malformedEvent = {
        type: 'user.created',
        data: {
          // Missing required fields like id, email_addresses, etc.
          id: '', // Empty ID should cause issues
        },
        object: 'event',
        timestamp: Date.now(),
        instance_id: 'ins_test',
      } as any

      // Should handle gracefully but may log errors
      await expect(
        WebhookService.processWebhookEvent(malformedEvent)
      ).resolves.not.toThrow()
    })
  })
})

// Mock implementations for non-integration test environments
if (process.env.NODE_ENV !== 'test') {
  jest.mock('./user')
  jest.mock('./database.service')
}
