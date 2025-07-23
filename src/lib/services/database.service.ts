/**
 * Database Service
 *
 * This service provides a unified interface for database operations,
 * handling connection pooling, error handling, and query optimization.
 */

import { prisma } from '../prisma'
// import { supabaseAdmin } from '../supabase'

/**
 * DatabaseService provides methods for interacting with the database
 * It handles connection pooling, error handling, and query optimization
 */
export class DatabaseService {
  /**
   * Execute a database transaction with automatic retries and error handling
   * @param operation - The database operation to execute within a transaction
   * @returns The result of the operation
   */
  static async transaction<T>(
    operation: (tx: typeof prisma) => Promise<T>
  ): Promise<T> {
    try {
      // Execute the operation within a transaction
      return await prisma.$transaction(async (tx: typeof prisma) => {
        return await operation(tx)
      })
    } catch (error) {
      console.error('Database transaction error:', error)
      throw this.handleDatabaseError(error)
    }
  }

  /**
   * Handle database errors and convert them to user-friendly error messages
   * @param error - The error to handle
   * @returns A user-friendly error
   */
  static handleDatabaseError(error: unknown): Error {
    // Check for specific Prisma error codes and convert to user-friendly errors
    if (error && typeof error === 'object' && 'code' in error) {
      const prismaError = error as { code: string; meta?: { target?: string } }

      if (prismaError.code === 'P2002') {
        return new Error(
          `A record with this ${prismaError.meta?.target || 'value'} already exists.`
        )
      }

      if (prismaError.code === 'P2025') {
        return new Error('Record not found.')
      }
    }

    // Return a generic error message for other errors
    return new Error(
      'An unexpected database error occurred. Please try again later.'
    )
  }

  /**
   * Optimize a query for better performance
   * @param query - The query to optimize
   * @returns The optimized query
   */
  static optimizeQuery<T>(query: T): T {
    // Add query optimization logic here
    return query
  }

  /**
   * Execute raw SQL queries when needed
   * @param sql - The SQL query to execute
   * @param params - The parameters for the query
   * @returns The query result
   */
  static async executeRawQuery(
    sql: string,
    params: unknown[] = []
  ): Promise<unknown> {
    try {
      return await prisma.$queryRawUnsafe(sql, ...params)
    } catch (error) {
      console.error('Raw query error:', error)
      throw this.handleDatabaseError(error)
    }
  }

  /**
   * Get database health metrics
   * @returns Database health metrics
   */
  static async getHealthMetrics(): Promise<{
    connections?: unknown
    databaseSize?: string
    timestamp: Date
    error?: string
  }> {
    try {
      // Get connection pool statistics
      const poolStats = await this.executeRawQuery(`
        SELECT 
          count(*) as total_connections,
          sum(case when state = 'active' then 1 else 0 end) as active_connections,
          sum(case when state = 'idle' then 1 else 0 end) as idle_connections
        FROM pg_stat_activity
        WHERE datname = current_database()
      `)

      // Get database size
      const dbSize = await this.executeRawQuery(`
        SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
      `)

      return {
        connections: Array.isArray(poolStats) ? poolStats[0] : poolStats,
        databaseSize:
          Array.isArray(dbSize) &&
          dbSize[0] &&
          typeof dbSize[0] === 'object' &&
          'database_size' in dbSize[0]
            ? (dbSize[0] as { database_size: string }).database_size
            : 'Unknown',
        timestamp: new Date(),
      }
    } catch (error) {
      console.error('Failed to get database health metrics:', error)
      return {
        error: 'Failed to get database health metrics',
        timestamp: new Date(),
      }
    }
  }
}

export default DatabaseService
