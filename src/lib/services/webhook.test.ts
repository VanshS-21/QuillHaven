import { WebhookService } from './webhook'
import { UserService } from './user'
import { WebhookEvent } from '@clerk/nextjs/server'

// Mock the dependencies
jest.mock('./user')
jest.mock('./database.service', () => ({
  DatabaseService: {
    logUserActivity: jest.fn(),
  },
}))

const mockUserService = UserService as jest.Mocked<typeof UserService>
const { DatabaseService } = require('./database.service')
const mockLogUserActivity = (DatabaseService as any).logUserActivity

describe('WebhookService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('processWebhookEvent', () => {
    it('should handle user.created event', async () => {
      const mockEvent: WebhookEvent = {
        type: 'user.created',
        data: {
          id: 'user_123',
          email_addresses: [
            {
              email_address: 'test@example.com',
              verification: { status: 'verified' },
            },
          ],
          first_name: 'John',
          last_name: 'Doe',
          image_url: 'https://example.com/avatar.jpg',
          created_at: 1640995200000,
          updated_at: 1640995200000,
        },
        object: 'event',
        timestamp: 1640995200000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      mockUserService.createUserFromWebhook.mockResolvedValue()

      await WebhookService.processWebhookEvent(mockEvent)

      expect(mockUserService.createUserFromWebhook).toHaveBeenCalledWith({
        clerkId: 'user_123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        imageUrl: 'https://example.com/avatar.jpg',
        emailVerified: true,
        createdAt: new Date(1640995200000),
        updatedAt: new Date(1640995200000),
      })
    })

    it('should handle user.updated event', async () => {
      const mockEvent: WebhookEvent = {
        type: 'user.updated',
        data: {
          id: 'user_123',
          email_addresses: [
            {
              email_address: 'updated@example.com',
              verification: { status: 'verified' },
            },
          ],
          first_name: 'Jane',
          last_name: 'Smith',
          image_url: 'https://example.com/new-avatar.jpg',
          updated_at: 1640995300000,
        },
        object: 'event',
        timestamp: 1640995300000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      mockUserService.updateUserFromWebhook.mockResolvedValue()

      await WebhookService.processWebhookEvent(mockEvent)

      expect(mockUserService.updateUserFromWebhook).toHaveBeenCalledWith(
        'user_123',
        {
          email: 'updated@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
          imageUrl: 'https://example.com/new-avatar.jpg',
          emailVerified: true,
          updatedAt: new Date(1640995300000),
        }
      )
    })

    it('should handle user.deleted event', async () => {
      const mockEvent: WebhookEvent = {
        type: 'user.deleted',
        data: {
          id: 'user_123',
        },
        object: 'event',
        timestamp: 1640995400000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      mockUserService.deleteUserFromWebhook.mockResolvedValue()

      await WebhookService.processWebhookEvent(mockEvent)

      expect(mockUserService.deleteUserFromWebhook).toHaveBeenCalledWith(
        'user_123'
      )
    })

    it('should handle session.created event', async () => {
      const mockEvent: WebhookEvent = {
        type: 'session.created',
        data: {
          id: 'sess_123',
          user_id: 'user_123',
          created_at: 1640995200000,
          last_active_at: 1640995200000,
        },
        object: 'event',
        timestamp: 1640995200000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      mockLogUserActivity.mockResolvedValue(undefined)

      await WebhookService.processWebhookEvent(mockEvent)

      expect(mockLogUserActivity).toHaveBeenCalledWith({
        userId: 'user_123',
        activity: 'session_created',
        sessionId: 'sess_123',
        metadata: {
          lastActiveAt: new Date(1640995200000),
          createdAt: new Date(1640995200000),
        },
      })
    })

    it('should handle unknown event types gracefully', async () => {
      const mockEvent: WebhookEvent = {
        type: 'unknown.event' as any,
        data: { id: 'test_123' },
        object: 'event',
        timestamp: 1640995200000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      const consoleSpy = jest.spyOn(console, 'log').mockImplementation()

      await WebhookService.processWebhookEvent(mockEvent)

      expect(consoleSpy).toHaveBeenCalledWith(
        'Unhandled webhook event type: unknown.event'
      )
      consoleSpy.mockRestore()
    })

    it('should handle errors and re-throw them', async () => {
      const mockEvent: WebhookEvent = {
        type: 'user.created',
        data: {
          id: 'user_123',
          email_addresses: [],
        },
        object: 'event',
        timestamp: 1640995200000,
        instance_id: 'ins_123',
        event_attributes: {},
      } as any

      const error = new Error('Database error')
      mockUserService.createUserFromWebhook.mockRejectedValue(error)

      await expect(
        WebhookService.processWebhookEvent(mockEvent)
      ).rejects.toThrow('Database error')
    })
  })
})
