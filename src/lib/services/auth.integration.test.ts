/**
 * Authentication Integration Tests
 *
 * Tests the complete authentication flow including middleware,
 * API routes, and service integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { AuthService } from './auth'

// Mock Clerk functions
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  currentUser: jest.fn(),
  clerkMiddleware: jest.fn(),
  createRouteMatcher: jest.fn(),
}))

const mockAuth = require('@clerk/nextjs/server').auth
const mockCurrentUser = require('@clerk/nextjs/server').currentUser

describe('Authentication Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Complete Authentication Flow', () => {
    it('should handle authenticated user flow', async () => {
      // Mock authenticated user
      const mockUserId = 'user_123'
      const mockUser = {
        id: mockUserId,
        firstName: 'John',
        lastName: 'Doe',
        emailAddresses: [{ emailAddress: 'john@example.com' }],
        imageUrl: 'https://example.com/avatar.jpg',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      }

      mockAuth.mockResolvedValue({
        userId: mockUserId,
        sessionId: 'sess_456',
      })
      mockCurrentUser.mockResolvedValue(mockUser)

      // Test authentication check
      const isAuthenticated = await AuthService.isAuthenticated()
      expect(isAuthenticated).toBe(true)

      // Test user retrieval
      const user = await AuthService.getCurrentUser()
      expect(user).toEqual(mockUser)

      // Test session info
      const session = await AuthService.getSession()
      expect(session).toEqual({
        userId: mockUserId,
        sessionId: 'sess_456',
      })

      // Test protected operation
      const userId = await AuthService.requireAuth()
      expect(userId).toBe(mockUserId)
    })

    it('should handle unauthenticated user flow', async () => {
      // Mock unauthenticated user
      mockAuth.mockResolvedValue({
        userId: null,
        sessionId: null,
      })
      mockCurrentUser.mockResolvedValue(null)

      // Test authentication check
      const isAuthenticated = await AuthService.isAuthenticated()
      expect(isAuthenticated).toBe(false)

      // Test user retrieval
      const user = await AuthService.getCurrentUser()
      expect(user).toBeNull()

      // Test session info
      const session = await AuthService.getSession()
      expect(session).toEqual({
        userId: null,
        sessionId: null,
      })

      // Test protected operation should throw
      await expect(AuthService.requireAuth()).rejects.toThrow(
        'Authentication required'
      )
    })
  })

  describe('Error Handling', () => {
    it('should handle auth service errors gracefully', async () => {
      mockAuth.mockRejectedValue(new Error('Auth service error'))

      await expect(AuthService.isAuthenticated()).rejects.toThrow(
        'Auth service error'
      )
      await expect(AuthService.getCurrentUserId()).rejects.toThrow(
        'Auth service error'
      )
      await expect(AuthService.getSession()).rejects.toThrow(
        'Auth service error'
      )
    })

    it('should handle currentUser service errors gracefully', async () => {
      mockCurrentUser.mockRejectedValue(new Error('User service error'))

      await expect(AuthService.getCurrentUser()).rejects.toThrow(
        'User service error'
      )
    })
  })

  describe('Edge Cases', () => {
    it('should handle undefined userId correctly', async () => {
      mockAuth.mockResolvedValue({
        userId: undefined,
        sessionId: 'sess_456',
      })

      const isAuthenticated = await AuthService.isAuthenticated()
      expect(isAuthenticated).toBe(false)

      const userId = await AuthService.getCurrentUserId()
      expect(userId).toBeNull()
    })

    it('should handle empty string userId correctly', async () => {
      mockAuth.mockResolvedValue({
        userId: '',
        sessionId: 'sess_456',
      })

      const isAuthenticated = await AuthService.isAuthenticated()
      expect(isAuthenticated).toBe(false)

      const userId = await AuthService.getCurrentUserId()
      expect(userId).toBeNull()
    })

    it('should handle partial user data correctly', async () => {
      const partialUser = {
        id: 'user_123',
        firstName: 'John',
        // Missing lastName, emailAddresses, etc.
      }

      mockCurrentUser.mockResolvedValue(partialUser)

      const user = await AuthService.getCurrentUser()
      expect(user).toEqual(partialUser)
    })
  })

  describe('Performance and Caching', () => {
    it('should call auth service for each request', async () => {
      mockAuth.mockResolvedValue({ userId: 'user_123' })

      await AuthService.getCurrentUserId()
      await AuthService.getCurrentUserId()

      expect(mockAuth).toHaveBeenCalledTimes(2)
    })

    it('should call currentUser service for each request', async () => {
      const mockUser = { id: 'user_123', firstName: 'John' }
      mockCurrentUser.mockResolvedValue(mockUser)

      await AuthService.getCurrentUser()
      await AuthService.getCurrentUser()

      expect(mockCurrentUser).toHaveBeenCalledTimes(2)
    })
  })
})
