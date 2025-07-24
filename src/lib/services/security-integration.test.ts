/**
 * Integration tests for security features
 * Tests the integration between Clerk authentication and application security
 */

import { SecurityService } from './security'
import { SessionService } from './session'
import { ProfileSyncService } from './profile-sync'

// Mock Clerk
jest.mock('@clerk/nextjs/server', () => ({
  auth: jest.fn(),
  clerkClient: jest.fn(() => ({
    users: {
      getUser: jest.fn(),
      updateUser: jest.fn(),
      updateUserMetadata: jest.fn(),
    },
    sessions: {
      getSessionList: jest.fn(),
      getSession: jest.fn(),
      revokeSession: jest.fn(),
    },
  })),
}))

// Mock Prisma
jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userSession: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
    },
    userProfile: {
      upsert: jest.fn(),
    },
    userPreferences: {
      create: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

describe('Security Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Role-based Access Control', () => {
    it('should verify user roles correctly', async () => {
      const { prisma } = require('../prisma')

      // Mock user with ADMIN role
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        clerkId: 'clerk_123',
        role: 'ADMIN',
        status: 'ACTIVE',
      })

      const hasAdminRole = await SecurityService.hasRole('clerk_123', 'ADMIN')
      const hasEditorRole = await SecurityService.hasRole('clerk_123', 'EDITOR')
      const hasUserRole = await SecurityService.hasRole('clerk_123', 'USER')

      expect(hasAdminRole).toBe(true)
      expect(hasEditorRole).toBe(true) // Admin has editor privileges
      expect(hasUserRole).toBe(true) // Admin has user privileges
    })

    it('should enforce role requirements', async () => {
      const { prisma } = require('../prisma')

      // Mock user with USER role
      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        clerkId: 'clerk_123',
        role: 'USER',
        status: 'ACTIVE',
      })

      // Should not throw for USER role requirement
      await expect(
        SecurityService.requireRole('clerk_123', 'USER')
      ).resolves.not.toThrow()

      // Should throw for ADMIN role requirement
      await expect(
        SecurityService.requireRole('clerk_123', 'ADMIN')
      ).rejects.toThrow('Access denied. Required role: ADMIN')
    })
  })

  describe('Session Management', () => {
    it('should create session with security tracking', async () => {
      const { prisma } = require('../prisma')

      // Mock successful session creation
      prisma.userSession.create.mockResolvedValue({
        id: 'session_123',
        userId: 'clerk_123',
        token: 'session_token',
        isActive: true,
      })

      prisma.user.update.mockResolvedValue({})
      prisma.userActivity.create.mockResolvedValue({})
      prisma.userActivity.findMany.mockResolvedValue([]) // No recent logins

      await SessionService.createSession('clerk_123', 'session_token', {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      })

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'clerk_123',
          token: 'session_token',
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          isActive: true,
        }),
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: 'clerk_123' },
        data: expect.objectContaining({
          lastLoginAt: expect.any(Date),
        }),
      })
    })

    it('should detect suspicious login patterns', async () => {
      const result = await SecurityService.detectSuspiciousLogin(
        'clerk_123',
        '192.168.1.100', // New IP
        'Mozilla/5.0 (Unknown Browser)' // New user agent
      )

      expect(result.isSuspicious).toBe(true)
      expect(result.factors).toContain('new_ip_address')
      expect(result.factors).toContain('new_user_agent')
      expect(result.riskLevel).toBe('high')
    })
  })

  describe('Profile Synchronization', () => {
    it('should sync user profile from Clerk to database', async () => {
      const { clerkClient } = require('@clerk/nextjs/server')
      const { prisma } = require('../prisma')

      const mockClerkClient = {
        users: {
          getUser: jest.fn().mockResolvedValue({
            id: 'clerk_123',
            firstName: 'John',
            lastName: 'Doe',
            emailAddresses: [{ emailAddress: 'john@example.com' }],
            imageUrl: 'https://example.com/avatar.jpg',
            twoFactorEnabled: false,
            publicMetadata: { role: 'USER' },
            updatedAt: Date.now(),
          }),
        },
      }

      clerkClient.mockResolvedValue(mockClerkClient)

      prisma.user.findUnique.mockResolvedValue({
        id: 'user_123',
        clerkId: 'clerk_123',
        firstName: 'Jane', // Different from Clerk
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'USER',
        updatedAt: new Date(Date.now() - 60000), // Older than Clerk
      })

      prisma.user.update.mockResolvedValue({})
      prisma.userActivity.create.mockResolvedValue({})

      const result = await ProfileSyncService.syncFromClerk('clerk_123')

      expect(result.success).toBe(true)
      expect(result.changes).toContain('firstName')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: 'clerk_123' },
        data: expect.objectContaining({
          firstName: 'John',
        }),
      })
    })
  })

  describe('Security Event Logging', () => {
    it('should log security events properly', async () => {
      const { prisma } = require('../prisma')

      prisma.userActivity.create.mockResolvedValue({})

      // This should trigger security event logging
      await SecurityService.detectSuspiciousLogin(
        'clerk_123',
        '192.168.1.100',
        'Mozilla/5.0'
      )

      expect(prisma.userActivity.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'clerk_123',
          activity: 'suspicious_login',
          metadata: expect.objectContaining({
            factors: expect.any(Array),
            ipAddress: '192.168.1.100',
            userAgent: 'Mozilla/5.0',
          }),
        }),
      })
    })

    it('should retrieve security events for monitoring', async () => {
      const { prisma } = require('../prisma')

      const mockEvents = [
        {
          userId: 'clerk_123',
          activity: 'two_factor_enabled',
          metadata: { enabledAt: new Date() },
          createdAt: new Date(),
        },
        {
          userId: 'clerk_123',
          activity: 'suspicious_login',
          metadata: { factors: ['new_ip_address'] },
          createdAt: new Date(),
        },
      ]

      prisma.userActivity.findMany.mockResolvedValue(mockEvents)

      const events = await SecurityService.getSecurityEvents('clerk_123', 10)

      expect(events).toHaveLength(2)
      expect(events[0].event).toBe('two_factor_enabled')
      expect(events[1].event).toBe('suspicious_login')
    })
  })

  describe('Two-Factor Authentication Integration', () => {
    it('should handle 2FA setup workflow', async () => {
      const { clerkClient } = require('@clerk/nextjs/server')
      const { prisma } = require('../prisma')

      const mockClerkClient = {
        users: {
          getUser: jest.fn().mockResolvedValue({
            id: 'clerk_123',
            emailAddresses: [{ emailAddress: 'john@example.com' }],
            twoFactorEnabled: false,
            privateMetadata: {},
            updatedAt: Date.now(),
          }),
          updateUserMetadata: jest.fn().mockResolvedValue({}),
        },
      }

      clerkClient.mockResolvedValue(mockClerkClient)

      prisma.user.update.mockResolvedValue({})
      prisma.userActivity.create.mockResolvedValue({})

      const result = await SecurityService.enableTwoFactor(
        'clerk_123',
        '192.168.1.1'
      )

      expect(result.success).toBe(true)
      expect(result.secret).toBeDefined()
      expect(result.qrCode).toBeDefined()
      expect(result.backupCodes).toBeDefined()
      expect(result.backupCodes).toHaveLength(10)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: 'clerk_123' },
        data: expect.objectContaining({
          twoFactorEnabled: true,
        }),
      })
    })
  })
})
