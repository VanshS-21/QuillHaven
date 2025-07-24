/**
 * Role-Based Access Control (RBAC) utilities for QuillHaven
 * Provides comprehensive role and permission management with Clerk integration
 */

import { auth } from '@clerk/nextjs/server'
import { UserRole } from '../../generated/prisma'
import { prisma } from '../prisma'

/**
 * Permission definitions for the application
 */
export const PERMISSIONS = {
  // User management
  READ_OWN_PROFILE: 'read_own_profile',
  UPDATE_OWN_PROFILE: 'update_own_profile',
  DELETE_OWN_ACCOUNT: 'delete_own_account',

  // Project management
  CREATE_PROJECTS: 'create_projects',
  READ_OWN_PROJECTS: 'read_own_projects',
  UPDATE_OWN_PROJECTS: 'update_own_projects',
  DELETE_OWN_PROJECTS: 'delete_own_projects',
  READ_ALL_PROJECTS: 'read_all_projects',
  UPDATE_ALL_PROJECTS: 'update_all_projects',
  DELETE_ALL_PROJECTS: 'delete_all_projects',

  // Content moderation
  MODERATE_CONTENT: 'moderate_content',
  REVIEW_FLAGGED_CONTENT: 'review_flagged_content',

  // Analytics and reporting
  VIEW_ANALYTICS: 'view_analytics',
  VIEW_USER_ANALYTICS: 'view_user_analytics',
  VIEW_SYSTEM_ANALYTICS: 'view_system_analytics',
  EXPORT_ANALYTICS: 'export_analytics',

  // User management (admin)
  MANAGE_USERS: 'manage_users',
  VIEW_ALL_USERS: 'view_all_users',
  UPDATE_USER_ROLES: 'update_user_roles',
  SUSPEND_USERS: 'suspend_users',
  DELETE_USERS: 'delete_users',

  // System administration
  MANAGE_SYSTEM_SETTINGS: 'manage_system_settings',
  VIEW_SYSTEM_LOGS: 'view_system_logs',
  MANAGE_SUBSCRIPTIONS: 'manage_subscriptions',
  VIEW_BILLING_DATA: 'view_billing_data',

  // Security management
  MANAGE_SECURITY_SETTINGS: 'manage_security_settings',
  VIEW_SECURITY_LOGS: 'view_security_logs',
  FORCE_PASSWORD_RESET: 'force_password_reset',
  REVOKE_USER_SESSIONS: 'revoke_user_sessions',
} as const

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS]

/**
 * Base permissions for each role
 */
const USER_PERMISSIONS: Permission[] = [
  PERMISSIONS.READ_OWN_PROFILE,
  PERMISSIONS.UPDATE_OWN_PROFILE,
  PERMISSIONS.DELETE_OWN_ACCOUNT,
  PERMISSIONS.CREATE_PROJECTS,
  PERMISSIONS.READ_OWN_PROJECTS,
  PERMISSIONS.UPDATE_OWN_PROJECTS,
  PERMISSIONS.DELETE_OWN_PROJECTS,
]

const EDITOR_PERMISSIONS: Permission[] = [
  ...USER_PERMISSIONS,
  PERMISSIONS.READ_ALL_PROJECTS,
  PERMISSIONS.MODERATE_CONTENT,
  PERMISSIONS.REVIEW_FLAGGED_CONTENT,
  PERMISSIONS.VIEW_ANALYTICS,
  PERMISSIONS.VIEW_USER_ANALYTICS,
]

const ADMIN_PERMISSIONS: Permission[] = [
  ...EDITOR_PERMISSIONS,
  PERMISSIONS.UPDATE_ALL_PROJECTS,
  PERMISSIONS.DELETE_ALL_PROJECTS,
  PERMISSIONS.MANAGE_USERS,
  PERMISSIONS.VIEW_ALL_USERS,
  PERMISSIONS.UPDATE_USER_ROLES,
  PERMISSIONS.SUSPEND_USERS,
  PERMISSIONS.DELETE_USERS,
  PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
  PERMISSIONS.VIEW_SYSTEM_LOGS,
  PERMISSIONS.MANAGE_SUBSCRIPTIONS,
  PERMISSIONS.VIEW_BILLING_DATA,
  PERMISSIONS.MANAGE_SECURITY_SETTINGS,
  PERMISSIONS.VIEW_SECURITY_LOGS,
  PERMISSIONS.FORCE_PASSWORD_RESET,
  PERMISSIONS.REVOKE_USER_SESSIONS,
  PERMISSIONS.VIEW_SYSTEM_ANALYTICS,
  PERMISSIONS.EXPORT_ANALYTICS,
]

/**
 * Role hierarchy and permissions mapping
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  USER: USER_PERMISSIONS,
  EDITOR: EDITOR_PERMISSIONS,
  ADMIN: ADMIN_PERMISSIONS,
}

/**
 * Role hierarchy levels (higher number = more permissions)
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  USER: 1,
  EDITOR: 2,
  ADMIN: 3,
}

/**
 * RBAC Service for role and permission management
 */
export class RBACService {
  /**
   * Get current user's role from session claims
   * @returns Promise<UserRole | null>
   */
  static async getCurrentUserRole(): Promise<UserRole | null> {
    try {
      const { sessionClaims } = await auth()
      const metadata = sessionClaims?.metadata as
        | Record<string, unknown>
        | undefined
      const role = metadata?.role as UserRole

      // Validate role
      if (role && Object.values(UserRole).includes(role)) {
        return role
      }

      return null
    } catch (error) {
      console.error('Error getting current user role:', error)
      return null
    }
  }

  /**
   * Get user role from database
   * @param userId - Clerk user ID
   * @returns Promise<UserRole | null>
   */
  static async getUserRole(userId: string): Promise<UserRole | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { role: true },
      })

      return user?.role || null
    } catch (error) {
      console.error('Error getting user role:', error)
      return null
    }
  }

  /**
   * Check if user has specific permission
   * @param userId - Clerk user ID
   * @param permission - Permission to check
   * @returns Promise<boolean>
   */
  static async hasPermission(
    userId: string,
    permission: Permission
  ): Promise<boolean> {
    try {
      const role = await this.getUserRole(userId)
      if (!role) return false

      const permissions = ROLE_PERMISSIONS[role]
      return permissions.includes(permission)
    } catch (error) {
      console.error('Error checking permission:', error)
      return false
    }
  }

  /**
   * Check if current user has specific permission
   * @param permission - Permission to check
   * @returns Promise<boolean>
   */
  static async currentUserHasPermission(
    permission: Permission
  ): Promise<boolean> {
    try {
      const { userId } = await auth()
      if (!userId) return false

      return this.hasPermission(userId, permission)
    } catch (error) {
      console.error('Error checking current user permission:', error)
      return false
    }
  }

  /**
   * Check if user has any of the specified permissions
   * @param userId - Clerk user ID
   * @param permissions - Array of permissions to check
   * @returns Promise<boolean>
   */
  static async hasAnyPermission(
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    try {
      for (const permission of permissions) {
        if (await this.hasPermission(userId, permission)) {
          return true
        }
      }
      return false
    } catch (error) {
      console.error('Error checking any permission:', error)
      return false
    }
  }

  /**
   * Check if user has all specified permissions
   * @param userId - Clerk user ID
   * @param permissions - Array of permissions to check
   * @returns Promise<boolean>
   */
  static async hasAllPermissions(
    userId: string,
    permissions: Permission[]
  ): Promise<boolean> {
    try {
      for (const permission of permissions) {
        if (!(await this.hasPermission(userId, permission))) {
          return false
        }
      }
      return true
    } catch (error) {
      console.error('Error checking all permissions:', error)
      return false
    }
  }

  /**
   * Check if user has required role or higher
   * @param userId - Clerk user ID
   * @param requiredRole - Minimum required role
   * @returns Promise<boolean>
   */
  static async hasRoleOrHigher(
    userId: string,
    requiredRole: UserRole
  ): Promise<boolean> {
    try {
      const userRole = await this.getUserRole(userId)
      if (!userRole) return false

      return ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[requiredRole]
    } catch (error) {
      console.error('Error checking role hierarchy:', error)
      return false
    }
  }

  /**
   * Get all permissions for a role
   * @param role - User role
   * @returns Permission[]
   */
  static getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || []
  }

  /**
   * Get all permissions for current user
   * @returns Promise<Permission[]>
   */
  static async getCurrentUserPermissions(): Promise<Permission[]> {
    try {
      const role = await this.getCurrentUserRole()
      if (!role) return []

      return this.getRolePermissions(role)
    } catch (error) {
      console.error('Error getting current user permissions:', error)
      return []
    }
  }

  /**
   * Require specific permission (throws error if not authorized)
   * @param userId - Clerk user ID
   * @param permission - Required permission
   * @throws Error if user doesn't have permission
   */
  static async requirePermission(
    userId: string,
    permission: Permission
  ): Promise<void> {
    const hasPermission = await this.hasPermission(userId, permission)

    if (!hasPermission) {
      // Log unauthorized access attempt
      await this.logUnauthorizedAccess(userId, permission)
      throw new Error(`Access denied. Required permission: ${permission}`)
    }
  }

  /**
   * Require specific role or higher (throws error if not authorized)
   * @param userId - Clerk user ID
   * @param requiredRole - Required role
   * @throws Error if user doesn't have required role
   */
  static async requireRole(
    userId: string,
    requiredRole: UserRole
  ): Promise<void> {
    const hasRole = await this.hasRoleOrHigher(userId, requiredRole)

    if (!hasRole) {
      // Log unauthorized access attempt
      await this.logUnauthorizedAccess(userId, `role:${requiredRole}`)
      throw new Error(`Access denied. Required role: ${requiredRole}`)
    }
  }

  /**
   * Log unauthorized access attempts
   * @param userId - User ID
   * @param resource - Resource or permission that was denied
   */
  private static async logUnauthorizedAccess(
    userId: string,
    resource: string
  ): Promise<void> {
    try {
      await prisma.userActivity.create({
        data: {
          userId,
          activity: 'unauthorized_access_attempt',
          metadata: {
            resource,
            attemptedAt: new Date(),
            userAgent: 'unknown', // Would be passed from request context
            ipAddress: 'unknown', // Would be passed from request context
          },
          createdAt: new Date(),
        },
      })
    } catch (error) {
      console.error('Error logging unauthorized access:', error)
    }
  }

  /**
   * Check if user can access resource based on ownership
   * @param userId - Clerk user ID
   * @param resourceUserId - Owner of the resource
   * @param permission - Permission required for non-owners
   * @returns Promise<boolean>
   */
  static async canAccessResource(
    userId: string,
    resourceUserId: string,
    permission: Permission
  ): Promise<boolean> {
    // User can always access their own resources
    if (userId === resourceUserId) {
      return true
    }

    // Check if user has permission to access others' resources
    return this.hasPermission(userId, permission)
  }
}

/**
 * Decorator for requiring specific permission
 * @param permission - Required permission
 */
export function requirePermission(permission: Permission) {
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

      await RBACService.requirePermission(userId, permission)

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Decorator for requiring specific role
 * @param role - Required role
 */
export function requireRole(role: UserRole) {
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

      await RBACService.requireRole(userId, role)

      return originalMethod.apply(this, args)
    }

    return descriptor
  }
}

/**
 * Helper function to check role from session claims (for client-side use)
 * @param role - Role to check
 * @returns boolean
 */
export async function checkRole(role: UserRole): Promise<boolean> {
  try {
    const { sessionClaims } = await auth()
    const metadata = sessionClaims?.metadata as
      | Record<string, unknown>
      | undefined
    return metadata?.role === role
  } catch (error) {
    console.error('Error checking role:', error)
    return false
  }
}

/**
 * Helper function to check permission from session claims (for client-side use)
 * @param permission - Permission to check
 * @returns boolean
 */
export async function checkPermission(
  permission: Permission
): Promise<boolean> {
  try {
    const role = await RBACService.getCurrentUserRole()
    if (!role) return false

    const permissions = ROLE_PERMISSIONS[role]
    return permissions.includes(permission)
  } catch (error) {
    console.error('Error checking permission:', error)
    return false
  }
}
