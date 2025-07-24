import { SessionService } from './session'
import { SecurityService } from './security'
import { prisma } from '../prisma'

// Mock dependencies
jest.mock('../prisma', () => ({
  prisma: {
    userSession: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
    },
  },
}))

jest.mock('./security')

describe('SessionService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session successfully', async () => {
      const userId = 'user_123'
      const sessionId = 'sess_123'
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        expiresAt: new Date(Date.now() + 86400000),
      }

      const mockSuspiciousLogin = {
        isSuspicious: false,
        factors: [],
        riskLevel: 'low' as const,
      }

      ;(SecurityService.detectSuspiciousLogin as jest.Mock).mockResolvedValue(
        mockSuspiciousLogin
      )
      ;(prisma.userSession.create as jest.Mock).mockResolvedValue({})
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      await SessionService.createSession(userId, sessionId, metadata)

      expect(prisma.userSession.create).toHaveBeenCalledWith({
        data: {
          userId,
          token: sessionId,
          expiresAt: metadata.expiresAt,
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          isActive: true,
          createdAt: expect.any(Date),
          lastActiveAt: expect.any(Date),
        },
      })

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: userId },
        data: {
          lastLoginAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should handle suspicious login detection', async () => {
      const userId = 'user_123'
      const sessionId = 'sess_123'
      const metadata = {
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0',
      }

      const mockSuspiciousLogin = {
        isSuspicious: true,
        factors: ['new_ip_address'],
        riskLevel: 'high' as const,
      }

      ;(SecurityService.detectSuspiciousLogin as jest.Mock).mockResolvedValue(
        mockSuspiciousLogin
      )
      ;(prisma.userSession.create as jest.Mock).mockResolvedValue({})
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const requireAdditionalVerificationSpy = jest
        .spyOn(SessionService as any, 'requireAdditionalVerification')
        .mockResolvedValue({})

      await SessionService.createSession(userId, sessionId, metadata)

      expect(requireAdditionalVerificationSpy).toHaveBeenCalledWith(
        userId,
        sessionId
      )
    })
  })

  describe('updateSessionActivity', () => {
    it('should update session activity successfully', async () => {
      const sessionId = 'sess_123'
      const metadata = {
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
      }

      ;(prisma.userSession.update as jest.Mock).mockResolvedValue({})

      await SessionService.updateSessionActivity(sessionId, metadata)

      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { token: sessionId },
        data: {
          lastActiveAt: expect.any(Date),
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
        },
      })
    })

    it('should handle update errors gracefully', async () => {
      const sessionId = 'sess_123'

      ;(prisma.userSession.update as jest.Mock).mockRejectedValue(
        new Error('Database error')
      )

      // Should not throw
      await expect(
        SessionService.updateSessionActivity(sessionId)
      ).resolves.toBeUndefined()
    })
  })

  describe('endSession', () => {
    it('should end a session successfully', async () => {
      const sessionId = 'sess_123'
      const mockSession = {
        userId: 'user_123',
        createdAt: new Date(Date.now() - 3600000), // 1 hour ago
      }

      ;(prisma.userSession.findUnique as jest.Mock).mockResolvedValue(
        mockSession
      )
      ;(prisma.userSession.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      await SessionService.endSession(sessionId, 'user_logout')

      expect(prisma.userSession.update).toHaveBeenCalledWith({
        where: { token: sessionId },
        data: {
          isActive: false,
          lastActiveAt: expect.any(Date),
        },
      })
    })

    it('should handle session not found', async () => {
      const sessionId = 'sess_123'

      ;(prisma.userSession.findUnique as jest.Mock).mockResolvedValue(null)

      // Should not throw
      await expect(
        SessionService.endSession(sessionId)
      ).resolves.toBeUndefined()
    })
  })

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const userId = 'user_123'
      const mockSessions = [
        {
          id: '1',
          userId,
          token: 'sess_123',
          isActive: true,
          expiresAt: new Date(Date.now() + 86400000),
          lastActiveAt: new Date(),
        },
      ]

      ;(prisma.userSession.findMany as jest.Mock).mockResolvedValue(
        mockSessions
      )

      const result = await SessionService.getActiveSessions(userId)

      expect(result).toEqual(mockSessions)
      expect(prisma.userSession.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          isActive: true,
          expiresAt: {
            gt: expect.any(Date),
          },
        },
        orderBy: { lastActiveAt: 'desc' },
      })
    })
  })

  describe('cleanupExpiredSessions', () => {
    it('should cleanup expired sessions', async () => {
      const expiredSessions = [
        {
          token: 'sess_expired_1',
          userId: 'user_123',
          expiresAt: new Date(Date.now() - 86400000), // Expired
          isActive: true,
          lastActiveAt: new Date(Date.now() - 86400000),
        },
        {
          token: 'sess_stale_1',
          userId: 'user_456',
          expiresAt: new Date(Date.now() + 86400000), // Not expired
          isActive: true,
          lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // Stale
        },
      ]

      ;(prisma.userSession.findMany as jest.Mock).mockResolvedValue(
        expiredSessions
      )

      const endSessionSpy = jest
        .spyOn(SessionService, 'endSession')
        .mockResolvedValue()

      await SessionService.cleanupExpiredSessions()

      expect(endSessionSpy).toHaveBeenCalledTimes(2)
      expect(endSessionSpy).toHaveBeenCalledWith('sess_expired_1', 'expired')
      expect(endSessionSpy).toHaveBeenCalledWith('sess_stale_1', 'expired')
    })
  })

  describe('enforceSecurityPolicies', () => {
    it('should enforce concurrent session limits', async () => {
      const userId = 'user_123'
      const activeSessions = Array.from({ length: 6 }, (_, i) => ({
        id: `${i + 1}`,
        token: `sess_${i + 1}`,
        userId,
        refreshToken: null,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
        lastActiveAt: new Date(Date.now() - i * 60000), // Different last active times
        ipAddress: '192.168.1.1',
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(Date.now() - i * 60000),
      }))

      jest
        .spyOn(SessionService, 'getActiveSessions')
        .mockResolvedValue(activeSessions)
      const endSessionSpy = jest
        .spyOn(SessionService, 'endSession')
        .mockResolvedValue()
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      // Mock security config to return max 5 sessions
      jest.doMock('../config/security', () => ({
        getSecurityConfig: () => ({
          session: {
            maxConcurrentSessions: 5,
            inactiveSessionTimeoutDays: 30,
            requireReauthenticationHours: 168,
          },
        }),
      }))

      const result = await SessionService.enforceSecurityPolicies(userId)

      expect(result.violations).toContain('too_many_sessions')
      expect(result.revokedSessions).toBe(1) // Should revoke 1 session (6 - 5)
      expect(endSessionSpy).toHaveBeenCalledWith(
        'sess_6',
        'policy_violation_concurrent_limit'
      )
    })

    it('should detect multiple locations', async () => {
      const userId = 'user_123'
      const activeSessions = Array.from({ length: 4 }, (_, i) => ({
        id: `${i + 1}`,
        token: `sess_${i + 1}`,
        userId,
        refreshToken: null,
        isActive: true,
        expiresAt: new Date(Date.now() + 86400000),
        lastActiveAt: new Date(),
        ipAddress: `192.168.1.${i + 1}`, // Different IP addresses
        userAgent: 'Mozilla/5.0',
        createdAt: new Date(),
      }))

      jest
        .spyOn(SessionService, 'getActiveSessions')
        .mockResolvedValue(activeSessions)
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SessionService.enforceSecurityPolicies(userId)

      expect(result.violations).toContain('multiple_locations')
    })

    it('should handle stale sessions', async () => {
      const userId = 'user_123'
      const staleSessions = [
        {
          id: '1',
          token: 'sess_stale',
          userId,
          refreshToken: null,
          isActive: true,
          expiresAt: new Date(Date.now() + 86400000),
          lastActiveAt: new Date(Date.now() - 31 * 24 * 60 * 60 * 1000), // 31 days ago
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          createdAt: new Date(),
        },
      ]

      jest
        .spyOn(SessionService, 'getActiveSessions')
        .mockResolvedValue(staleSessions)
      const endSessionSpy = jest
        .spyOn(SessionService, 'endSession')
        .mockResolvedValue()
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SessionService.enforceSecurityPolicies(userId)

      expect(result.violations).toContain('stale_sessions')
      expect(endSessionSpy).toHaveBeenCalledWith(
        'sess_stale',
        'policy_violation_stale'
      )
    })
  })

  describe('getSessionStatistics', () => {
    it('should return session statistics', async () => {
      const userId = 'user_123'

      ;(prisma.userSession.count as jest.Mock)
        .mockResolvedValueOnce(10) // Total sessions
        .mockResolvedValueOnce(3) // Active sessions
      ;(prisma.userActivity.count as jest.Mock).mockResolvedValue(25) // Recent activity
      ;(prisma.userSession.findFirst as jest.Mock).mockResolvedValue({
        lastActiveAt: new Date(),
        ipAddress: '192.168.1.1',
      })

      const result = await SessionService.getSessionStatistics(userId)

      expect(result.totalSessions).toBe(10)
      expect(result.activeSessions).toBe(3)
      expect(result.recentActivity).toBe(25)
      expect(result.lastActiveAt).toBeInstanceOf(Date)
      expect(result.lastIpAddress).toBe('192.168.1.1')
    })

    it('should handle errors gracefully', async () => {
      const userId = 'user_123'

      ;(prisma.userSession.count as jest.Mock).mockRejectedValue(
        new Error('Database error')
      )

      const result = await SessionService.getSessionStatistics(userId)

      expect(result.totalSessions).toBe(0)
      expect(result.activeSessions).toBe(0)
      expect(result.recentActivity).toBe(0)
      expect(result.lastActiveAt).toBeNull()
      expect(result.lastIpAddress).toBeNull()
    })
  })
})
