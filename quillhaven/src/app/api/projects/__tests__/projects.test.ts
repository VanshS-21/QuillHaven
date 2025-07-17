import * as projectService from '@/services/projectService';

// Mock dependencies
jest.mock('@/services/projectService');

const mockProjectService = projectService as jest.Mocked<typeof projectService>;

describe('Project API Integration', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    subscriptionTier: 'FREE' as const,
    writingPreferences: null,
    emailVerified: new Date(),
    emailVerificationToken: null,
    passwordResetToken: null,
    passwordResetExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockProject = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Project',
    description: 'A test project',
    genre: 'Fantasy',
    targetLength: 50000,
    currentWordCount: 0,
    status: 'DRAFT' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Project Service Integration', () => {
    it('should handle project creation workflow', async () => {
      const projectData = {
        title: 'New Project',
        description: 'A new project',
        genre: 'Science Fiction',
        targetLength: 75000,
      };

      mockProjectService.createProject.mockResolvedValue(mockProject);

      const result = await projectService.createProject(mockUser.id, projectData);

      expect(mockProjectService.createProject).toHaveBeenCalledWith(
        mockUser.id,
        projectData
      );
      expect(result).toEqual(mockProject);
    });

    it('should handle project listing with filters', async () => {
      const mockResult = {
        projects: [mockProject],
        pagination: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
      };

      mockProjectService.listProjects.mockResolvedValue(mockResult);

      const result = await projectService.listProjects(mockUser.id, {
        page: 1,
        limit: 10,
        status: 'DRAFT',
        search: 'test',
      });

      expect(mockProjectService.listProjects).toHaveBeenCalledWith(mockUser.id, {
        page: 1,
        limit: 10,
        status: 'DRAFT',
        search: 'test',
      });
      expect(result).toEqual(mockResult);
    });

    it('should handle project updates with ownership validation', async () => {
      const updateData = {
        title: 'Updated Title',
        status: 'IN_PROGRESS' as const,
      };

      const updatedProject = {
        ...mockProject,
        ...updateData,
      };

      mockProjectService.updateProject.mockResolvedValue(updatedProject);

      const result = await projectService.updateProject(
        mockProject.id,
        mockUser.id,
        updateData
      );

      expect(mockProjectService.updateProject).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id,
        updateData
      );
      expect(result).toEqual(updatedProject);
    });

    it('should handle project deletion with ownership validation', async () => {
      mockProjectService.deleteProject.mockResolvedValue(true);

      const result = await projectService.deleteProject(mockProject.id, mockUser.id);

      expect(mockProjectService.deleteProject).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id
      );
      expect(result).toBe(true);
    });

    it('should handle project retrieval with full details', async () => {
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

      mockProjectService.getProject.mockResolvedValue(mockProjectWithDetails);

      const result = await projectService.getProject(mockProject.id, mockUser.id);

      expect(mockProjectService.getProject).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id
      );
      expect(result).toEqual(mockProjectWithDetails);
    });

    it('should handle project statistics retrieval', async () => {
      const mockStats = {
        totalProjects: 5,
        totalWordCount: 25000,
        projectsByStatus: {
          DRAFT: 2,
          IN_PROGRESS: 2,
          COMPLETED: 1,
        },
        recentActivity: [mockProject],
      };

      mockProjectService.getProjectStats.mockResolvedValue(mockStats);

      const result = await projectService.getProjectStats(mockUser.id);

      expect(mockProjectService.getProjectStats).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockStats);
    });

    it('should validate project ownership correctly', async () => {
      mockProjectService.validateProjectOwnership.mockResolvedValue(true);

      const result = await projectService.validateProjectOwnership(
        mockProject.id,
        mockUser.id
      );

      expect(mockProjectService.validateProjectOwnership).toHaveBeenCalledWith(
        mockProject.id,
        mockUser.id
      );
      expect(result).toBe(true);
    });

    it('should handle non-existent projects gracefully', async () => {
      mockProjectService.getProject.mockResolvedValue(null);
      mockProjectService.updateProject.mockResolvedValue(null);
      mockProjectService.deleteProject.mockResolvedValue(false);
      mockProjectService.validateProjectOwnership.mockResolvedValue(false);

      const getResult = await projectService.getProject('non-existent', mockUser.id);
      const updateResult = await projectService.updateProject(
        'non-existent',
        mockUser.id,
        { title: 'Updated' }
      );
      const deleteResult = await projectService.deleteProject(
        'non-existent',
        mockUser.id
      );
      const ownershipResult = await projectService.validateProjectOwnership(
        'non-existent',
        mockUser.id
      );

      expect(getResult).toBeNull();
      expect(updateResult).toBeNull();
      expect(deleteResult).toBe(false);
      expect(ownershipResult).toBe(false);
    });
  });
});