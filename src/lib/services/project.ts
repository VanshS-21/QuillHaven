/**
 * Project Management Service
 *
 * Handles all project-related CRUD operations with proper validation,
 * error handling, and user authorization.
 */

import {
  PrismaClient,
  Prisma,
  Project,
  ProjectStatus,
  ProjectVisibility,
} from '@/generated/prisma'
import { prisma } from '../prisma'

// Types for project operations
export interface CreateProjectData {
  title: string
  description?: string
  genre?: string
  targetWordCount?: number
  isPublic?: boolean
  tags?: string[]
  templateId?: string
}

export interface ProjectUpdates {
  title?: string
  description?: string
  genre?: string
  targetWordCount?: number
  status?: ProjectStatus
  visibility?: ProjectVisibility
  tags?: string[]
  settings?: Record<string, unknown>
}

export interface ProjectFilters {
  status?: ProjectStatus
  visibility?: ProjectVisibility
  genre?: string
  tags?: string[]
  isArchived?: boolean
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ProjectSummary {
  id: string
  title: string
  description?: string
  genre?: string
  status: ProjectStatus
  visibility: ProjectVisibility
  currentWordCount: number
  targetWordCount?: number
  progressPercentage: number
  isArchived: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
  lastAccessedAt: Date
}

export interface ProjectSearchResult {
  id: string
  title: string
  description?: string
  genre?: string
  tags: string[]
  relevanceScore: number
}

export interface ShareSettings {
  visibility: ProjectVisibility
  allowComments?: boolean
  allowCollaboration?: boolean
  expiresAt?: Date
}

export interface ShareResult {
  shareId: string
  shareUrl: string
  expiresAt?: Date
}

export interface ProjectPermissions {
  canRead: boolean
  canWrite: boolean
  canDelete: boolean
  canShare: boolean
}

export interface ProjectStatistics {
  totalWords: number
  totalChapters: number
  completedChapters: number
  averageWordsPerChapter: number
  writingStreak: number
  totalWritingTime: number
  sessionsCount: number
  lastWritingSession?: Date
  progressPercentage: number
  dailyWordCounts: Array<{
    date: Date
    wordsWritten: number
    timeSpent: number
    chaptersWorked: number
  }>
}

export interface ProjectActivity {
  id: string
  action: string
  timestamp: Date
  metadata: Record<string, unknown>
}

// Error types
export class ProjectError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message)
    this.name = 'ProjectError'
  }
}

export class ProjectNotFoundError extends ProjectError {
  constructor(projectId: string) {
    super(`Project with ID ${projectId} not found`, 'PROJECT_NOT_FOUND', 404)
  }
}

export class ProjectAccessDeniedError extends ProjectError {
  constructor(projectId: string) {
    super(`Access denied to project ${projectId}`, 'PROJECT_ACCESS_DENIED', 403)
  }
}

export class ProjectValidationError extends ProjectError {
  constructor(message: string) {
    super(message, 'PROJECT_VALIDATION_ERROR', 400)
  }
}

/**
 * Project Management Service Class
 */
export class ProjectManagementService {
  private prisma: PrismaClient

  constructor(prismaClient: PrismaClient = prisma) {
    this.prisma = prismaClient
  }

  /**
   * Create a new project
   */
  async createProject(
    userId: string,
    projectData: CreateProjectData
  ): Promise<Project> {
    try {
      // Validate input data
      this.validateCreateProjectData(projectData)

      // Prepare project data with defaults
      const data: Prisma.ProjectCreateInput = {
        title: projectData.title.trim(),
        description: projectData.description?.trim(),
        genre: projectData.genre?.trim(),
        targetWordCount: projectData.targetWordCount,
        visibility: projectData.isPublic
          ? ProjectVisibility.PUBLIC
          : ProjectVisibility.PRIVATE,
        tags: projectData.tags || [],
        settings: {
          autoSave: true,
          autoSaveInterval: 30,
          spellCheck: true,
          grammarCheck: true,
          aiAssistance: true,
          collaborationEnabled: false,
          exportFormats: ['docx', 'pdf'],
          backupEnabled: true,
          versionControl: true,
        },
        user: {
          connect: { id: userId },
        },
        statistics: {
          create: {
            totalWords: 0,
            totalChapters: 0,
            completedChapters: 0,
            averageWordsPerChapter: 0,
            writingStreak: 0,
            totalWritingTime: 0,
            sessionsCount: 0,
            progressPercentage: 0,
            dailyWordCounts: [],
          },
        },
      }

      const project = await this.prisma.project.create({
        data,
        include: {
          statistics: true,
        },
      })

      return project
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new ProjectValidationError(
            'A project with this title already exists'
          )
        }
        if (error.code === 'P2003') {
          throw new ProjectValidationError('Invalid user ID provided')
        }
      }

      if (error instanceof ProjectError) {
        throw error
      }

      throw new ProjectError(
        'Failed to create project',
        'PROJECT_CREATE_FAILED'
      )
    }
  }

  /**
   * Get a project by ID with user authorization
   */
  async getProject(projectId: string, userId: string): Promise<Project> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: userId },
            { visibility: ProjectVisibility.PUBLIC },
            { visibility: ProjectVisibility.SHARED },
          ],
        },
        include: {
          statistics: true,
        },
      })

      if (!project) {
        throw new ProjectNotFoundError(projectId)
      }

      // Update last accessed time if user owns the project
      if (project.userId === userId) {
        await this.prisma.project.update({
          where: { id: projectId },
          data: { lastAccessedAt: new Date() },
        })
      }

      return project
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }

      throw new ProjectError(
        'Failed to retrieve project',
        'PROJECT_RETRIEVE_FAILED'
      )
    }
  }

  /**
   * Update a project with optimistic locking
   */
  async updateProject(
    projectId: string,
    userId: string,
    updates: ProjectUpdates
  ): Promise<Project> {
    try {
      // First verify the project exists and user has access
      const existingProject = await this.getProject(projectId, userId)

      if (existingProject.userId !== userId) {
        throw new ProjectAccessDeniedError(projectId)
      }

      // Validate updates
      this.validateProjectUpdates(updates)

      // Prepare update data
      const updateData: Prisma.ProjectUpdateInput = {
        ...(updates.title && { title: updates.title.trim() }),
        ...(updates.description !== undefined && {
          description: updates.description?.trim(),
        }),
        ...(updates.genre !== undefined && { genre: updates.genre?.trim() }),
        ...(updates.targetWordCount !== undefined && {
          targetWordCount: updates.targetWordCount,
        }),
        ...(updates.status && { status: updates.status }),
        ...(updates.visibility && { visibility: updates.visibility }),
        ...(updates.tags && { tags: updates.tags }),
        ...(updates.settings && {
          settings: updates.settings as Record<string, unknown>,
        }),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      }

      const updatedProject = await this.prisma.project.update({
        where: {
          id: projectId,
          updatedAt: existingProject.updatedAt, // Optimistic locking
        },
        data: updateData,
        include: {
          statistics: true,
        },
      })

      return updatedProject
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new ProjectError(
            'Project was modified by another process. Please refresh and try again.',
            'PROJECT_CONFLICT',
            409
          )
        }
        if (error.code === 'P2002') {
          throw new ProjectValidationError(
            'A project with this title already exists'
          )
        }
      }

      if (error instanceof ProjectError) {
        throw error
      }

      throw new ProjectError(
        'Failed to update project',
        'PROJECT_UPDATE_FAILED'
      )
    }
  }

  /**
   * Delete a project with soft delete and recovery
   */
  async deleteProject(projectId: string, userId: string): Promise<void> {
    try {
      // Verify project exists and user has access
      const project = await this.getProject(projectId, userId)

      if (project.userId !== userId) {
        throw new ProjectAccessDeniedError(projectId)
      }

      // Soft delete by archiving
      await this.prisma.project.update({
        where: { id: projectId },
        data: {
          isArchived: true,
          updatedAt: new Date(),
        },
      })
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }

      throw new ProjectError(
        'Failed to delete project',
        'PROJECT_DELETE_FAILED'
      )
    }
  }

  /**
   * List user projects with filtering and pagination
   */
  async listUserProjects(
    userId: string,
    filters: ProjectFilters = {}
  ): Promise<ProjectSummary[]> {
    try {
      const {
        status,
        visibility,
        genre,
        tags,
        isArchived = false,
        search,
        limit = 50,
        offset = 0,
        sortBy = 'updatedAt',
        sortOrder = 'desc',
      } = filters

      // Build where clause
      const where: Prisma.ProjectWhereInput = {
        userId,
        isArchived,
        ...(status && { status }),
        ...(visibility && { visibility }),
        ...(genre && { genre: { contains: genre, mode: 'insensitive' } }),
        ...(tags && tags.length > 0 && { tags: { hasSome: tags } }),
        ...(search && {
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { description: { contains: search, mode: 'insensitive' } },
            { genre: { contains: search, mode: 'insensitive' } },
          ],
        }),
      }

      const projects = await this.prisma.project.findMany({
        where,
        include: {
          statistics: true,
        },
        orderBy: { [sortBy]: sortOrder },
        take: limit,
        skip: offset,
      })

      return projects.map((project) => ({
        id: project.id,
        title: project.title,
        description: project.description || undefined,
        genre: project.genre || undefined,
        status: project.status,
        visibility: project.visibility,
        currentWordCount: project.currentWordCount,
        targetWordCount: project.targetWordCount || undefined,
        progressPercentage: project.statistics?.progressPercentage || 0,
        isArchived: project.isArchived,
        tags: project.tags,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        lastAccessedAt: project.lastAccessedAt,
      }))
    } catch (error) {
      console.error('Failed to list projects:', error)
      throw new ProjectError('Failed to list projects', 'PROJECT_LIST_FAILED')
    }
  }

  /**
   * Search projects with full-text search
   */
  async searchProjects(
    userId: string,
    query: string
  ): Promise<ProjectSearchResult[]> {
    try {
      if (!query.trim()) {
        return []
      }

      const projects = await this.prisma.project.findMany({
        where: {
          userId,
          isArchived: false,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { description: { contains: query, mode: 'insensitive' } },
            { genre: { contains: query, mode: 'insensitive' } },
            { tags: { hasSome: [query] } },
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

      // Simple relevance scoring based on matches
      return projects
        .map((project) => {
          let relevanceScore = 0
          const lowerQuery = query.toLowerCase()

          if (project.title.toLowerCase().includes(lowerQuery))
            relevanceScore += 3
          if (project.description?.toLowerCase().includes(lowerQuery))
            relevanceScore += 2
          if (project.genre?.toLowerCase().includes(lowerQuery))
            relevanceScore += 1
          if (
            project.tags.some((tag) => tag.toLowerCase().includes(lowerQuery))
          )
            relevanceScore += 1

          return {
            id: project.id,
            title: project.title,
            description: project.description || undefined,
            genre: project.genre || undefined,
            tags: project.tags,
            relevanceScore,
          }
        })
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
    } catch (error) {
      console.error('Failed to search projects:', error)
      throw new ProjectError(
        'Failed to search projects',
        'PROJECT_SEARCH_FAILED'
      )
    }
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string, userId: string): Promise<void> {
    try {
      await this.updateProject(projectId, userId, {
        // Using settings to track archive status since isArchived is handled separately
      })

      await this.prisma.project.update({
        where: { id: projectId, userId },
        data: { isArchived: true, updatedAt: new Date() },
      })
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw new ProjectError(
        'Failed to archive project',
        'PROJECT_ARCHIVE_FAILED'
      )
    }
  }

  /**
   * Restore an archived project
   */
  async restoreProject(projectId: string, userId: string): Promise<void> {
    try {
      const project = await this.prisma.project.findFirst({
        where: { id: projectId, userId, isArchived: true },
      })

      if (!project) {
        throw new ProjectNotFoundError(projectId)
      }

      await this.prisma.project.update({
        where: { id: projectId },
        data: { isArchived: false, updatedAt: new Date() },
      })
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw new ProjectError(
        'Failed to restore project',
        'PROJECT_RESTORE_FAILED'
      )
    }
  }

  /**
   * Duplicate a project
   */
  async duplicateProject(
    projectId: string,
    userId: string,
    newTitle: string
  ): Promise<Project> {
    try {
      const originalProject = await this.getProject(projectId, userId)

      if (originalProject.userId !== userId) {
        throw new ProjectAccessDeniedError(projectId)
      }

      const duplicateData: CreateProjectData = {
        title: newTitle,
        description: originalProject.description || undefined,
        genre: originalProject.genre || undefined,
        targetWordCount: originalProject.targetWordCount || undefined,
        isPublic: originalProject.visibility === ProjectVisibility.PUBLIC,
        tags: [...originalProject.tags],
      }

      return await this.createProject(userId, duplicateData)
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw new ProjectError(
        'Failed to duplicate project',
        'PROJECT_DUPLICATE_FAILED'
      )
    }
  }

  /**
   * Get project statistics
   */
  async getProjectStatistics(
    projectId: string,
    userId: string
  ): Promise<ProjectStatistics> {
    try {
      const project = await this.prisma.project.findFirst({
        where: {
          id: projectId,
          OR: [
            { userId: userId },
            { visibility: ProjectVisibility.PUBLIC },
            { visibility: ProjectVisibility.SHARED },
          ],
        },
        include: {
          statistics: true,
        },
      })

      if (!project) {
        throw new ProjectNotFoundError(projectId)
      }

      if (!project.statistics) {
        throw new ProjectError(
          'Project statistics not found',
          'PROJECT_STATS_NOT_FOUND',
          404
        )
      }

      return {
        totalWords: project.statistics.totalWords,
        totalChapters: project.statistics.totalChapters,
        completedChapters: project.statistics.completedChapters,
        averageWordsPerChapter: project.statistics.averageWordsPerChapter,
        writingStreak: project.statistics.writingStreak,
        totalWritingTime: project.statistics.totalWritingTime,
        sessionsCount: project.statistics.sessionsCount,
        lastWritingSession: project.statistics.lastWritingSession || undefined,
        progressPercentage: project.statistics.progressPercentage,
        dailyWordCounts: Array.isArray(project.statistics.dailyWordCounts)
          ? (project.statistics.dailyWordCounts as unknown as Array<{
              date: Date
              wordsWritten: number
              timeSpent: number
              chaptersWorked: number
            }>)
          : [],
      }
    } catch (error) {
      if (error instanceof ProjectError) {
        throw error
      }
      throw new ProjectError(
        'Failed to get project statistics',
        'PROJECT_STATS_FAILED'
      )
    }
  }

  // Private validation methods
  private validateCreateProjectData(data: CreateProjectData): void {
    if (!data.title || data.title.trim().length === 0) {
      throw new ProjectValidationError('Project title is required')
    }

    if (data.title.trim().length > 200) {
      throw new ProjectValidationError(
        'Project title must be less than 200 characters'
      )
    }

    if (data.description && data.description.length > 2000) {
      throw new ProjectValidationError(
        'Project description must be less than 2000 characters'
      )
    }

    if (
      data.targetWordCount &&
      (data.targetWordCount < 1 || data.targetWordCount > 10000000)
    ) {
      throw new ProjectValidationError(
        'Target word count must be between 1 and 10,000,000'
      )
    }

    if (data.tags && data.tags.length > 20) {
      throw new ProjectValidationError('Maximum 20 tags allowed')
    }
  }

  private validateProjectUpdates(updates: ProjectUpdates): void {
    if (updates.title !== undefined) {
      if (!updates.title || updates.title.trim().length === 0) {
        throw new ProjectValidationError('Project title cannot be empty')
      }
      if (updates.title.trim().length > 200) {
        throw new ProjectValidationError(
          'Project title must be less than 200 characters'
        )
      }
    }

    if (
      updates.description !== undefined &&
      updates.description &&
      updates.description.length > 2000
    ) {
      throw new ProjectValidationError(
        'Project description must be less than 2000 characters'
      )
    }

    if (
      updates.targetWordCount !== undefined &&
      updates.targetWordCount !== null
    ) {
      if (updates.targetWordCount < 1 || updates.targetWordCount > 10000000) {
        throw new ProjectValidationError(
          'Target word count must be between 1 and 10,000,000'
        )
      }
    }

    if (updates.tags && updates.tags.length > 20) {
      throw new ProjectValidationError('Maximum 20 tags allowed')
    }
  }
}

// Export singleton instance
export const projectService = new ProjectManagementService()
