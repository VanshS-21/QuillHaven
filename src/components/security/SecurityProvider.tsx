'use client'

import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
  useCallback,
} from 'react'
import { useAuth } from '@clerk/nextjs'
import { SecurityConfig } from '@/lib/config/security'

interface SecurityContextType {
  securityConfig: SecurityConfig
  enforceSecurityPolicies: () => Promise<void>
  syncProfile: () => Promise<void>
}

const SecurityContext = createContext<SecurityContextType | null>(null)

interface SecurityProviderProps {
  children: ReactNode
  securityConfig: SecurityConfig
}

export function SecurityProvider({
  children,
  securityConfig,
}: SecurityProviderProps) {
  const { userId, sessionId } = useAuth()

  const enforceSecurityPolicies = useCallback(async () => {
    if (!userId) return

    try {
      await fetch('/api/auth/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enforce_policies' }),
      })
    } catch (error) {
      console.error('Error enforcing security policies:', error)
    }
  }, [userId])

  const syncUserProfile = useCallback(async () => {
    if (!userId) return

    try {
      await fetch('/api/auth/profile-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ direction: 'bidirectional' }),
      })
    } catch (error) {
      console.error('Error syncing user profile:', error)
    }
  }, [userId])

  const updateSessionActivity = useCallback(async () => {
    if (!sessionId) return

    try {
      // Update session activity timestamp
      await fetch('/api/auth/session/activity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
    } catch (error) {
      console.error('Error updating session activity:', error)
    }
  }, [sessionId])

  // Enforce security policies on authentication
  useEffect(() => {
    if (userId && sessionId) {
      enforceSecurityPolicies()
      syncUserProfile()
    }
  }, [userId, sessionId, enforceSecurityPolicies, syncUserProfile])

  // Monitor session activity
  useEffect(() => {
    if (userId && sessionId) {
      const interval = setInterval(() => {
        updateSessionActivity()
      }, 60000) // Update every minute

      return () => clearInterval(interval)
    }
  }, [userId, sessionId, updateSessionActivity])

  const contextValue: SecurityContextType = {
    securityConfig,
    enforceSecurityPolicies,
    syncProfile: syncUserProfile,
  }

  return (
    <SecurityContext.Provider value={contextValue}>
      {children}
    </SecurityContext.Provider>
  )
}

export function useSecurity() {
  const context = useContext(SecurityContext)
  if (!context) {
    throw new Error('useSecurity must be used within a SecurityProvider')
  }
  return context
}
