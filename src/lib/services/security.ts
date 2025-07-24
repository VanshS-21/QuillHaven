import { auth, clerkClient } from '@clerk/nextjs/server'
import { prisma } from '../prisma'
import { UserRole, Prisma } from '../../generated/prisma'
import crypto from 'crypto'

/**
 * Security service for advanced authentication and authorization features
 * Handles two-factor authentication, session management, and role-based access control
 */
export class SecurityService {
  /**
   * Enable two-factor authentication for a user
   * @param userId - Clerk user ID
   * @param ipAddress - Client IP address
   * @returns Promise<TwoFactorSetup>
   */
  static async enableTwoFactor(
    userId: string,
    ipAddress?: string
  ): Promise<TwoFactorSetup> {
    try {
      // Get the user from Clerk
      const clerk = await clerkClient()
      const user = await clerk.users.getUser(userId)

      if (!user) {
        throw new Error('User not found')
      }

      // Check if user already has 2FA enabled
      if (user.twoFactorEnabled) {
        return {
          success: false,
          message: 'Two-factor authentication is already enabled',
        }
      }

      // Update user record in database to track 2FA status
      await prisma.user.update({
        where: { clerkId: userId },
        data: {
          twoFactorEnabled: true,
          updatedAt: new Date(),
        },
      })

      // Log security event
      await this.logSecurityEvent({
        userId,
        event: 'two_factor_enabled',
        metadata: {
          enabledAt: new Date(),
          method: 'totp',
          ipAddress: ipAddress || 'unknown',
          userAgent: 'unknown', // Would be passed from request context
        },
      })

      // Generate backup codes for the user
      const backupCodes = this.generateBackupCodes()

      // Store backup codes in database (encrypted)
      await this.storeBackupCodes(userId, backupCodes)

      // Create TOTP secret for the user
      const totpSecret = this.generateTOTPSecret()

      // Store TOTP secret in user metadata
      await clerk.users.updateUserMetadata(userId, {
        privateMetadata: {
          ...user.privateMetadata,
          totpSecret,
          backupCodesGenerated: true,
        },
      })

      return {
        success: true,
        message: 'Two-factor authentication enabled successfully',
        secret: totpSecret,
        qrCode: this.generateQRCodeURL(
          user.emailAddresses[0]?.emailAddress || '',
          totpSecret
        ),
        backupCodes,
      }
    } catch (error) {
      console.error('Error enabling two-factor authentication:', error)

      await this.logSecurityEvent({
        userId,
        event: 'two_factor_enable_failed',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          attemptedAt: new Date(),
          ipAddress: ipAddress || 'unknown',
        },
      })

      throw new Error('Failed to enable two-factor authentication')
    }
  }

  /**
   * Disable two-factor authentication for a user
   * @param userId - Clerk user ID
   */
  static async disableTwoFactor(userId: string): Promise<void> {
    try {
      // Update user record in database
      await prisma.user.update({
        where: { clerkId: userId },
        data: {
          twoFactorEnabled: false,
          updatedAt: new Date(),
        },
      })

      // Log security event
      await this.logSecurityEvent({
        userId,
        event: 'two_factor_disabled',
        metadata: { disabledAt: new Date() },
      })
    } catch (error) {
      console.error('Error disabling two-factor authentication:', error)
      throw new Error('Failed to disable two-factor authentication')
    }
  }

  /**
   * Verify two-factor authentication token
   * @param userId - Clerk user ID
   * @param token - TOTP token or backup code
   * @param type - Type of verification ('totp' or 'backup_code')
   * @param ipAddress - Client IP address
   * @returns Promise<TwoFactorVerificationResult>
   */
  static async verifyTwoFactor(
    userId: string,
    token: string,
    type: 'totp' | 'backup_code' = 'totp',
    ipAddress?: string
  ): Promise<TwoFactorVerificationResult> {
    try {
      let isValid = false
      let usedBackupCode = false

      if (type === 'backup_code') {
        // Verify backup code
        isValid = await this.verifyBackupCode(userId, token)
        usedBackupCode = isValid
      } else {
        // Verify TOTP token
        const clerk = await clerkClient()
        const user = await clerk.users.getUser(userId)

        if (!user) {
          throw new Error('User not found')
        }

        const privateMetadata = user.privateMetadata as Record<string, unknown>
        const totpSecret = privateMetadata?.totpSecret as string

        if (!totpSecret) {
          throw new Error('TOTP not configured for user')
        }

        isValid = this.verifyTOTPToken(totpSecret, token)
      }

      // Log verification attempt
      await this.logSecurityEvent({
        userId,
        event: isValid
          ? 'two_factor_verification_success'
          : 'two_factor_verification_failed',
        metadata: {
          success: isValid,
          type,
          verifiedAt: new Date(),
          usedBackupCode,
          ipAddress: ipAddress || 'unknown',
          token: token.substring(0, 2) + '****', // Log partial token for debugging
        },
      })

      // Update user's last 2FA verification time if successful
      if (isValid) {
        await prisma.user.update({
          where: { clerkId: userId },
          data: { updatedAt: new Date() },
        })
      }

      return {
        success: isValid,
        type,
        usedBackupCode,
        message: isValid
          ? 'Two-factor authentication verified successfully'
          : 'Invalid two-factor authentication code',
      }
    } catch (error) {
      console.error('Error verifying two-factor token:', error)

      // Log failed verification
      await this.logSecurityEvent({
        userId,
        event: 'two_factor_verification_error',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error',
          type,
          attemptedAt: new Date(),
          ipAddress: ipAddress || 'unknown',
        },
      })

      return {
        success: false,
        type,
        usedBackupCode: false,
        message: 'Two-factor authentication verification failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get user's active sessions
   * @param userId - Clerk user ID
   * @returns Promise<SessionInfo[]>
   */
  static async getUserSessions(userId: string): Promise<SessionInfo[]> {
    try {
      const clerk = await clerkClient()
      const sessions = await clerk.sessions.getSessionList({ userId })

      return sessions.data.map((session) => ({
        id: session.id,
        userId: session.userId || '',
        status: session.status,
        lastActiveAt: new Date(session.lastActiveAt),
        createdAt: new Date(session.createdAt),
        expireAt: new Date(session.expireAt),
        ipAddress: 'Unknown', // Clerk doesn't expose IP in session list
        userAgent: 'Unknown', // Clerk doesn't expose user agent in session list
      }))
    } catch (error) {
      console.error('Error getting user sessions:', error)
      throw new Error('Failed to retrieve user sessions')
    }
  }

  /**
   * Revoke a specific session
   * @param sessionId - Session ID to revoke
   */
  static async revokeSession(sessionId: string): Promise<void> {
    try {
      const clerk = await clerkClient()
      await clerk.sessions.revokeSession(sessionId)

      // Log session revocation
      await this.logSecurityEvent({
        userId: '', // Will be filled by webhook
        event: 'session_revoked_manually',
        metadata: {
          sessionId,
          revokedAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error revoking session:', error)
      throw new Error('Failed to revoke session')
    }
  }

  /**
   * Revoke all sessions for a user except current
   * @param userId - Clerk user ID
   * @param currentSessionId - Current session ID to preserve
   */
  static async revokeAllOtherSessions(
    userId: string,
    currentSessionId?: string
  ): Promise<void> {
    try {
      const sessions = await this.getUserSessions(userId)

      for (const session of sessions) {
        if (session.id !== currentSessionId && session.status === 'active') {
          await this.revokeSession(session.id)
        }
      }

      // Log bulk session revocation
      await this.logSecurityEvent({
        userId,
        event: 'all_sessions_revoked',
        metadata: {
          revokedAt: new Date(),
          preservedSession: currentSessionId,
          revokedCount: sessions.filter((s) => s.id !== currentSessionId)
            .length,
        },
      })
    } catch (error) {
      console.error('Error revoking all sessions:', error)
      throw new Error('Failed to revoke sessions')
    }
  }

  /**
   * Update user role with authorization check
   * @param targetUserId - User ID to update
   * @param newRole - New role to assign
   * @param adminUserId - Admin user ID performing the action
   */
  static async updateUserRole(
    targetUserId: string,
    newRole: UserRole,
    adminUserId: string
  ): Promise<void> {
    try {
      // Verify admin has permission to change roles
      const adminUser = await prisma.user.findUnique({
        where: { clerkId: adminUserId },
        select: { role: true },
      })

      if (!adminUser || adminUser.role !== 'ADMIN') {
        throw new Error('Insufficient permissions to change user roles')
      }

      // Update user role in database
      await prisma.user.update({
        where: { clerkId: targetUserId },
        data: {
          role: newRole,
          updatedAt: new Date(),
        },
      })

      // Update role in Clerk metadata
      const clerk = await clerkClient()
      await clerk.users.updateUserMetadata(targetUserId, {
        publicMetadata: { role: newRole },
      })

      // Log role change
      await this.logSecurityEvent({
        userId: targetUserId,
        event: 'role_changed',
        metadata: {
          newRole,
          changedBy: adminUserId,
          changedAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error updating user role:', error)
      throw new Error('Failed to update user role')
    }
  }

  /**
   * Check if user has required role
   * @param userId - Clerk user ID
   * @param requiredRole - Required role
   * @returns Promise<boolean>
   */
  static async hasRole(
    userId: string,
    requiredRole: UserRole
  ): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true },
      })

      if (!user) {
        return false
      }

      // Role hierarchy: ADMIN > EDITOR > USER
      const roleHierarchy = { USER: 1, EDITOR: 2, ADMIN: 3 }

      return roleHierarchy[user.role] >= roleHierarchy[requiredRole]
    } catch (error) {
      console.error('Error checking user role:', error)
      return false
    }
  }

  /**
   * Require specific role for access
   * @param userId - Clerk user ID
   * @param requiredRole - Required role
   * @throws Error if user doesn't have required role
   */
  static async requireRole(
    userId: string,
    requiredRole: UserRole
  ): Promise<void> {
    const hasRequiredRole = await this.hasRole(userId, requiredRole)

    if (!hasRequiredRole) {
      // Log unauthorized access attempt
      await this.logSecurityEvent({
        userId,
        event: 'unauthorized_access_attempt',
        metadata: {
          requiredRole,
          attemptedAt: new Date(),
        },
      })

      throw new Error(`Access denied. Required role: ${requiredRole}`)
    }
  }

  /**
   * Log security events for monitoring
   * @param event - Security event data
   */
  private static async logSecurityEvent(event: SecurityEvent): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId: event.userId,
          activity: event.event,
          metadata: event.metadata as Prisma.JsonObject,
          createdAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error logging security event:', error)
      // Don't throw to avoid breaking main flow
    }
  }

  /**
   * Get security events for a user
   * @param userId - User ID
   * @param limit - Number of events to retrieve
   * @returns Promise<SecurityEvent[]>
   */
  static async getSecurityEvents(
    userId: string,
    limit = 50
  ): Promise<SecurityEvent[]> {
    try {
      const activities = await prisma.userActivity.findMany({
        where: {
          userId,
          activity: {
            in: [
              'two_factor_enabled',
              'two_factor_disabled',
              'two_factor_verification_success',
              'two_factor_verification_failed',
              'two_factor_verification_error',
              'two_factor_enable_failed',
              'backup_code_used',
              'backup_codes_regenerated',
              'session_revoked_manually',
              'all_sessions_revoked',
              'role_changed',
              'unauthorized_access_attempt',
              'suspicious_login',
              'password_changed',
              'security_policy_enforced',
              'profile_synced',
            ],
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      })

      return activities.map((activity) => ({
        userId: activity.userId,
        event: activity.activity,
        metadata: activity.metadata as Record<string, unknown>,
        timestamp: activity.createdAt,
      }))
    } catch (error) {
      console.error('Error getting security events:', error)
      return []
    }
  }

  /**
   * Generate backup codes for two-factor authentication
   * @returns Array of backup codes
   */
  private static generateBackupCodes(): string[] {
    const codes: string[] = []
    for (let i = 0; i < 10; i++) {
      // Generate 8-character alphanumeric codes
      const code = Math.random().toString(36).substring(2, 10).toUpperCase()
      codes.push(code)
    }
    return codes
  }

  /**
   * Store encrypted backup codes for a user
   * @param userId - User ID
   * @param codes - Backup codes to store
   */
  private static async storeBackupCodes(
    userId: string,
    codes: string[]
  ): Promise<void> {
    try {
      // In a real implementation, these would be hashed/encrypted
      const hashedCodes = codes.map((code) => ({
        code: this.hashBackupCode(code),
        used: false,
        createdAt: new Date(),
      }))

      // Store in user activity as metadata (in production, use a dedicated table)
      await this.logSecurityEvent({
        userId,
        event: 'backup_codes_generated',
        metadata: {
          codesCount: codes.length,
          generatedAt: new Date(),
          codes: hashedCodes, // Store hashed versions
        },
      })
    } catch (error) {
      console.error('Error storing backup codes:', error)
    }
  }

  /**
   * Verify a backup code
   * @param userId - User ID
   * @param code - Backup code to verify
   * @returns Promise<boolean>
   */
  private static async verifyBackupCode(
    userId: string,
    code: string
  ): Promise<boolean> {
    try {
      // Get stored backup codes
      const backupCodesActivity = await prisma.userActivity.findFirst({
        where: {
          userId,
          activity: 'backup_codes_generated',
        },
        orderBy: { createdAt: 'desc' },
      })

      if (!backupCodesActivity) {
        return false
      }

      const metadata = backupCodesActivity.metadata as Record<string, unknown>
      const storedCodes = metadata.codes as Array<{
        code: string
        used: boolean
        createdAt: string
      }>

      const hashedCode = this.hashBackupCode(code)
      const matchingCode = storedCodes.find(
        (c) => c.code === hashedCode && !c.used
      )

      if (matchingCode) {
        // Mark code as used
        matchingCode.used = true

        // Update the activity record
        await prisma.userActivity.update({
          where: { id: backupCodesActivity.id },
          data: {
            metadata: {
              ...metadata,
              codes: storedCodes,
            },
          },
        })

        // Log backup code usage
        await this.logSecurityEvent({
          userId,
          event: 'backup_code_used',
          metadata: {
            usedAt: new Date(),
            remainingCodes: storedCodes.filter((c) => !c.used).length,
          },
        })

        return true
      }

      return false
    } catch (error) {
      console.error('Error verifying backup code:', error)
      return false
    }
  }

  /**
   * Hash a backup code for secure storage
   * @param code - Backup code to hash
   * @returns Hashed code
   */
  private static hashBackupCode(code: string): string {
    // In production, use a proper hashing library like bcrypt
    // This is a simplified implementation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const crypto = require('crypto')
    return crypto.createHash('sha256').update(code).digest('hex')
  }

  /**
   * Regenerate backup codes for a user
   * @param userId - User ID
   * @returns Promise<string[]>
   */
  static async regenerateBackupCodes(userId: string): Promise<string[]> {
    try {
      const newCodes = this.generateBackupCodes()
      await this.storeBackupCodes(userId, newCodes)

      await this.logSecurityEvent({
        userId,
        event: 'backup_codes_regenerated',
        metadata: {
          regeneratedAt: new Date(),
          codesCount: newCodes.length,
        },
      })

      return newCodes
    } catch (error) {
      console.error('Error regenerating backup codes:', error)
      throw new Error('Failed to regenerate backup codes')
    }
  }

  /**
   * Generate TOTP secret for two-factor authentication
   * @returns Base32 encoded secret
   */
  private static generateTOTPSecret(): string {
    // Generate 20 random bytes for TOTP secret
    const buffer = crypto.randomBytes(20)

    // Convert to base32 (simplified implementation)
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let result = ''
    let bits = 0
    let value = 0

    for (let i = 0; i < buffer.length; i++) {
      value = (value << 8) | buffer[i]
      bits += 8

      while (bits >= 5) {
        result += base32chars[(value >>> (bits - 5)) & 31]
        bits -= 5
      }
    }

    if (bits > 0) {
      result += base32chars[(value << (5 - bits)) & 31]
    }

    return result
  }

  /**
   * Generate QR code URL for TOTP setup
   * @param email - User email
   * @param secret - TOTP secret
   * @returns QR code URL
   */
  private static generateQRCodeURL(email: string, secret: string): string {
    const issuer = 'QuillHaven'
    const label = `${issuer}:${email}`
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: 'SHA1',
      digits: '6',
      period: '30',
    })

    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`
  }

  /**
   * Verify TOTP token
   * @param secret - TOTP secret
   * @param token - User provided token
   * @param window - Time window for validation (default: 1)
   * @returns boolean
   */
  private static verifyTOTPToken(
    secret: string,
    token: string,
    window = 1
  ): boolean {
    // Convert base32 secret to buffer (simplified)
    const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
    let bits = 0
    let value = 0
    const output = []

    for (let i = 0; i < secret.length; i++) {
      const char = secret[i].toUpperCase()
      const index = base32chars.indexOf(char)
      if (index === -1) continue

      value = (value << 5) | index
      bits += 5

      if (bits >= 8) {
        output.push((value >>> (bits - 8)) & 255)
        bits -= 8
      }
    }

    const secretBuffer = Buffer.from(output)
    const timeStep = Math.floor(Date.now() / 1000 / 30)

    // Check current time and adjacent time windows
    for (let i = -window; i <= window; i++) {
      const time = timeStep + i
      const timeBuffer = Buffer.alloc(8)
      timeBuffer.writeUInt32BE(Math.floor(time / 0x100000000), 0)
      timeBuffer.writeUInt32BE(time & 0xffffffff, 4)

      const hmac = crypto.createHmac('sha1', secretBuffer)
      hmac.update(timeBuffer)
      const hash = hmac.digest()

      const offset = hash[hash.length - 1] & 0xf
      const code =
        ((hash[offset] & 0x7f) << 24) |
        ((hash[offset + 1] & 0xff) << 16) |
        ((hash[offset + 2] & 0xff) << 8) |
        (hash[offset + 3] & 0xff)

      const otp = (code % 1000000).toString().padStart(6, '0')

      if (otp === token) {
        return true
      }
    }

    return false
  }

  /**
   * Detect suspicious login patterns
   * @param userId - User ID
   * @param ipAddress - Current IP address
   * @param userAgent - Current user agent
   */
  static async detectSuspiciousLogin(
    userId: string,
    ipAddress: string,
    userAgent: string
  ): Promise<SuspiciousLoginResult> {
    try {
      // Get recent login activities
      const recentLogins = await prisma.userActivity.findMany({
        where: {
          userId,
          activity: 'session_created',
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      })

      const suspiciousFactors: string[] = []

      // Check for new IP address
      const knownIPs = recentLogins
        .map((login) => login.metadata as Record<string, unknown>)
        .filter((meta) => meta?.ipAddress)
        .map((meta) => meta.ipAddress as string)

      if (knownIPs.length > 0 && !knownIPs.includes(ipAddress)) {
        suspiciousFactors.push('new_ip_address')
      }

      // Check for new user agent
      const knownUserAgents = recentLogins
        .map((login) => login.metadata as Record<string, unknown>)
        .filter((meta) => meta?.userAgent)
        .map((meta) => meta.userAgent as string)

      if (knownUserAgents.length > 0 && !knownUserAgents.includes(userAgent)) {
        suspiciousFactors.push('new_user_agent')
      }

      // Check for rapid login attempts
      const recentAttempts = recentLogins.filter(
        (login) =>
          new Date(login.createdAt).getTime() > Date.now() - 60 * 60 * 1000 // Last hour
      )

      if (recentAttempts.length > 5) {
        suspiciousFactors.push('rapid_login_attempts')
      }

      const isSuspicious = suspiciousFactors.length > 0

      if (isSuspicious) {
        await this.logSecurityEvent({
          userId,
          event: 'suspicious_login',
          metadata: {
            factors: suspiciousFactors,
            ipAddress,
            userAgent,
            detectedAt: new Date(),
          },
        })
      }

      return {
        isSuspicious,
        factors: suspiciousFactors,
        riskLevel: suspiciousFactors.length >= 2 ? 'high' : 'medium',
      }
    } catch (error) {
      console.error('Error detecting suspicious login:', error)
      return {
        isSuspicious: false,
        factors: [],
        riskLevel: 'low',
      }
    }
  }
}

/**
 * Type definitions for security service
 */
export interface TwoFactorSetup {
  success: boolean
  message?: string
  secret?: string
  qrCode?: string
  backupCodes?: string[]
}

export interface TwoFactorVerificationResult {
  success: boolean
  type: 'totp' | 'backup_code'
  usedBackupCode: boolean
  message: string
  error?: string
}

export interface SessionInfo {
  id: string
  userId: string
  status: string
  lastActiveAt: Date
  createdAt: Date
  expireAt: Date
  ipAddress: string
  userAgent: string
}

export interface SecurityEvent {
  userId: string
  event: string
  metadata: Record<string, unknown>
  timestamp?: Date
}

export interface SuspiciousLoginResult {
  isSuspicious: boolean
  factors: string[]
  riskLevel: 'low' | 'medium' | 'high'
}

/**
 * Role-based access control decorator
 * @param requiredRole - Required role for access
 */
export function requireRole(requiredRole: UserRole) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value

    descriptor.value = async function (...args: unknown[]) {
      const { userId } = await auth()

      if (!userId) {
        throw new Error('Authentication required')
      }

      await SecurityService.requireRole(userId, requiredRole)

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}
