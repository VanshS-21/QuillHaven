import { SecurityService } from './security'
import { prisma } from '../prisma'
import { clerkClient } from '@clerk/nextjs/server'

// Mock dependencies
jest.mock('../prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userActivity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    userSession: {
      findMany: jest.fn(),
    },
  },
}))

jest.mock('@clerk/nextjs/server', () => ({
  clerkClient: jest.fn(),
}))

const mockClerkClient = {
  users: {
    getUser: jest.fn(),
    updateUserMetadata: jest.fn(),
  },
  sessions: {
    getSessionList: jest.fn(),
    revokeSession: jest.fn(),
  },
}

describe('SecurityService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(clerkClient as jest.Mock).mockResolvedValue(mockClerkClient)
  })

  describe('enableTwoFactor', () => {
    it('should enable two-factor authentication for a user', async () => {
      const userId = 'user_123'
      const mockUser = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        twoFactorEnabled: false,
        privateMetadata: {},
      }

      mockClerkClient.users.getUser.mockResolvedValue(mockUser)
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SecurityService.enableTwoFactor(
        userId,
        '192.168.1.1'
      )

      expect(result.success).toBe(true)
      expect(result.backupCodes).toHaveLength(10)
      expect(result.secret).toBeDefined()
      expect(result.qrCode).toContain('otpauth://totp/')
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: userId },
        data: {
          twoFactorEnabled: true,
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should return error if 2FA is already enabled', async () => {
      const userId = 'user_123'
      const mockUser = {
        id: 'user_123',
        emailAddresses: [{ emailAddress: 'test@example.com' }],
        twoFactorEnabled: true,
        privateMetadata: {},
      }

      mockClerkClient.users.getUser.mockResolvedValue(mockUser)

      const result = await SecurityService.enableTwoFactor(userId)

      expect(result.success).toBe(false)
      expect(result.message).toBe(
        'Two-factor authentication is already enabled'
      )
    })

    it('should handle user not found error', async () => {
      const userId = 'user_123'

      mockClerkClient.users.getUser.mockResolvedValue(null)

      await expect(SecurityService.enableTwoFactor(userId)).rejects.toThrow(
        'Failed to enable two-factor authentication'
      )
    })
  })

  describe('verifyTwoFactor', () => {
    it('should verify TOTP token successfully', async () => {
      const userId = 'user_123'
      const token = '123456'
      const mockUser = {
        id: 'user_123',
        privateMetadata: {
          totpSecret: 'JBSWY3DPEHPK3PXP', // Base32 encoded secret
        },
      }

      mockClerkClient.users.getUser.mockResolvedValue(mockUser)
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      // Mock the TOTP verification to return true
      jest
        .spyOn(SecurityService as any, 'verifyTOTPToken')
        .mockReturnValue(true)

      const result = await SecurityService.verifyTwoFactor(
        userId,
        token,
        'totp',
        '192.168.1.1'
      )

      expect(result.success).toBe(true)
      expect(result.type).toBe('totp')
      expect(result.usedBackupCode).toBe(false)
    })

    it('should verify backup code successfully', async () => {
      const userId = 'user_123'
      const backupCode = 'ABCD1234'

      jest
        .spyOn(SecurityService as any, 'verifyBackupCode')
        .mockResolvedValue(true)
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SecurityService.verifyTwoFactor(
        userId,
        backupCode,
        'backup_code'
      )

      expect(result.success).toBe(true)
      expect(result.type).toBe('backup_code')
      expect(result.usedBackupCode).toBe(true)
    })

    it('should handle invalid TOTP token', async () => {
      const userId = 'user_123'
      const token = '000000'
      const mockUser = {
        id: 'user_123',
        privateMetadata: {
          totpSecret: 'JBSWY3DPEHPK3PXP',
        },
      }

      mockClerkClient.users.getUser.mockResolvedValue(mockUser)
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      // Mock the TOTP verification to return false
      jest
        .spyOn(SecurityService as any, 'verifyTOTPToken')
        .mockReturnValue(false)

      const result = await SecurityService.verifyTwoFactor(
        userId,
        token,
        'totp'
      )

      expect(result.success).toBe(false)
      expect(result.message).toBe('Invalid two-factor authentication code')
    })
  })

  describe('getUserSessions', () => {
    it('should return user sessions from Clerk', async () => {
      const userId = 'user_123'
      const mockSessions = {
        data: [
          {
            id: 'sess_123',
            userId: 'user_123',
            status: 'active',
            lastActiveAt: Date.now(),
            createdAt: Date.now(),
            expireAt: Date.now() + 86400000, // 24 hours
          },
        ],
      }

      mockClerkClient.sessions.getSessionList.mockResolvedValue(mockSessions)

      const result = await SecurityService.getUserSessions(userId)

      expect(result).toHaveLength(1)
      expect(result[0].id).toBe('sess_123')
      expect(result[0].status).toBe('active')
    })
  })

  describe('revokeSession', () => {
    it('should revoke a session successfully', async () => {
      const sessionId = 'sess_123'

      mockClerkClient.sessions.revokeSession.mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      await SecurityService.revokeSession(sessionId)

      expect(mockClerkClient.sessions.revokeSession).toHaveBeenCalledWith(
        sessionId
      )
    })
  })

  describe('updateUserRole', () => {
    it('should update user role successfully', async () => {
      const targetUserId = 'user_123'
      const newRole = 'EDITOR'
      const adminUserId = 'admin_123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
      })
      ;(prisma.user.update as jest.Mock).mockResolvedValue({})
      mockClerkClient.users.updateUserMetadata.mockResolvedValue({})
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      await SecurityService.updateUserRole(
        targetUserId,
        newRole as any,
        adminUserId
      )

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { clerkId: targetUserId },
        data: {
          role: newRole,
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should throw error if admin user not found', async () => {
      const targetUserId = 'user_123'
      const newRole = 'EDITOR'
      const adminUserId = 'admin_123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      await expect(
        SecurityService.updateUserRole(
          targetUserId,
          newRole as any,
          adminUserId
        )
      ).rejects.toThrow('Failed to update user role')
    })

    it('should throw error if user is not admin', async () => {
      const targetUserId = 'user_123'
      const newRole = 'EDITOR'
      const adminUserId = 'admin_123'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
      })

      await expect(
        SecurityService.updateUserRole(
          targetUserId,
          newRole as any,
          adminUserId
        )
      ).rejects.toThrow('Failed to update user role')
    })
  })

  describe('hasRole', () => {
    it('should return true for user with sufficient role', async () => {
      const userId = 'user_123'
      const requiredRole = 'USER'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
      })

      const result = await SecurityService.hasRole(userId, requiredRole as any)

      expect(result).toBe(true)
    })

    it('should return false for user with insufficient role', async () => {
      const userId = 'user_123'
      const requiredRole = 'ADMIN'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'USER',
      })

      const result = await SecurityService.hasRole(userId, requiredRole as any)

      expect(result).toBe(false)
    })

    it('should return false if user not found', async () => {
      const userId = 'user_123'
      const requiredRole = 'USER'

      ;(prisma.user.findUnique as jest.Mock).mockResolvedValue(null)

      const result = await SecurityService.hasRole(userId, requiredRole as any)

      expect(result).toBe(false)
    })
  })

  describe('detectSuspiciousLogin', () => {
    it('should detect suspicious login from new IP', async () => {
      const userId = 'user_123'
      const ipAddress = '192.168.1.100'
      const userAgent = 'Mozilla/5.0'

      const mockRecentLogins = [
        {
          metadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
          createdAt: new Date(),
        },
      ]

      ;(prisma.userActivity.findMany as jest.Mock).mockResolvedValue(
        mockRecentLogins
      )
      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SecurityService.detectSuspiciousLogin(
        userId,
        ipAddress,
        userAgent
      )

      expect(result.isSuspicious).toBe(true)
      expect(result.factors).toContain('new_ip_address')
      expect(result.riskLevel).toBe('medium')
    })

    it('should not detect suspicious login for known IP', async () => {
      const userId = 'user_123'
      const ipAddress = '192.168.1.1'
      const userAgent = 'Mozilla/5.0'

      const mockRecentLogins = [
        {
          metadata: {
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
          },
          createdAt: new Date(),
        },
      ]

      ;(prisma.userActivity.findMany as jest.Mock).mockResolvedValue(
        mockRecentLogins
      )

      const result = await SecurityService.detectSuspiciousLogin(
        userId,
        ipAddress,
        userAgent
      )

      expect(result.isSuspicious).toBe(false)
      expect(result.factors).toHaveLength(0)
      expect(result.riskLevel).toBe('low')
    })
  })

  describe('regenerateBackupCodes', () => {
    it('should regenerate backup codes successfully', async () => {
      const userId = 'user_123'

      ;(prisma.userActivity.create as jest.Mock).mockResolvedValue({})

      const result = await SecurityService.regenerateBackupCodes(userId)

      expect(result).toHaveLength(10)
      expect(result[0]).toMatch(/^[A-Z0-9]{8}$/)
    })
  })
})
