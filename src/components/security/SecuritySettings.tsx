'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/nextjs'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Shield,
  Smartphone,
  Key,
  Clock,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  Copy,
  RefreshCw,
} from 'lucide-react'

interface SecurityInfo {
  sessions: Array<{
    id: string
    lastActiveAt: string
    ipAddress: string
    userAgent: string
    status: string
  }>
  securityEvents: Array<{
    event: string
    timestamp: string
    metadata: Record<string, unknown>
  }>
  sessionStats: {
    totalSessions: number
    activeSessions: number
    lastActiveAt: string | null
  }
}

interface TwoFactorSetup {
  success: boolean
  message?: string
  secret?: string
  qrCode?: string
  backupCodes?: string[]
}

export function SecuritySettings() {
  const { userId } = useAuth()
  const [securityInfo, setSecurityInfo] = useState<SecurityInfo | null>(null)
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [twoFactorSetup, setTwoFactorSetup] = useState<TwoFactorSetup | null>(
    null
  )
  const [showBackupCodes, setShowBackupCodes] = useState(false)
  const [verificationToken, setVerificationToken] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (userId) {
      loadSecurityInfo()
    }
  }, [userId])

  const loadSecurityInfo = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/security')

      if (!response.ok) {
        throw new Error('Failed to load security information')
      }

      const data = await response.json()
      setSecurityInfo(data)

      // Check if 2FA is enabled by looking at user data
      const userResponse = await fetch('/api/auth/user')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setTwoFactorEnabled(userData.twoFactorEnabled || false)
      }
    } catch (error) {
      console.error('Error loading security info:', error)
      setError('Failed to load security information')
    } finally {
      setLoading(false)
    }
  }

  const handleEnableTwoFactor = async () => {
    try {
      setActionLoading('enable_2fa')
      setError(null)

      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable_2fa' }),
      })

      if (!response.ok) {
        throw new Error('Failed to enable two-factor authentication')
      }

      const result = await response.json()
      setTwoFactorSetup(result)
      setSuccess('Two-factor authentication setup initiated')
    } catch (error) {
      console.error('Error enabling 2FA:', error)
      setError('Failed to enable two-factor authentication')
    } finally {
      setActionLoading(null)
    }
  }

  const handleVerifyTwoFactor = async () => {
    try {
      setActionLoading('verify_2fa')
      setError(null)

      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify_2fa',
          token: verificationToken,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to verify two-factor authentication')
      }

      const result = await response.json()

      if (result.valid) {
        setTwoFactorEnabled(true)
        setTwoFactorSetup(null)
        setVerificationToken('')
        setSuccess('Two-factor authentication enabled successfully')
        await loadSecurityInfo()
      } else {
        setError('Invalid verification code')
      }
    } catch (error) {
      console.error('Error verifying 2FA:', error)
      setError('Failed to verify two-factor authentication')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDisableTwoFactor = async () => {
    try {
      setActionLoading('disable_2fa')
      setError(null)

      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable_2fa' }),
      })

      if (!response.ok) {
        throw new Error('Failed to disable two-factor authentication')
      }

      setTwoFactorEnabled(false)
      setSuccess('Two-factor authentication disabled')
      await loadSecurityInfo()
    } catch (error) {
      console.error('Error disabling 2FA:', error)
      setError('Failed to disable two-factor authentication')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeSession = async (sessionId: string) => {
    try {
      setActionLoading(`revoke_${sessionId}`)
      setError(null)

      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'revoke_session',
          sessionId,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke session')
      }

      setSuccess('Session revoked successfully')
      await loadSecurityInfo()
    } catch (error) {
      console.error('Error revoking session:', error)
      setError('Failed to revoke session')
    } finally {
      setActionLoading(null)
    }
  }

  const handleRevokeAllSessions = async () => {
    try {
      setActionLoading('revoke_all')
      setError(null)

      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'revoke_all_sessions' }),
      })

      if (!response.ok) {
        throw new Error('Failed to revoke all sessions')
      }

      setSuccess('All other sessions revoked successfully')
      await loadSecurityInfo()
    } catch (error) {
      console.error('Error revoking all sessions:', error)
      setError('Failed to revoke all sessions')
    } finally {
      setActionLoading(null)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading security settings...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account with two-factor
            authentication
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Status</p>
              <p className="text-muted-foreground text-sm">
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </p>
            </div>
            <Badge variant={twoFactorEnabled ? 'default' : 'secondary'}>
              {twoFactorEnabled ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {!twoFactorEnabled && !twoFactorSetup && (
            <Button
              onClick={handleEnableTwoFactor}
              disabled={actionLoading === 'enable_2fa'}
            >
              {actionLoading === 'enable_2fa' ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Shield className="mr-2 h-4 w-4" />
              )}
              Enable Two-Factor Authentication
            </Button>
          )}

          {twoFactorSetup && (
            <div className="space-y-4 rounded-lg border p-4">
              <h4 className="font-medium">Setup Two-Factor Authentication</h4>

              {twoFactorSetup.qrCode && (
                <div className="space-y-2">
                  <p className="text-sm">
                    Scan this QR code with your authenticator app:
                  </p>
                  <div className="rounded border bg-white p-4">
                    <Image
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(twoFactorSetup.qrCode)}`}
                      alt="QR Code for 2FA setup"
                      width={200}
                      height={200}
                      className="mx-auto"
                    />
                  </div>
                </div>
              )}

              {twoFactorSetup.secret && (
                <div className="space-y-2">
                  <p className="text-sm">Or enter this secret manually:</p>
                  <div className="flex items-center gap-2">
                    <code className="bg-muted flex-1 rounded p-2 font-mono text-sm">
                      {twoFactorSetup.secret}
                    </code>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => copyToClipboard(twoFactorSetup.secret!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Enter verification code from your authenticator app:
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={verificationToken}
                    onChange={(e) => setVerificationToken(e.target.value)}
                    placeholder="000000"
                    className="flex-1 rounded-md border px-3 py-2"
                    maxLength={6}
                  />
                  <Button
                    onClick={handleVerifyTwoFactor}
                    disabled={
                      !verificationToken || actionLoading === 'verify_2fa'
                    }
                  >
                    {actionLoading === 'verify_2fa' ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      'Verify'
                    )}
                  </Button>
                </div>
              </div>

              {twoFactorSetup.backupCodes && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">Backup Codes</p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowBackupCodes(!showBackupCodes)}
                    >
                      {showBackupCodes ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {showBackupCodes && (
                    <div className="bg-muted rounded p-3">
                      <p className="text-muted-foreground mb-2 text-xs">
                        Save these backup codes in a safe place. Each can only
                        be used once.
                      </p>
                      <div className="grid grid-cols-2 gap-1 font-mono text-sm">
                        {twoFactorSetup.backupCodes.map((code, index) => (
                          <div key={index} className="p-1">
                            {code}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {twoFactorEnabled && (
            <Button
              variant="destructive"
              onClick={handleDisableTwoFactor}
              disabled={actionLoading === 'disable_2fa'}
            >
              {actionLoading === 'disable_2fa' ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <AlertTriangle className="mr-2 h-4 w-4" />
              )}
              Disable Two-Factor Authentication
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active login sessions across different devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {securityInfo?.sessionStats && (
            <div className="bg-muted grid grid-cols-2 gap-4 rounded-lg p-4">
              <div>
                <p className="text-sm font-medium">Total Sessions</p>
                <p className="text-2xl font-bold">
                  {securityInfo.sessionStats.totalSessions}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Active Sessions</p>
                <p className="text-2xl font-bold">
                  {securityInfo.sessionStats.activeSessions}
                </p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {securityInfo?.sessions?.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {session.userAgent.includes('Chrome')
                      ? 'Chrome'
                      : session.userAgent.includes('Firefox')
                        ? 'Firefox'
                        : session.userAgent.includes('Safari')
                          ? 'Safari'
                          : 'Unknown Browser'}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {session.ipAddress} • Last active:{' '}
                    {new Date(session.lastActiveAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      session.status === 'active' ? 'default' : 'secondary'
                    }
                  >
                    {session.status}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleRevokeSession(session.id)}
                    disabled={actionLoading === `revoke_${session.id}`}
                  >
                    {actionLoading === `revoke_${session.id}` ? (
                      <RefreshCw className="h-3 w-3 animate-spin" />
                    ) : (
                      'Revoke'
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {securityInfo?.sessions && securityInfo.sessions.length > 1 && (
            <>
              <Separator />
              <Button
                variant="destructive"
                onClick={handleRevokeAllSessions}
                disabled={actionLoading === 'revoke_all'}
              >
                {actionLoading === 'revoke_all' ? (
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Revoke All Other Sessions
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
          <CardDescription>
            Monitor recent security-related activities on your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityInfo?.securityEvents?.map((event, index) => (
              <div
                key={index}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {event.event
                      .replace(/_/g, ' ')
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {new Date(event.timestamp).toLocaleString()}
                  </p>
                </div>
                <Badge variant="outline">
                  {event.event.includes('success')
                    ? 'Success'
                    : event.event.includes('failed')
                      ? 'Failed'
                      : 'Info'}
                </Badge>
              </div>
            ))}

            {(!securityInfo?.securityEvents ||
              securityInfo.securityEvents.length === 0) && (
              <p className="text-muted-foreground py-4 text-center">
                No recent security events
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
