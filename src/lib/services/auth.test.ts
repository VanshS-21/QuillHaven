import { AuthService } from './auth'

// Mock Clerk's auth functions
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
}))

const mockAuth = require('@clerk/nextjs/server').auth
const mockCurrentUser = require('@clerk/nextjs/server').currentUser

describe('AuthService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('getCurrentUserId', () => {
    it('should return user ID when authenticated', async () => {
      const mockUserId = 'user_123'
      mockAuth.mockResolvedValue({ userId: mockUserId })

      const result = await AuthService.getCurrentUserId()

      expect(result).toBe(mockUserId)
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })

    it('should return null when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const result = await AuthService.getCurrentUserId()

      expect(result).toBeNull()
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })
  })

  describe('getCurrentUser', () => {
    it('should return user object when available', async () => {
      const mockUser = {
        id: 'user_123',
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
      }
      mockCurrentUser.mockResolvedValue(mockUser)

      const result = await AuthService.getCurrentUser()

      expect(result).toEqual(mockUser)
      expect(mockCurrentUser).toHaveBeenCalledTimes(1)
    })

    it('should return null when user not available', async () => {
      mockCurrentUser.mockResolvedValue(null)

      const result = await AuthService.getCurrentUser()

      expect(result).toBeNull()
      expect(mockCurrentUser).toHaveBeenCalledTimes(1)
    })
  })

  describe('isAuthenticated', () => {
    it('should return true when user is authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      const result = await AuthService.isAuthenticated()

      expect(result).toBe(true)
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })

    it('should return false when user is not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      const result = await AuthService.isAuthenticated()

      expect(result).toBe(false)
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })
  })

  describe('requireAuth', () => {
    it('should return user ID when authenticated', async () => {
      const mockUserId = 'user_123'
      mockAuth.mockResolvedValue({ userId: mockUserId })

      const result = await AuthService.requireAuth()

      expect(result).toBe(mockUserId)
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })

    it('should throw error when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null })

      await expect(AuthService.requireAuth()).rejects.toThrow(
        'Authentication required'
      )
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })
  })

  describe('getSession', () => {
    it('should return session info when authenticated', async () => {
      const mockUserId = 'user_123'
      const mockSessionId = 'sess_456'
      mockAuth.mockResolvedValue({
        userId: mockUserId,
        sessionId: mockSessionId,
      })

      const result = await AuthService.getSession()

      expect(result).toEqual({
        userId: mockUserId,
        sessionId: mockSessionId,
      })
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })

    it('should return null values when not authenticated', async () => {
      mockAuth.mockResolvedValue({ userId: null, sessionId: null })

      const result = await AuthService.getSession()

      expect(result).toEqual({
        userId: null,
        sessionId: null,
      })
      expect(mockAuth).toHaveBeenCalledTimes(1)
    })
  })
})
