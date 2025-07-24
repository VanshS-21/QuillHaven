import { clerkClient } from '@clerk/nextjs/server'
import { prisma } from '../prisma'
import { Prisma } from '../../generated/prisma'
import { SecurityService } from './security'

/**
 * Session management service for enhanced security and monitoring
 * Handles session tracking, security policies, and user activity monitoring
 */
export class SessionService {
  /**
   * Create a new session record with security tracking
   * @param userId - Clerk user ID
   * @param sessionId - Clerk session ID
   * @param metadata - Additional session metadata
   */
  static async createSession(
    userId: string,
    sessionId: string,
    metadata: SessionMetadata
  ): Promise<void> {
    try {
      // Check for suspicious login patterns
      const suspiciousLogin = await SecurityService.detectSuspiciousLogin(
        userId,
        metadata.ipAddress || '',
        metadata.userAgent || ''
      )

      // Create session record in database
      await prisma.userSession.create({
        data: {
          userId,
          token: sessionId,
          expiresAt:
            metadata.expiresAt || new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours default
          ipAddress: metadata.ipAddress,
          userAgent: metadata.userAgent,
          isActive: true,
          createdAt: new Date(),
          lastActiveAt: new Date(),
        },
      })

      // Update user's last login time
      await prisma.user.update({
        where: { clerkId: userId },
        data: {
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        },
      })

      // Log session creation with security context
      await this.logSessionActivity({
        userId,
        sessionId,
        activity: 'session_created',
        metadata: {
          ...metadata,
          suspiciousLogin: suspiciousLogin.isSuspicious,
          riskLevel: suspiciousLogin.riskLevel,
          suspiciousFactors: suspiciousLogin.factors,
        },
      })

      // If login is suspicious, require additional verification
      if (
        suspiciousLogin.isSuspicious &&
        suspiciousLogin.riskLevel === 'high'
      ) {
        await this.requireAdditionalVerification(userId, sessionId)
      }
    } catch (error) {
      console.error('Error creating session:', error)
      throw new Error('Failed to create session')
    }
  }

  /**
   * Update session activity
   * @param sessionId - Session ID
   * @param metadata - Updated metadata
   */
  static async updateSessionActivity(
    sessionId: string,
    metadata?: Partial<SessionMetadata>
  ): Promise<void> {
    try {
      await prisma.userSession.update({
        where: { token: sessionId },
        data: {
          lastActiveAt: new Date(),
          ...(metadata?.ipAddress && { ipAddress: metadata.ipAddress }),
          ...(metadata?.userAgent && { userAgent: metadata.userAgent }),
        },
      })
    } catch (error) {
      console.error('Error updating session activity:', error)
      // Don't throw to avoid breaking main flow
    }
  }

  /**
   * End a session
   * @param sessionId - Session ID to end
   * @param reason - Reason for ending session
   */
  static async endSession(
    sessionId: string,
    reason = 'user_logout'
  ): Promise<void> {
    try {
      // Get session info before ending
      const session = await prisma.userSession.findUnique({
        where: { token: sessionId },
      })

      if (!session) {
        return
      }

      // Mark session as inactive
      await prisma.userSession.update({
        where: { token: sessionId },
        data: {
          isActive: false,
          lastActiveAt: new Date(),
        },
      })

      // Log session end
      await this.logSessionActivity({
        userId: session.userId,
        sessionId,
        activity: 'session_ended',
        metadata: {
          reason,
          duration: new Date().getTime() - session.createdAt.getTime(),
          endedAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error ending session:', error)
      throw new Error('Failed to end session')
    }
  }

  /**
   * Get active sessions for a user
   * @param userId - User ID
   * @returns Promise<UserSession[]>
   */
  static async getActiveSessions(userId: string) {
    try {
      return await prisma.userSession.findMany({
        where: {
          userId,
          isActive: true,
          expiresAt: {
            gt: new Date(),
          },
        },
        orderBy: { lastActiveAt: 'desc' },
      })
    } catch (error) {
      console.error('Error getting active sessions:', error)
      return []
    }
  }

  /**
   * Clean up expired sessions
   */
  static async cleanupExpiredSessions(): Promise<void> {
    try {
      const expiredSessions = await prisma.userSession.findMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            {
              isActive: true,
              lastActiveAt: {
                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days inactive
              },
            },
          ],
        },
      })

      for (const session of expiredSessions) {
        await this.endSession(session.token, 'expired')
      }

      console.log(`Cleaned up ${expiredSessions.length} expired sessions`)
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error)
    }
  }

  /**
   * Enforce session security policies
   * @param userId - User ID
   */
  static async enforceSecurityPolicies(
    userId: string
  ): Promise<SecurityPolicyResult> {
    try {
      const activeSessions = await this.getActiveSessions(userId)
      const violations: string[] = []
      const actions: string[] = []
      let revokedSessionsCount = 0

      // Get security configuration
      const securityConfig = await import('../config/security').then((m) =>
        m.getSecurityConfig()
      )

      // Check for too many concurrent sessions
      const maxSessions = securityConfig.session.maxConcurrentSessions
      if (activeSessions.length > maxSessions) {
        violations.push('too_many_sessions')
        actions.push(
          `Revoked ${activeSessions.length - maxSessions} oldest sessions`
        )

        // Revoke oldest sessions
        const oldestSessions = activeSessions
          .sort((a, b) => a.lastActiveAt.getTime() - b.lastActiveAt.getTime())
          .slice(0, activeSessions.length - maxSessions)

        for (const session of oldestSessions) {
          await this.endSession(
            session.token,
            'policy_violation_concurrent_limit'
          )
        }
        revokedSessionsCount += oldestSessions.length
      }

      // Check for sessions from different geographic locations
      const ipAddresses = [
        ...new Set(activeSessions.map((s) => s.ipAddress).filter(Boolean)),
      ]
      if (ipAddresses.length > 3) {
        violations.push('multiple_locations')
        actions.push(
          `Detected sessions from ${ipAddresses.length} different locations`
        )
      }

      // Check for stale sessions (inactive for too long)
      const staleThreshold =
        securityConfig.session.inactiveSessionTimeoutDays * 24 * 60 * 60 * 1000
      const staleSessions = activeSessions.filter(
        (session) =>
          new Date().getTime() - session.lastActiveAt.getTime() > staleThreshold
      )

      if (staleSessions.length > 0) {
        violations.push('stale_sessions')
        actions.push(`Revoked ${staleSessions.length} stale sessions`)

        for (const session of staleSessions) {
          await this.endSession(session.token, 'policy_violation_stale')
        }
        revokedSessionsCount += staleSessions.length
      }

      // Check for suspicious user agents
      const userAgents = activeSessions.map((s) => s.userAgent).filter(Boolean)
      const suspiciousAgents = userAgents.filter(
        (ua) =>
          ua &&
          (ua.includes('bot') ||
            ua.includes('crawler') ||
            ua.includes('spider'))
      )

      if (suspiciousAgents.length > 0) {
        violations.push('suspicious_user_agents')
        actions.push(
          `Detected ${suspiciousAgents.length} suspicious user agents`
        )
      }

      // Check for sessions that require re-authentication
      const reauthThreshold =
        securityConfig.session.requireReauthenticationHours * 60 * 60 * 1000
      const oldAuthSessions = activeSessions.filter(
        (session) =>
          new Date().getTime() - session.createdAt.getTime() > reauthThreshold
      )

      if (oldAuthSessions.length > 0) {
        violations.push('requires_reauthentication')
        actions.push(
          `${oldAuthSessions.length} sessions require re-authentication`
        )
      }

      // Log policy enforcement
      if (violations.length > 0) {
        await this.logSessionActivity({
          userId,
          sessionId: '',
          activity: 'security_policy_enforced',
          metadata: {
            violations,
            actions,
            enforcedAt: new Date(),
            sessionsRevoked: revokedSessionsCount,
            totalSessions: activeSessions.length,
            remainingSessions: activeSessions.length - revokedSessionsCount,
            securityLevel:
              process.env.NEXT_PUBLIC_SECURITY_LEVEL || 'development',
          },
        })
      }

      return {
        violations,
        actions,
        actionsPerformed: violations.length > 0,
        remainingSessions: activeSessions.length - revokedSessionsCount,
        totalSessions: activeSessions.length,
        revokedSessions: revokedSessionsCount,
      }
    } catch (error) {
      console.error('Error enforcing security policies:', error)
      return {
        violations: [],
        actions: [],
        actionsPerformed: false,
        remainingSessions: 0,
        totalSessions: 0,
        revokedSessions: 0,
      }
    }
  }

  /**
   * Require additional verification for suspicious sessions
   * @param userId - User ID
   * @param sessionId - Session ID
   */
  private static async requireAdditionalVerification(
    userId: string,
    sessionId: string
  ): Promise<void> {
    try {
      // Check if user has 2FA enabled
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { twoFactorEnabled: true, email: true },
      })

      if (user?.twoFactorEnabled) {
        // Mark session as requiring 2FA verification
        const clerk = await clerkClient()
        await clerk.sessions.getSession(sessionId)
        // Note: Clerk handles 2FA verification automatically
      } else {
        // Send security alert email
        await this.sendSecurityAlert(userId, {
          type: 'suspicious_login',
          sessionId,
          timestamp: new Date(),
        })
      }
    } catch (error) {
      console.error('Error requiring additional verification:', error)
    }
  }

  /**
   * Send security alert to user
   * @param userId - User ID
   * @param alert - Security alert data
   */
  private static async sendSecurityAlert(
    userId: string,
    alert: SecurityAlert
  ): Promise<void> {
    try {
      // Log security alert
      await this.logSessionActivity({
        userId,
        sessionId: alert.sessionId || '',
        activity: 'security_alert_sent',
        metadata: alert as unknown as Record<string, unknown>,
      })

      // TODO: Implement email service integration
      console.log(`Security alert sent to user ${userId}:`, alert)
    } catch (error) {
      console.error('Error sending security alert:', error)
    }
  }

  /**
   * Log session-related activity
   * @param activity - Session activity data
   */
  private static async logSessionActivity(
    activity: SessionActivity
  ): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId: activity.userId,
          activity: activity.activity,
          sessionId: activity.sessionId,
          metadata: activity.metadata as Prisma.JsonObject,
          createdAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error logging session activity:', error)
      // Don't throw to avoid breaking main flow
    }
  }

  /**
   * Get session statistics for a user
   * @param userId - User ID
   * @returns Promise<SessionStatistics>
   */
  static async getSessionStatistics(
    userId: string
  ): Promise<SessionStatistics> {
    try {
      const [totalSessions, activeSessions, recentActivity] = await Promise.all(
        [
          prisma.userSession.count({ where: { userId } }),
          prisma.userSession.count({
            where: {
              userId,
              isActive: true,
              expiresAt: { gt: new Date() },
            },
          }),
          prisma.userActivity.count({
            where: {
              userId,
              activity: { startsWith: 'session_' },
              createdAt: {
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            },
          }),
        ]
      )

      const lastSession = await prisma.userSession.findFirst({
        where: { userId },
        orderBy: { lastActiveAt: 'desc' },
        select: { lastActiveAt: true, ipAddress: true },
      })

      return {
        totalSessions,
        activeSessions,
        recentActivity,
        lastActiveAt: lastSession?.lastActiveAt || null,
        lastIpAddress: lastSession?.ipAddress || null,
      }
    } catch (error) {
      console.error('Error getting session statistics:', error)
      return {
        totalSessions: 0,
        activeSessions: 0,
        recentActivity: 0,
        lastActiveAt: null,
        lastIpAddress: null,
      }
    }
  }
}

/**
 * Type definitions for session service
 */
export interface SessionMetadata {
  ipAddress?: string
  userAgent?: string
  expiresAt?: Date
  location?: string
  deviceType?: string
}

export interface SessionActivity {
  userId: string
  sessionId: string
  activity: string
  metadata: Record<string, unknown>
}

export interface SecurityAlert {
  type: string
  sessionId?: string
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface SecurityPolicyResult {
  violations: string[]
  actions: string[]
  actionsPerformed: boolean
  remainingSessions: number
  totalSessions: number
  revokedSessions: number
}

export interface SessionStatistics {
  totalSessions: number
  activeSessions: number
  recentActivity: number
  lastActiveAt: Date | null
  lastIpAddress: string | null
}
