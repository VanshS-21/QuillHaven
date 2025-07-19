import { ProjectService } from '../projectService';
import { prismaMock } from '../../../__mocks__/prisma';
import { Project, User } from '@prisma/client';

describe('ProjectService', () => {
  let projectService: ProjectService;

  beforeEach(() => {
    projectService = new ProjectService();
    jest.clearAllMocks();
  });

  describe('createProject', () => {
    const mockProjectData = {
      title: 'My Novel',
      description: 'A great story',
      genre: 'Fantasy',
      targetLength: 80000,
    };

    const mockUser: User = {
      id: 'user-1',
      email: 'test@example.com',
      passwordHash: 'hash',
      firstName: 'John',
      lastName: 'Doe',
      isEmailVerified: true,
      emailVerificationToken: null,
      subscriptionTier: 'free',
      writingPreferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      passwordResetToken: null,
      passwordResetExpires: null,
    };

    it('should create a project successfully', async () => {
      const mockProject: Project = {
        id: 'project-1',
        userId: mockUser.id,
        title: mockProjectData.title,
        description: mockProjectData.description,
        genre: mockProjectData.genre,
        targetLength: mockProjectData.targetLength,
        currentWordCount: 0,
        status: 'draft',
        context: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.create.mockResolvedValue(mockProject);

      const result = await projectService.createProject(
        mockUser.id,
        mockProjectData
      );

      expect(result).toEqual(mockProject);
      expect(prismaMock.project.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          title: mockProjectData.title,
          description: mockProjectData.description,
          genre: mockProjectData.genre,
          targetLength: mockProjectData.targetLength,
          currentWordCount: 0,
          status: 'draft',
          context: {
            characters: [],
            plotThreads: [],
            worldBuilding: [],
            timeline: [],
          },
        },
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        title: '',
        genre: 'Fantasy',
        targetLength: 80000,
      };

      await expect(
        projectService.createProject(mockUser.id, invalidData)
      ).rejects.toThrow('Title is required');
    });

    it('should validate target length', async () => {
      const invalidData = {
        ...mockProjectData,
        targetLength: -1000,
      };

      await expect(
        projectService.createProject(mockUser.id, invalidData)
      ).rejects.toThrow('Target length must be positive');
    });
  });

  describe('getProjectsByUser', () => {
    const userId = 'user-1';

    it('should return user projects with pagination', async () => {
      const mockProjects: Project[] = [
        {
          id: 'project-1',
          userId,
          title: 'Project 1',
          description: 'Description 1',
          genre: 'Fantasy',
          targetLength: 80000,
          currentWordCount: 5000,
          status: 'in-progress',
          context: {
            characters: [],
            plotThreads: [],
            worldBuilding: [],
            timeline: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: 'project-2',
          userId,
          title: 'Project 2',
          description: 'Description 2',
          genre: 'Sci-Fi',
          targetLength: 100000,
          currentWordCount: 0,
          status: 'draft',
          context: {
            characters: [],
            plotThreads: [],
            worldBuilding: [],
            timeline: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.project.findMany.mockResolvedValue(mockProjects);
      prismaMock.project.count.mockResolvedValue(2);

      const result = await projectService.getProjectsByUser(userId, {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        projects: mockProjects,
        total: 2,
        page: 1,
        totalPages: 1,
      });

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should filter projects by status', async () => {
      const mockProjects: Project[] = [
        {
          id: 'project-1',
          userId,
          title: 'Active Project',
          description: 'Description',
          genre: 'Fantasy',
          targetLength: 80000,
          currentWordCount: 5000,
          status: 'in-progress',
          context: {
            characters: [],
            plotThreads: [],
            worldBuilding: [],
            timeline: [],
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      prismaMock.project.findMany.mockResolvedValue(mockProjects);
      prismaMock.project.count.mockResolvedValue(1);

      const result = await projectService.getProjectsByUser(userId, {
        page: 1,
        limit: 10,
        status: 'in-progress',
      });

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { userId, status: 'in-progress' },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should search projects by title', async () => {
      const searchTerm = 'Novel';

      prismaMock.project.findMany.mockResolvedValue([]);
      prismaMock.project.count.mockResolvedValue(0);

      await projectService.getProjectsByUser(userId, {
        page: 1,
        limit: 10,
        search: searchTerm,
      });

      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          userId,
          OR: [
            { title: { contains: searchTerm, mode: 'insensitive' } },
            { description: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });
  });

  describe('getProjectById', () => {
    const projectId = 'project-1';
    const userId = 'user-1';

    it('should return project if user owns it', async () => {
      const mockProject: Project = {
        id: projectId,
        userId,
        title: 'My Project',
        description: 'Description',
        genre: 'Fantasy',
        targetLength: 80000,
        currentWordCount: 5000,
        status: 'in-progress',
        context: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const result = await projectService.getProjectById(projectId, userId);

      expect(result).toEqual(mockProject);
      expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
        where: { id: projectId, userId },
      });
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        projectService.getProjectById(projectId, userId)
      ).rejects.toThrow('Project not found');
    });

    it('should throw error if user does not own project', async () => {
      const mockProject: Project = {
        id: projectId,
        userId: 'other-user',
        title: 'Other Project',
        description: 'Description',
        genre: 'Fantasy',
        targetLength: 80000,
        currentWordCount: 5000,
        status: 'in-progress',
        context: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        projectService.getProjectById(projectId, userId)
      ).rejects.toThrow('Project not found');
    });
  });

  describe('updateProject', () => {
    const projectId = 'project-1';
    const userId = 'user-1';

    it('should update project successfully', async () => {
      const updateData = {
        title: 'Updated Title',
        description: 'Updated Description',
        status: 'in-progress' as const,
      };

      const existingProject: Project = {
        id: projectId,
        userId,
        title: 'Old Title',
        description: 'Old Description',
        genre: 'Fantasy',
        targetLength: 80000,
        currentWordCount: 5000,
        status: 'draft',
        context: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedProject: Project = {
        ...existingProject,
        ...updateData,
        updatedAt: new Date(),
      };

      prismaMock.project.findFirst.mockResolvedValue(existingProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await projectService.updateProject(
        projectId,
        userId,
        updateData
      );

      expect(result).toEqual(updatedProject);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: updateData,
      });
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        projectService.updateProject(projectId, userId, { title: 'New Title' })
      ).rejects.toThrow('Project not found');
    });
  });

  describe('deleteProject', () => {
    const projectId = 'project-1';
    const userId = 'user-1';

    it('should delete project and related data', async () => {
      const mockProject: Project = {
        id: projectId,
        userId,
        title: 'Project to Delete',
        description: 'Description',
        genre: 'Fantasy',
        targetLength: 80000,
        currentWordCount: 5000,
        status: 'draft',
        context: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.project.delete.mockResolvedValue(mockProject);

      const result = await projectService.deleteProject(projectId, userId);

      expect(result).toEqual({ message: 'Project deleted successfully' });

      // Verify deletion order
      expect(prismaMock.chapter.deleteMany).toHaveBeenCalledWith({
        where: { projectId },
      });
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { id: projectId },
      });
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        projectService.deleteProject(projectId, userId)
      ).rejects.toThrow('Project not found');
    });
  });

  describe('updateWordCount', () => {
    const projectId = 'project-1';

    it('should calculate and update word count', async () => {
      const mockChapters = [
        { content: 'This is chapter one with ten words total.' },
        { content: 'Chapter two has exactly eight words here.' },
      ];

      prismaMock.chapter.findMany.mockResolvedValue(mockChapters as any);
      prismaMock.project.update.mockResolvedValue({} as any);

      await projectService.updateWordCount(projectId);

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { currentWordCount: 16 }, // 8 + 8 words
      });
    });

    it('should handle projects with no chapters', async () => {
      prismaMock.chapter.findMany.mockResolvedValue([]);
      prismaMock.project.update.mockResolvedValue({} as any);

      await projectService.updateWordCount(projectId);

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: projectId },
        data: { currentWordCount: 0 },
      });
    });
  });

  describe('getProjectStats', () => {
    const projectId = 'project-1';
    const userId = 'user-1';

    it('should return comprehensive project statistics', async () => {
      const mockProject: Project = {
        id: projectId,
        userId,
        title: 'Test Project',
        description: 'Description',
        genre: 'Fantasy',
        targetLength: 80000,
        currentWordCount: 25000,
        status: 'in-progress',
        context: {
          characters: [{ id: '1', name: 'Hero' }],
          plotThreads: [{ id: '1', title: 'Main Plot' }],
          worldBuilding: [],
          timeline: [],
        },
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      };

      const mockChapters = [
        { id: '1', title: 'Chapter 1', wordCount: 2500, status: 'final' },
        { id: '2', title: 'Chapter 2', wordCount: 2200, status: 'draft' },
      ];

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters as any);

      const result = await projectService.getProjectStats(projectId, userId);

      expect(result).toEqual({
        totalWords: 25000,
        targetWords: 80000,
        progress: 31.25, // 25000/80000 * 100
        chaptersCount: 2,
        charactersCount: 1,
        plotThreadsCount: 1,
        averageChapterLength: 2350, // (2500 + 2200) / 2
        daysActive: expect.any(Number),
        wordsPerDay: expect.any(Number),
      });
    });
  });
});
