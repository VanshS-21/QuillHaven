import {
  createProject,
  getProject,
  updateProject,
  deleteProject,
  listProjects,
  validateProjectOwnership,
  getProjectStats,
} from '../projectService';
import { prisma } from '@/lib/prisma';
import type { User, Project } from '@prisma/client';

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    character: {
      create: jest.fn(),
    },
    plotThread: {
      create: jest.fn(),
    },
    worldElement: {
      create: jest.fn(),
    },
    timelineEvent: {
      create: jest.fn(),
    },
  },
}));

// Get the mocked prisma instance
const mockPrisma = jest.mocked(prisma);

describe('ProjectService', () => {
  const mockUser: User = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    subscriptionTier: 'FREE',
    writingPreferences: null,
    emailVerified: new Date(),
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject: Project = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Project',
    description: 'A test project',
    genre: 'Fantasy',
    targetLength: 50000,
    currentWordCount: 0,
    status: 'DRAFT',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    it('should create a project successfully', async () => {
      const projectData = {
        title: 'New Project',
        description: 'A new project',
        genre: 'Science Fiction',
        targetLength: 75000,
      };

      mockPrisma.project.create.mockResolvedValue(mockProject);
      mockPrisma.character.create.mockResolvedValue({} as any);
      mockPrisma.plotThread.create.mockResolvedValue({} as any);
      mockPrisma.worldElement.create.mockResolvedValue({} as any);
      mockPrisma.timelineEvent.create.mockResolvedValue({} as any);

      const result = await createProject(mockUser.id, projectData);

      expect(mockPrisma.project.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          title: projectData.title,
          description: projectData.description,
          genre: projectData.genre,
          targetLength: projectData.targetLength,
          status: 'DRAFT',
          currentWordCount: 0,
        },
      });

      expect(result).toEqual(mockProject);

      // Verify context initialization
      expect(mockPrisma.character.create).toHaveBeenCalled();
      expect(mockPrisma.plotThread.create).toHaveBeenCalled();
      expect(mockPrisma.worldElement.create).toHaveBeenCalled();
      expect(mockPrisma.timelineEvent.create).toHaveBeenCalled();
    });

    it('should handle creation errors', async () => {
      const projectData = {
        title: 'New Project',
        genre: 'Science Fiction',
        targetLength: 75000,
      };

      mockPrisma.project.create.mockRejectedValue(new Error('Database error'));

      await expect(createProject(mockUser.id, projectData)).rejects.toThrow(
        'Failed to create project'
      );
    });
  });

  describe('getProject', () => {
    it('should get a project with full details', async () => {
      const mockProjectWithDetails = {
        ...mockProject,
        user: mockUser,
        chapters: [],
        characters: [],
        plotThreads: [],
        worldElements: [],
        timelineEvents: [],
        exports: [],
      };

      mockPrisma.project.findFirst.mockResolvedValue(mockProjectWithDetails);

      const result = await getProject(mockProject.id, mockUser.id);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProject.id,
          userId: mockUser.id,
        },
        include: {
          user: true,
          chapters: {
            orderBy: { order: 'asc' },
          },
          characters: {
            orderBy: { name: 'asc' },
          },
          plotThreads: {
            orderBy: { createdAt: 'asc' },
          },
          worldElements: {
            orderBy: { name: 'asc' },
          },
          timelineEvents: {
            orderBy: { eventDate: 'asc' },
          },
          exports: {
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      expect(result).toEqual(mockProjectWithDetails);
    });

    it('should return null for non-existent project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await getProject('non-existent', mockUser.id);

      expect(result).toBeNull();
    });

    it('should handle database errors', async () => {
      mockPrisma.project.findFirst.mockRejectedValue(new Error('Database error'));

      await expect(getProject(mockProject.id, mockUser.id)).rejects.toThrow(
        'Failed to get project'
      );
    });
  });

  describe('updateProject', () => {
    it('should update a project successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        status: 'IN_PROGRESS' as const,
      };

      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockResolvedValue({
        ...mockProject,
        ...updateData,
      });

      const result = await updateProject(mockProject.id, mockUser.id, updateData);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProject.id,
          userId: mockUser.id,
        },
      });

      expect(mockPrisma.project.update).toHaveBeenCalledWith({
        where: { id: mockProject.id },
        data: {
          ...updateData,
          updatedAt: expect.any(Date),
        },
      });

      expect(result).toEqual({
        ...mockProject,
        ...updateData,
      });
    });

    it('should return null for non-existent project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await updateProject('non-existent', mockUser.id, {
        title: 'Updated Title',
      });

      expect(result).toBeNull();
    });

    it('should handle update errors', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.project.update.mockRejectedValue(new Error('Database error'));

      await expect(
        updateProject(mockProject.id, mockUser.id, { title: 'Updated Title' })
      ).rejects.toThrow('Failed to update project');
    });
  });

  describe('deleteProject', () => {
    it('should delete a project successfully', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.project.delete.mockResolvedValue(mockProject);

      const result = await deleteProject(mockProject.id, mockUser.id);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProject.id,
          userId: mockUser.id,
        },
      });

      expect(mockPrisma.project.delete).toHaveBeenCalledWith({
        where: { id: mockProject.id },
      });

      expect(result).toBe(true);
    });

    it('should return false for non-existent project', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await deleteProject('non-existent', mockUser.id);

      expect(result).toBe(false);
    });

    it('should handle deletion errors', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);
      mockPrisma.project.delete.mockRejectedValue(new Error('Database error'));

      await expect(deleteProject(mockProject.id, mockUser.id)).rejects.toThrow(
        'Failed to delete project'
      );
    });
  });

  describe('listProjects', () => {
    it('should list projects with pagination', async () => {
      const mockProjects = [mockProject];
      const totalCount = 1;

      mockPrisma.project.count.mockResolvedValue(totalCount);
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      const result = await listProjects(mockUser.id, {
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.project.count).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
      });

      expect(mockPrisma.project.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id },
        skip: 0,
        take: 10,
        orderBy: { updatedAt: 'desc' },
      });

      expect(result).toEqual({
        projects: mockProjects,
        pagination: {
          page: 1,
          limit: 10,
          total: totalCount,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      });
    });

    it('should filter projects by status', async () => {
      const mockProjects = [mockProject];
      const totalCount = 1;

      mockPrisma.project.count.mockResolvedValue(totalCount);
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      await listProjects(mockUser.id, {
        status: 'DRAFT',
      });

      expect(mockPrisma.project.count).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          status: 'DRAFT',
        },
      });
    });

    it('should search projects by title and description', async () => {
      const mockProjects = [mockProject];
      const totalCount = 1;

      mockPrisma.project.count.mockResolvedValue(totalCount);
      mockPrisma.project.findMany.mockResolvedValue(mockProjects);

      await listProjects(mockUser.id, {
        search: 'test',
      });

      expect(mockPrisma.project.count).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          OR: [
            {
              title: {
                contains: 'test',
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: 'test',
                mode: 'insensitive',
              },
            },
          ],
        },
      });
    });

    it('should handle listing errors', async () => {
      mockPrisma.project.count.mockRejectedValue(new Error('Database error'));

      await expect(listProjects(mockUser.id)).rejects.toThrow(
        'Failed to list projects'
      );
    });
  });

  describe('validateProjectOwnership', () => {
    it('should return true for valid ownership', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(mockProject);

      const result = await validateProjectOwnership(mockProject.id, mockUser.id);

      expect(mockPrisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProject.id,
          userId: mockUser.id,
        },
      });

      expect(result).toBe(true);
    });

    it('should return false for invalid ownership', async () => {
      mockPrisma.project.findFirst.mockResolvedValue(null);

      const result = await validateProjectOwnership(mockProject.id, 'other-user');

      expect(result).toBe(false);
    });

    it('should handle validation errors', async () => {
      mockPrisma.project.findFirst.mockRejectedValue(new Error('Database error'));

      const result = await validateProjectOwnership(mockProject.id, mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('getProjectStats', () => {
    it('should return project statistics', async () => {
      const mockProjects = [
        { ...mockProject, status: 'DRAFT', currentWordCount: 1000 },
        { ...mockProject, id: 'project-2', status: 'IN_PROGRESS', currentWordCount: 2000 },
      ];

      mockPrisma.project.count.mockResolvedValue(2);
      mockPrisma.project.findMany
        .mockResolvedValueOnce(mockProjects)
        .mockResolvedValueOnce(mockProjects.slice(0, 1));

      const result = await getProjectStats(mockUser.id);

      expect(result).toEqual({
        totalProjects: 2,
        totalWordCount: 3000,
        projectsByStatus: {
          DRAFT: 1,
          IN_PROGRESS: 1,
        },
        recentActivity: [mockProjects[0]],
      });
    });

    it('should handle stats errors', async () => {
      mockPrisma.project.count.mockRejectedValue(new Error('Database error'));

      await expect(getProjectStats(mockUser.id)).rejects.toThrow(
        'Failed to get project statistics'
      );
    });
  });
});