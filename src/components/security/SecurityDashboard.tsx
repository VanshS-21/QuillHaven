'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

import {
  Shield,
  Smartphone,
  Monitor,
  AlertTriangle,
  CheckCircle,
  Eye,
  EyeOff,
  RefreshCw,
} from 'lucide-react'

interface SecurityData {
  sessions: SessionInfo[]
  securityEvents: SecurityEvent[]
  sessionStats: SessionStatistics
}

interface SessionInfo {
  id: string
  userId: string
  status: string
  lastActiveAt: Date
  createdAt: Date
  expireAt: Date
  ipAddress: string
  userAgent: string
}

interface SecurityEvent {
  userId: string
  event: string
  metadata: Record<string, unknown>
  timestamp: Date
}

interface SessionStatistics {
  totalSessions: number
  activeSessions: number
  recentActivity: number
  lastActiveAt: Date | null
  lastIpAddress: string | null
}

export function SecurityDashboard() {
  const { user } = useUser()
  const [securityData, setSecurityData] = useState<SecurityData | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [showSensitiveInfo, setShowSensitiveInfo] = useState(false)

  useEffect(() => {
    fetchSecurityData()
  }, [])

  const fetchSecurityData = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/auth/security')
      if (response.ok) {
        const data = await response.json()
        setSecurityData(data)
      }
    } catch (error) {
      console.error('Error fetching security data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSecurityAction = async (
    action: string,
    params?: Record<string, unknown>
  ) => {
    try {
      setActionLoading(action)
      const response = await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      })

      if (response.ok) {
        const result = await response.json()

        if (action === 'enable_2fa' && result.success) {
          // Show 2FA setup modal with QR code
          alert(
            `2FA enabled! Secret: ${result.secret}\nQR Code: ${result.qrCode}`
          )
        }

        await fetchSecurityData() // Refresh data
      } else {
        const error = await response.json()
        alert(`Error: ${error.error}`)
      }
    } catch (error) {
      console.error('Error performing security action:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setActionLoading(null)
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleString()
  }

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'two_factor_enabled':
      case 'two_factor_verification':
        return <Shield className="h-4 w-4 text-green-500" />
      case 'session_created':
        return <Monitor className="h-4 w-4 text-blue-500" />
      case 'suspicious_login':
      case 'unauthorized_access_attempt':
        return <AlertTriangle className="h-4 w-4 text-red-500" />
      default:
        return <CheckCircle className="h-4 w-4 text-gray-500" />
    }
  }

  const getEventDescription = (event: SecurityEvent) => {
    switch (event.event) {
      case 'two_factor_enabled':
        return 'Two-factor authentication was enabled'
      case 'two_factor_disabled':
        return 'Two-factor authentication was disabled'
      case 'two_factor_verification':
        return `2FA verification ${event.metadata.success ? 'succeeded' : 'failed'}`
      case 'session_created':
        return `New session created from ${event.metadata.ipAddress || 'unknown IP'}`
      case 'session_ended':
        return `Session ended (${event.metadata.reason || 'unknown reason'})`
      case 'suspicious_login':
        return `Suspicious login detected: ${(event.metadata.factors as string[])?.join(', ') || 'multiple factors'}`
      case 'unauthorized_access_attempt':
        return `Unauthorized access attempt (required: ${event.metadata.requiredRole})`
      default:
        return event.event.replace(/_/g, ' ')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading security information...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Security Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Security Overview
          </CardTitle>
          <CardDescription>
            Manage your account security settings and monitor activity
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {securityData?.sessionStats.activeSessions || 0}
              </div>
              <div className="text-sm text-gray-600">Active Sessions</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-green-600">
                {securityData?.sessionStats.recentActivity || 0}
              </div>
              <div className="text-sm text-gray-600">Recent Activity</div>
            </div>
            <div className="rounded-lg bg-gray-50 p-4 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </div>
              <div className="text-sm text-gray-600">Two-Factor Auth</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Two-Factor Authentication */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Two-Factor Authentication
          </CardTitle>
          <CardDescription>
            Add an extra layer of security to your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">Two-Factor Authentication</div>
              <div className="text-sm text-gray-600">
                {user?.twoFactorEnabled
                  ? 'Your account is protected with 2FA'
                  : 'Enable 2FA to secure your account'}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={user?.twoFactorEnabled ? 'default' : 'secondary'}>
                {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </Badge>
              <Button
                variant={user?.twoFactorEnabled ? 'destructive' : 'default'}
                size="sm"
                onClick={() =>
                  handleSecurityAction(
                    user?.twoFactorEnabled ? 'disable_2fa' : 'enable_2fa'
                  )
                }
                disabled={
                  actionLoading === 'enable_2fa' ||
                  actionLoading === 'disable_2fa'
                }
              >
                {actionLoading === 'enable_2fa' ||
                actionLoading === 'disable_2fa'
                  ? 'Processing...'
                  : user?.twoFactorEnabled
                    ? 'Disable'
                    : 'Enable'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Active Sessions
          </CardTitle>
          <CardDescription>
            Manage your active login sessions across devices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSensitiveInfo(!showSensitiveInfo)}
            >
              {showSensitiveInfo ? (
                <>
                  <EyeOff className="mr-2 h-4 w-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Show Details
                </>
              )}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => handleSecurityAction('revoke_all_sessions')}
              disabled={actionLoading === 'revoke_all_sessions'}
            >
              {actionLoading === 'revoke_all_sessions'
                ? 'Revoking...'
                : 'Revoke All Other Sessions'}
            </Button>
          </div>

          <div className="space-y-3">
            {securityData?.sessions.map((session) => (
              <div
                key={session.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Monitor className="h-4 w-4" />
                    <span className="font-medium">
                      {session.userAgent.includes('Mobile')
                        ? 'Mobile Device'
                        : 'Desktop'}
                    </span>
                    <Badge
                      variant={
                        session.status === 'active' ? 'default' : 'secondary'
                      }
                    >
                      {session.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-sm text-gray-600">
                    Last active: {formatDate(session.lastActiveAt)}
                  </div>
                  {showSensitiveInfo && (
                    <div className="mt-1 text-xs text-gray-500">
                      IP: {session.ipAddress} • {session.userAgent}
                    </div>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    handleSecurityAction('revoke_session', {
                      sessionId: session.id,
                    })
                  }
                  disabled={actionLoading === 'revoke_session'}
                >
                  Revoke
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Security Events */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Recent Security Events
          </CardTitle>
          <CardDescription>
            Monitor security-related activities on your account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {securityData?.securityEvents.slice(0, 10).map((event, index) => (
              <div
                key={index}
                className="flex items-start gap-3 rounded-lg border p-3"
              >
                {getEventIcon(event.event)}
                <div className="flex-1">
                  <div className="font-medium">
                    {getEventDescription(event)}
                  </div>
                  <div className="text-sm text-gray-600">
                    {formatDate(event.timestamp)}
                  </div>
                </div>
              </div>
            ))}

            {(!securityData?.securityEvents ||
              securityData.securityEvents.length === 0) && (
              <div className="py-8 text-center text-gray-500">
                No security events recorded
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Security Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Security Actions</CardTitle>
          <CardDescription>
            Additional security management options
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            variant="outline"
            onClick={() => handleSecurityAction('enforce_policies')}
            disabled={actionLoading === 'enforce_policies'}
            className="w-full"
          >
            {actionLoading === 'enforce_policies'
              ? 'Enforcing...'
              : 'Enforce Security Policies'}
          </Button>

          <Button
            variant="outline"
            onClick={fetchSecurityData}
            disabled={loading}
            className="w-full"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`}
            />
            Refresh Security Data
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
