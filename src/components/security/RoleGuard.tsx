'use client'

import { ReactNode, useEffect, useState, useCallback } from 'react'
import { useAuth } from '@clerk/nextjs'
import { UserRole } from '@/generated/prisma'

interface RoleGuardProps {
  children: ReactNode
  requiredRole: UserRole
  fallback?: ReactNode
  allowedRoles?: UserRole[]
}

interface UserRoleInfo {
  role: UserRole
  permissions: string[]
  canManageUsers: boolean
  canEditContent: boolean
  canViewAnalytics: boolean
}

export function RoleGuard({
  children,
  requiredRole,
  fallback = null,
  allowedRoles,
}: RoleGuardProps) {
  const { userId, isLoaded } = useAuth()
  const [userRole, setUserRole] = useState<UserRoleInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    if (isLoaded && userId) {
      loadUserRole()
    } else if (isLoaded && !userId) {
      setLoading(false)
    }
  }, [isLoaded, userId])

  const loadUserRole = async () => {
    try {
      const response = await fetch('/api/auth/roles')

      if (!response.ok) {
        throw new Error('Failed to load user role')
      }

      const roleInfo = await response.json()
      setUserRole(roleInfo)
    } catch (error) {
      console.error('Error loading user role:', error)
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  const checkAccess = useCallback(() => {
    if (!userRole) {
      setHasAccess(false)
      return
    }

    // Role hierarchy: ADMIN > EDITOR > USER
    const roleHierarchy: Record<UserRole, number> = {
      USER: 1,
      EDITOR: 2,
      ADMIN: 3,
    }

    const userRoleLevel = roleHierarchy[userRole.role]
    const requiredRoleLevel = roleHierarchy[requiredRole]

    // Check if user has required role level or higher
    let hasRequiredRole = userRoleLevel >= requiredRoleLevel

    // If specific allowed roles are provided, check against those
    if (allowedRoles && allowedRoles.length > 0) {
      hasRequiredRole = allowedRoles.includes(userRole.role)
    }

    setHasAccess(hasRequiredRole)
  }, [userRole, requiredRole, allowedRoles])

  useEffect(() => {
    if (userRole) {
      checkAccess()
    }
  }, [userRole, checkAccess])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-600"></div>
        <span className="ml-2 text-sm text-gray-600">
          Checking permissions...
        </span>
      </div>
    )
  }

  if (!userId) {
    return (
      fallback || (
        <div className="p-4 text-center">
          <p className="text-red-600">Authentication required</p>
        </div>
      )
    )
  }

  if (!hasAccess) {
    return (
      fallback || (
        <div className="p-4 text-center">
          <p className="text-red-600">
            Access denied. Required role: {requiredRole}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Your current role: {userRole?.role || 'Unknown'}
          </p>
        </div>
      )
    )
  }

  return <>{children}</>
}

// Hook for checking permissions in components
export function useRoleAccess() {
  const { userId, isLoaded } = useAuth()
  const [userRole, setUserRole] = useState<UserRoleInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && userId) {
      loadUserRole()
    } else if (isLoaded && !userId) {
      setLoading(false)
    }
  }, [isLoaded, userId])

  const loadUserRole = async () => {
    try {
      const response = await fetch('/api/auth/roles')

      if (!response.ok) {
        throw new Error('Failed to load user role')
      }

      const roleInfo = await response.json()
      setUserRole(roleInfo)
    } catch (error) {
      console.error('Error loading user role:', error)
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  const hasRole = (requiredRole: UserRole): boolean => {
    if (!userRole) return false

    const roleHierarchy: Record<UserRole, number> = {
      USER: 1,
      EDITOR: 2,
      ADMIN: 3,
    }

    const userRoleLevel = roleHierarchy[userRole.role]
    const requiredRoleLevel = roleHierarchy[requiredRole]

    return userRoleLevel >= requiredRoleLevel
  }

  const hasPermission = (permission: string): boolean => {
    if (!userRole) return false
    return userRole.permissions.includes(permission)
  }

  const hasAnyRole = (roles: UserRole[]): boolean => {
    if (!userRole) return false
    return roles.includes(userRole.role)
  }

  return {
    userRole,
    loading,
    hasRole,
    hasPermission,
    hasAnyRole,
    isAdmin: userRole?.role === 'ADMIN',
    isEditor: userRole?.role === 'EDITOR' || userRole?.role === 'ADMIN',
    isUser: !!userRole,
  }
}
