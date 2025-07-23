/**
 * Database Service Tests
 *
 * This file contains tests for the DatabaseService class.
 */

import { DatabaseService } from './database.service'
import { prisma } from '../prisma'

// Mock Prisma client
jest.mock('../prisma', () => ({
  prisma: {
    $transaction: jest.fn((callback) => callback()),
    $queryRawUnsafe: jest.fn(),
  },
}))

describe('DatabaseService', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('transaction', () => {
    it('should execute operations within a transaction', async () => {
      const mockOperation = jest.fn().mockResolvedValue('result')

      const result = await DatabaseService.transaction(mockOperation)

      expect(prisma.$transaction).toHaveBeenCalled()
      expect(mockOperation).toHaveBeenCalled()
      expect(result).toBe('result')
    })

    it('should handle transaction errors', async () => {
      const mockError = new Error('Transaction error')
      const mockOperation = jest.fn().mockRejectedValue(mockError)

      await expect(DatabaseService.transaction(mockOperation)).rejects.toThrow()
    })
  })

  describe('handleDatabaseError', () => {
    it('should handle unique constraint violations', () => {
      const prismaError = {
        code: 'P2002',
        meta: { target: 'email' },
      }

      const error = DatabaseService.handleDatabaseError(prismaError)

      expect(error.message).toContain('email already exists')
    })

    it('should handle record not found errors', () => {
      const prismaError = {
        code: 'P2025',
      }

      const error = DatabaseService.handleDatabaseError(prismaError)

      expect(error.message).toBe('Record not found.')
    })

    it('should handle generic errors', () => {
      const genericError = new Error('Some error')

      const error = DatabaseService.handleDatabaseError(genericError)

      expect(error.message).toContain('unexpected database error')
    })
  })

  describe('executeRawQuery', () => {
    it('should execute raw SQL queries', async () => {
      const mockResult = [{ count: 5 }]
      ;(prisma.$queryRawUnsafe as jest.Mock).mockResolvedValue(mockResult)

      const result = await DatabaseService.executeRawQuery(
        'SELECT COUNT(*) as count FROM users'
      )

      expect(prisma.$queryRawUnsafe).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM users'
      )
      expect(result).toBe(mockResult)
    })

    it('should handle raw query errors', async () => {
      const mockError = new Error('Query error')
      ;(prisma.$queryRawUnsafe as jest.Mock).mockRejectedValue(mockError)

      await expect(
        DatabaseService.executeRawQuery('INVALID SQL')
      ).rejects.toThrow()
    })
  })

  describe('getHealthMetrics', () => {
    it('should return database health metrics', async () => {
      const mockPoolStats = [
        {
          total_connections: 10,
          active_connections: 3,
          idle_connections: 7,
        },
      ]

      const mockDbSize = [
        {
          database_size: '100 MB',
        },
      ]

      // Mock the first call to executeRawQuery (pool stats)
      ;(DatabaseService.executeRawQuery as jest.Mock) = jest
        .fn()
        .mockResolvedValueOnce(mockPoolStats)
        .mockResolvedValueOnce(mockDbSize)

      const result = await DatabaseService.getHealthMetrics()

      expect(result).toHaveProperty('connections')
      expect(result).toHaveProperty('databaseSize')
      expect(result).toHaveProperty('timestamp')
      expect(result.connections).toBe(mockPoolStats[0])
      expect(result.databaseSize).toBe('100 MB')
    })

    it('should handle errors when getting health metrics', async () => {
      const mockError = new Error('Health metrics error')
      ;(DatabaseService.executeRawQuery as jest.Mock) = jest
        .fn()
        .mockRejectedValue(mockError)

      const result = await DatabaseService.getHealthMetrics()

      expect(result).toHaveProperty('error')
      expect(result).toHaveProperty('timestamp')
      expect(result.error).toContain('Failed to get database health metrics')
    })
  })
})
