import { auth, currentUser } from '@clerk/nextjs/server'
import { User } from '@clerk/nextjs/server'

/**
 * Authentication service for handling Clerk integration
 * Provides server-side authentication utilities
 */
export class AuthService {
  /**
   * Get the current authenticated user's ID
   * @returns Promise<string | null> - User ID if authenticated, null otherwise
   */
  static async getCurrentUserId(): Promise<string | null> {
    const { userId } = await auth()
    return userId && userId.trim() ? userId : null
  }

  /**
   * Get the current authenticated user object
   * @returns Promise<User | null> - Full user object if authenticated, null otherwise
   */
  static async getCurrentUser(): Promise<User | null> {
    return await currentUser()
  }

  /**
   * Check if the current request is authenticated
   * @returns Promise<boolean> - True if authenticated, false otherwise
   */
  static async isAuthenticated(): Promise<boolean> {
    const { userId } = await auth()
    return !!(userId && userId.trim())
  }

  /**
   * Protect a route by ensuring the user is authenticated
   * @throws Error if user is not authenticated
   * @returns Promise<string> - User ID if authenticated
   */
  static async requireAuth(): Promise<string> {
    const { userId } = await auth()
    if (!userId) {
      throw new Error('Authentication required')
    }
    return userId
  }

  /**
   * Get session information
   * @returns Promise<{userId: string | null, sessionId: string | null}>
   */
  static async getSession(): Promise<{
    userId: string | null
    sessionId: string | null
  }> {
    const { userId, sessionId } = await auth()
    return { userId, sessionId }
  }
}

/**
 * Type definitions for authentication
 */
export interface AuthResult {
  success: boolean
  user?: User
  error?: string
}

export interface SessionInfo {
  userId: string | null
  sessionId: string | null
  isAuthenticated: boolean
}
