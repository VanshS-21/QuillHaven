/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'
import { POST, GET } from './route'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { WebhookService } from '../../../../lib/services/webhook'

// Mock the dependencies
jest.mock('@clerk/nextjs/webhooks')
jest.mock('../../../../lib/services/webhook')

const mockVerifyWebhook = verifyWebhook as jest.MockedFunction<
  typeof verifyWebhook
>
const mockWebhookService = WebhookService as jest.Mocked<typeof WebhookService>

describe('/api/webhooks/clerk', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST', () => {
    it('should process valid webhook successfully', async () => {
      const mockEvent = {
        type: 'user.created',
        data: { id: 'user_123' },
        object: 'event',
        timestamp: 1640995200000,
        instance_id: 'ins_123',
      }

      mockVerifyWebhook.mockResolvedValue(mockEvent as any)
      mockWebhookService.processWebhookEvent.mockResolvedValue()

      const request = new NextRequest(
        'http://localhost:3000/api/webhooks/clerk',
        {
          method: 'POST',
          body: JSON.stringify(mockEvent),
          headers: {
            'content-type': 'application/json',
            'svix-id': 'msg_123',
            'svix-timestamp': '1640995200',
            'svix-signature': 'v1,signature',
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Webhook processed successfully')
      expect(mockVerifyWebhook).toHaveBeenCalledWith(request)
      expect(mockWebhookService.processWebhookEvent).toHaveBeenCalledWith(
        mockEvent
      )
    })

    it('should handle webhook verification failure', async () => {
      const error = new Error('Webhook verification failed')
      mockVerifyWebhook.mockRejectedValue(error)

      const request = new NextRequest(
        'http://localhost:3000/api/webhooks/clerk',
        {
          method: 'POST',
          body: JSON.stringify({}),
          headers: {
            'content-type': 'application/json',
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Webhook verification failed')
    })

    it('should handle processing errors', async () => {
      const mockEvent = {
        type: 'user.created',
        data: { id: 'user_123' },
      }

      mockVerifyWebhook.mockResolvedValue(mockEvent as any)
      mockWebhookService.processWebhookEvent.mockRejectedValue(
        new Error('Processing error')
      )

      const request = new NextRequest(
        'http://localhost:3000/api/webhooks/clerk',
        {
          method: 'POST',
          body: JSON.stringify(mockEvent),
          headers: {
            'content-type': 'application/json',
            'svix-id': 'msg_123',
            'svix-timestamp': '1640995200',
            'svix-signature': 'v1,signature',
          },
        }
      )

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('GET', () => {
    it('should return health check response', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.message).toBe('Clerk webhook endpoint is active')
      expect(data.timestamp).toBeDefined()
    })
  })
})
