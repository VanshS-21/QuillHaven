import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { SecurityService } from '@/lib/services/security'
import { SessionService } from '@/lib/services/session'

/**
 * GET /api/auth/security
 * Get user's security settings and status
 */
export async function GET() {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get security information
    const [sessions, securityEvents, sessionStats] = await Promise.all([
      SecurityService.getUserSessions(userId),
      SecurityService.getSecurityEvents(userId, 10),
      SessionService.getSessionStatistics(userId),
    ])

    return NextResponse.json({
      sessions,
      securityEvents,
      sessionStats,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error getting security information:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve security information' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/auth/security
 * Update security settings
 */
export async function POST(req: NextRequest) {
  try {
    const { userId, sessionId } = await auth()

    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { action, ...params } = body

    // Extract client information for security logging
    const ipAddress =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown'

    switch (action) {
      case 'enable_2fa':
        const twoFactorSetup = await SecurityService.enableTwoFactor(
          userId,
          ipAddress
        )
        return NextResponse.json(twoFactorSetup)

      case 'disable_2fa':
        await SecurityService.disableTwoFactor(userId)
        return NextResponse.json({ success: true, message: '2FA disabled' })

      case 'verify_2fa':
        const verificationResult = await SecurityService.verifyTwoFactor(
          userId,
          params.token,
          params.type || 'totp',
          ipAddress
        )
        return NextResponse.json({ valid: verificationResult.success })

      case 'regenerate_backup_codes':
        const newBackupCodes =
          await SecurityService.regenerateBackupCodes(userId)
        return NextResponse.json({
          success: true,
          backupCodes: newBackupCodes,
          message: 'Backup codes regenerated successfully',
        })

      case 'revoke_session':
        await SecurityService.revokeSession(params.sessionId)
        return NextResponse.json({ success: true, message: 'Session revoked' })

      case 'revoke_all_sessions':
        await SecurityService.revokeAllOtherSessions(
          userId,
          sessionId || undefined
        )
        return NextResponse.json({
          success: true,
          message: 'All other sessions revoked',
        })

      case 'enforce_policies':
        const policyResult =
          await SessionService.enforceSecurityPolicies(userId)
        return NextResponse.json(policyResult)

      case 'check_suspicious_login':
        const userAgent = req.headers.get('user-agent') || 'unknown'
        const suspiciousResult = await SecurityService.detectSuspiciousLogin(
          userId,
          ipAddress,
          userAgent
        )
        return NextResponse.json(suspiciousResult)

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }
  } catch (error) {
    console.error('Error updating security settings:', error)
    return NextResponse.json(
      { error: 'Failed to update security settings' },
      { status: 500 }
    )
  }
}
