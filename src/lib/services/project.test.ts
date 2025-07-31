/**
 * Project Management Service Tests
 *
 * Comprehensive unit tests for project CRUD operations
 */

import {
  ProjectManagementService,
  ProjectError,
  ProjectNotFoundError,
  ProjectAccessDeniedError,
  ProjectValidationError,
} from './project'
import {
  PrismaClient,
  ProjectStatus,
  ProjectVisibility,
} from '@/generated/prisma'
import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended'

// Mock Prisma Client
jest.mock('../prisma', () => ({
  prisma: mockDeep<PrismaClient>(),
}))

describe('ProjectManagementService', () => {
  let service: ProjectManagementService
  let mockPrisma: DeepMockProxy<PrismaClient>

  const mockUserId = 'user-123'
  const mockProjectId = 'project-123'

  const mockProject = {
    id: mockProjectId,
    userId: mockUserId,
    title: 'Test Project',
    description: 'Test Description',
    genre: 'Fiction',
    targetWordCount: 50000,
    currentWordCount: 0,
    status: ProjectStatus.DRAFT,
    visibility: ProjectVisibility.PRIVATE,
    isArchived: false,
    tags: ['test', 'novel'],
    settings: {
      autoSave: true,
      autoSaveInterval: 30,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    lastAccessedAt: new Date(),
    statistics: {
      id: 'stats-123',
      projectId: mockProjectId,
      totalWords: 0,
      totalChapters: 0,
      completedChapters: 0,
      averageWordsPerChapter: 0,
      writingStreak: 0,
      totalWritingTime: 0,
      sessionsCount: 0,
      lastWritingSession: null,
      progressPercentage: 0,
      dailyWordCounts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  }

  beforeEach(() => {
    mockPrisma = mockDeep<PrismaClient>()
    service = new ProjectManagementService(mockPrisma)
    mockReset(mockPrisma)
  })

  describe('createProject', () => {
    const validProjectData = {
      title: 'New Project',
      description: 'A new project description',
      genre: 'Fantasy',
      targetWordCount: 80000,
      isPublic: false,
      tags: ['fantasy', 'adventure'],
    }

    it('should create a project successfully', async () => {
      mockPrisma.project.create.mockResolvedValue(mockProject)

      const result = await service.createProject(mockUserId, validProjectData)

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: validProjectData.title,
          description: validProjectData.description,
          genre: validProjectData.genre,
          targetWordCount: validProjectData.targetWordCount,
          visibility: ProjectVisibility.PRIVATE,
          tags: validProjectData.tags,
          user: { connect: { id: mockUserId } },
          statistics: { create: expect.any(Object) },
        }),
        include: { statistics: true },
      })
      expect(result).toEqual(mockProject)
    })

    it('should throw validation error for empty title', async () => {
      const invalidData = { ...validProjectData, title: '' }

      await expect(
        service.createProject(mockUserId, invalidData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should throw validation error for title too long', async () => {
      const invalidData = { ...validProjectData, title: 'a'.repeat(201) }

      await expect(
        service.createProject(mockUserId, invalidData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should throw validation error for description too long', async () => {
      const invalidData = { ...validProjectData, description: 'a'.repeat(2001) }

      await expect(
        service.createProject(mockUserId, invalidData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should throw validation error for invalid target word count', async () => {
      const invalidData = { ...validProjectData, targetWordCount: -1 }

      await expect(
        service.createProject(mockUserId, invalidData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should throw validation error for too many tags', async () => {
      const invalidData = { ...validProjectData, tags: Array(21).fill('tag') }

      await expect(
        service.createProject(mockUserId, invalidData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should handle unique constraint violation', async () => {
      const prismaError = new Error('Unique constraint violation')
      ;(prismaError as any).code = 'P2002'
      mockPrisma.project.create.mockRejectedValue(prismaError)

      await expect(
        service.createProject(mockUserId, validProjectData)
      ).rejects.toThrow(ProjectValidationError)
    })

    it('should handle foreign key constraint violation', async () => {
      const prismaError = new Error('Foreign key constraint violation')
      ;(prismaError as any).code = 'P2003'
      mockPrisma.project.create.mockRejectedValue(prismaError)

      await expect(
        service.createProject(mockUserId, validProjectData)
      ).rejects.toThrow(ProjectValidationError)
    })
  })

  describe('getProject', () => {
    it('should get project successfully for owner', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
      mockPrisma.project.update.mockResolvedValue(mockProject)

      const result = await service.getProject(mockProjectId, mockUserId)

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProjectId,
          OR: [
            { userId: mockUserId },
            { visibility: ProjectVisibility.PUBLIC },
            { visibility: ProjectVisibility.SHARED },
          ],
        },
        include: { statistics: true },
      })
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { lastAccessedAt: expect.any(Date) },
      })
      expect(result).toEqual(mockProject)
    })

    it('should get public project for non-owner', async () => {
      const publicProject = {
        ...mockProject,
        userId: 'other-user',
        visibility: ProjectVisibility.PUBLIC,
      }
      mockPrisma.project.findFirst.mockResolvedValue(publicProject)

      const result = await service.getProject(mockProjectId, mockUserId)

      expect(result).toEqual(publicProject)
      expect(mockPrisma.project.update).not.toHaveBeenCalled()
    })

    it('should throw not found error for non-existent project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null)

      await expect(
        service.getProject(mockProjectId, mockUserId)
      ).rejects.toThrow(ProjectNotFoundError)
    })
  })

  describe('updateProject', () => {
    const validUpdates = {
      title: 'Updated Title',
      description: 'Updated description',
      status: ProjectStatus.IN_PROGRESS,
    }

    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
    })

    it('should update project successfully', async () => {
      const updatedProject = { ...mockProject, ...validUpdates }
      mockPrisma.project.update.mockResolvedValue(updatedProject)

      const result = await service.updateProject(
        mockProjectId,
        mockUserId,
        validUpdates
      )

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: {
          id: mockProjectId,
          updatedAt: mockProject.updatedAt,
        },
        data: expect.objectContaining({
          title: validUpdates.title,
          description: validUpdates.description,
          status: validUpdates.status,
          updatedAt: expect.any(Date),
          lastAccessedAt: expect.any(Date),
        }),
        include: { statistics: true },
      })
      expect(result).toEqual(updatedProject)
    })

    it('should throw access denied error for non-owner', async () => {
      const otherUserProject = { ...mockProject, userId: 'other-user' }
      mockPrisma.project.findFirst.mockResolvedValue(otherUserProject)

      await expect(
        service.updateProject(mockProjectId, mockUserId, validUpdates)
      ).rejects.toThrow(ProjectAccessDeniedError)
    })

    it('should handle optimistic locking conflict', async () => {
      const prismaError = new Error('Record not found')
      ;(prismaError as any).code = 'P2025'
      mockPrisma.project.update.mockRejectedValue(prismaError)

      await expect(
        service.updateProject(mockProjectId, mockUserId, validUpdates)
      ).rejects.toThrow(ProjectError)
    })

    it('should validate title updates', async () => {
      const invalidUpdates = { title: '' }

      await expect(
        service.updateProject(mockProjectId, mockUserId, invalidUpdates)
      ).rejects.toThrow(ProjectValidationError)
    })
  })

  describe('deleteProject', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
    })

    it('should delete project successfully (soft delete)', async () => {
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        isArchived: true,
      })

      await service.deleteProject(mockProjectId, mockUserId)

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: {
          isArchived: true,
          updatedAt: expect.any(Date),
        },
      })
    })

    it('should throw access denied error for non-owner', async () => {
      const otherUserProject = { ...mockProject, userId: 'other-user' }
      mockPrisma.project.findFirst.mockResolvedValue(otherUserProject)

      await expect(
        service.deleteProject(mockProjectId, mockUserId)
      ).rejects.toThrow(ProjectAccessDeniedError)
    })
  })

  describe('listUserProjects', () => {
    const mockProjects = [
      mockProject,
      { ...mockProject, id: 'project-456', title: 'Another Project' },
    ]

    it('should list projects with default filters', async () => {
      mockPrisma.project.findMany.mockResolvedValue(mockProjects)

      const result = await service.listUserProjects(mockUserId)

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isArchived: false,
        },
        include: { statistics: true },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        skip: 0,
      })
      expect(result).toHaveLength(2)
      expect(result[0]).toMatchObject({
        id: mockProject.id,
        title: mockProject.title,
        status: mockProject.status,
      })
    })

    it('should apply filters correctly', async () => {
      const filters = {
        status: ProjectStatus.IN_PROGRESS,
        genre: 'Fantasy',
        tags: ['adventure'],
        search: 'test',
        limit: 10,
        offset: 5,
        sortBy: 'title' as const,
        sortOrder: 'asc' as const,
      }

      mockPrisma.project.findMany.mockResolvedValue([])

      await service.listUserProjects(mockUserId, filters)

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isArchived: false,
          status: ProjectStatus.IN_PROGRESS,
          genre: { contains: 'Fantasy', mode: 'insensitive' },
          tags: { hasSome: ['adventure'] },
          OR: [
            { title: { contains: 'test', mode: 'insensitive' } },
            { description: { contains: 'test', mode: 'insensitive' } },
            { genre: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        include: { statistics: true },
        orderBy: { title: 'asc' },
        take: 10,
        skip: 5,
      })
    })
  })

  describe('searchProjects', () => {
    it('should search projects successfully', async () => {
      const searchResults = [
        {
          id: 'project-1',
          title: 'Fantasy Adventure',
          description: 'Epic quest',
          genre: 'Fantasy',
          tags: ['adventure'],
          userId: mockUserId,
          status: ProjectStatus.DRAFT,
          visibility: ProjectVisibility.PRIVATE,
          currentWordCount: 0,
          targetWordCount: null,
          isArchived: false,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        },
        {
          id: 'project-2',
          title: 'Space Opera',
          description: 'Galactic war',
          genre: 'Sci-Fi',
          tags: ['space'],
          userId: mockUserId,
          status: ProjectStatus.DRAFT,
          visibility: ProjectVisibility.PRIVATE,
          currentWordCount: 0,
          targetWordCount: null,
          isArchived: false,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date(),
          lastAccessedAt: new Date(),
        },
      ]
      mockPrisma.project.findMany.mockResolvedValue(searchResults as any)

      const result = await service.searchProjects(mockUserId, 'fantasy')

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isArchived: false,
          OR: [
            { title: { contains: 'fantasy', mode: 'insensitive' } },
            { description: { contains: 'fantasy', mode: 'insensitive' } },
            { genre: { contains: 'fantasy', mode: 'insensitive' } },
            { tags: { hasSome: ['fantasy'] } },
          ],
        },
        select: {
          id: true,
          title: true,
          description: true,
          genre: true,
          tags: true,
        },
      })
      expect(result).toHaveLength(2)
      expect(result[0].relevanceScore).toBeGreaterThan(0)
    })

    it('should return empty array for empty query', async () => {
      const result = await service.searchProjects(mockUserId, '')
      expect(result).toEqual([])
    })
  })

  describe('archiveProject', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
    })

    it('should archive project successfully', async () => {
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        isArchived: true,
      })

      await service.archiveProject(mockProjectId, mockUserId)

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId, userId: mockUserId },
        data: { isArchived: true, updatedAt: expect.any(Date) },
      })
    })
  })

  describe('restoreProject', () => {
    it('should restore archived project successfully', async () => {
      const archivedProject = { ...mockProject, isArchived: true }
      mockPrisma.project.findFirst.mockResolvedValue(archivedProject)
      mockPrisma.project.update.mockResolvedValue({
        ...archivedProject,
        isArchived: false,
      })

      await service.restoreProject(mockProjectId, mockUserId)

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: { id: mockProjectId, userId: mockUserId, isArchived: true },
      })
      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { isArchived: false, updatedAt: expect.any(Date) },
      })
    })

    it('should throw not found error for non-archived project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null)

      await expect(
        service.restoreProject(mockProjectId, mockUserId)
      ).rejects.toThrow(ProjectNotFoundError)
    })
  })

  describe('duplicateProject', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
    })

    it('should duplicate project successfully', async () => {
      const duplicatedProject = {
        ...mockProject,
        id: 'project-duplicate',
        title: 'Duplicated Project',
      }
      mockPrisma.project.create.mockResolvedValue(duplicatedProject)

      const result = await service.duplicateProject(
        mockProjectId,
        mockUserId,
        'Duplicated Project'
      )

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          title: 'Duplicated Project',
          description: mockProject.description,
          genre: mockProject.genre,
          targetWordCount: mockProject.targetWordCount,
          tags: mockProject.tags,
        }),
        include: { statistics: true },
      })
      expect(result).toEqual(duplicatedProject)
    })

    it('should throw access denied error for non-owner', async () => {
      const otherUserProject = { ...mockProject, userId: 'other-user' }
      mockPrisma.project.findFirst.mockResolvedValue(otherUserProject)

      await expect(
        service.duplicateProject(mockProjectId, mockUserId, 'Duplicate')
      ).rejects.toThrow(ProjectAccessDeniedError)
    })
  })

  describe('getProjectStatistics', () => {
    beforeEach(() => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject)
    })

    it('should get project statistics successfully', async () => {
      const result = await service.getProjectStatistics(
        mockProjectId,
        mockUserId
      )

      expect(result).toMatchObject({
        totalWords: mockProject.statistics!.totalWords,
        totalChapters: mockProject.statistics!.totalChapters,
        progressPercentage: mockProject.statistics!.progressPercentage,
      })
    })

    it('should throw error for project without statistics', async () => {
      const projectWithoutStats = { ...mockProject, statistics: null }
      mockPrisma.project.findFirst.mockResolvedValue(projectWithoutStats)

      await expect(
        service.getProjectStatistics(mockProjectId, mockUserId)
      ).rejects.toThrow(ProjectError)
    })
  })
})
