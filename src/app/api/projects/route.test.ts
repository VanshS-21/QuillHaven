/**
 * Projects API Integration Tests
 *
 * Tests for project listing and creation endpoints
 */

import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import { projectService } from '../../../lib/services/project'
import { auth } from '@clerk/nextjs/server'

// Mock dependencies
jest.mock('@clerk/nextjs/server')
jest.mock('../../../lib/services/project')

const mockAuth = auth as jest.MockedFunction<typeof auth>
const mockProjectService = projectService as jest.Mocked<typeof projectService>

describe('/api/projects', () => {
  const mockUserId = 'user-123'

  beforeEach(() => {
    jest.clearAllMocks()
    mockAuth.mockResolvedValue({ userId: mockUserId } as any)
  })

  describe('GET /api/projects', () => {
    const mockProjects = [
      {
        id: 'project-1',
        title: 'Test Project 1',
        description: 'Description 1',
        genre: 'Fantasy',
        status: 'DRAFT' as const,
        visibility: 'PRIVATE' as const,
        currentWordCount: 1000,
        targetWordCount: 50000,
        progressPercentage: 2,
        isArchived: false,
        tags: ['fantasy', 'adventure'],
        createdAt: new Date(),
        updatedAt: new Date(),
        lastAccessedAt: new Date(),
      },
    ]

    it('should list projects successfully', async () => {
      mockProjectService.listUserProjects.mockResolvedValue(mockProjects)

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockProjects)
      expect(mockProjectService.listUserProjects).toHaveBeenCalledWith(
        mockUserId,
        expect.any(Object)
      )
    })

    it('should apply query filters', async () => {
      mockProjectService.listUserProjects.mockResolvedValue([])

      const url =
        'http://localhost:3000/api/projects?status=IN_PROGRESS&genre=Fantasy&limit=10&offset=5'
      const request = new NextRequest(url)
      const response = await GET(request)

      expect(mockProjectService.listUserProjects).toHaveBeenCalledWith(
        mockUserId,
        {
          status: 'IN_PROGRESS',
          visibility: null,
          genre: 'Fantasy',
          tags: undefined,
          isArchived: false,
          search: undefined,
          limit: 10,
          offset: 5,
          sortBy: 'updatedAt',
          sortOrder: 'desc',
        }
      )
    })

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any)

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle service errors', async () => {
      const error = new Error('Database error')
      mockProjectService.listUserProjects.mockRejectedValue(error)

      const request = new NextRequest('http://localhost:3000/api/projects')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('POST /api/projects', () => {
    const validProjectData = {
      title: 'New Project',
      description: 'A new project description',
      genre: 'Fantasy',
      targetWordCount: 80000,
      isPublic: false,
      tags: ['fantasy', 'adventure'],
    }

    const mockCreatedProject = {
      id: 'project-123',
      userId: mockUserId,
      ...validProjectData,
      status: 'DRAFT' as const,
      visibility: 'PRIVATE' as const,
      currentWordCount: 0,
      isArchived: false,
      settings: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      lastAccessedAt: new Date(),
      statistics: null,
    }

    it('should create project successfully', async () => {
      mockProjectService.createProject.mockResolvedValue(mockCreatedProject)

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(201)
      expect(data.success).toBe(true)
      expect(data.data).toEqual(mockCreatedProject)
      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        mockUserId,
        validProjectData
      )
    })

    it('should return 400 for missing title', async () => {
      const invalidData = { ...validProjectData, title: undefined }

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(invalidData),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Project title is required')
      expect(data.code).toBe('VALIDATION_ERROR')
    })

    it('should return 401 for unauthenticated user', async () => {
      mockAuth.mockResolvedValue({ userId: null } as any)

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should handle service validation errors', async () => {
      const validationError = new Error('Title too long')
      validationError.name = 'ProjectValidationError'
      ;(validationError as any).code = 'PROJECT_VALIDATION_ERROR'
      ;(validationError as any).statusCode = 400
      mockProjectService.createProject.mockRejectedValue(validationError)

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Title too long')
      expect(data.code).toBe('PROJECT_VALIDATION_ERROR')
    })

    it('should handle service errors', async () => {
      const error = new Error('Database error')
      mockProjectService.createProject.mockRejectedValue(error)

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })
  })
})
