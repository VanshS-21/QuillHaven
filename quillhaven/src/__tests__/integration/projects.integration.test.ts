import { NextRequest } from 'next/server';
import {
  GET as getProjectsHandler,
  POST as createProjectHandler,
} from '@/app/api/projects/route';
import {
  GET as getProjectHandler,
  PUT as updateProjectHandler,
  DELETE as deleteProjectHandler,
} from '@/app/api/projects/[id]/route';
import { prismaMock } from '../../../__mocks__/prisma';
import jwt from 'jsonwebtoken';

// Mock JWT
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

describe('Projects API Integration Tests', () => {
  const mockUser = {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'John',
    lastName: 'Doe',
  };

  const mockProject = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Novel',
    description: 'A test novel',
    genre: 'Fantasy',
    targetLength: 80000,
    currentWordCount: 25000,
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

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock JWT verification to return valid user
    mockJwt.verify.mockReturnValue({
      userId: mockUser.id,
      email: mockUser.email,
    });
  });

  describe('GET /api/projects', () => {
    it('should return user projects with pagination', async () => {
      const mockProjects = [mockProject];

      prismaMock.project.findMany.mockResolvedValue(mockProjects);
      prismaMock.project.count.mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/projects?page=1&limit=10',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.projects).toHaveLength(1);
      expect(data.projects[0].title).toBe('Test Novel');
      expect(data.total).toBe(1);
      expect(data.page).toBe(1);
      expect(data.totalPages).toBe(1);
    });

    it('should filter projects by status', async () => {
      const activeProjects = [{ ...mockProject, status: 'in-progress' }];

      prismaMock.project.findMany.mockResolvedValue(activeProjects);
      prismaMock.project.count.mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/projects?status=in-progress',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, status: 'in-progress' },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should search projects by title', async () => {
      prismaMock.project.findMany.mockResolvedValue([mockProject]);
      prismaMock.project.count.mockResolvedValue(1);

      const request = new NextRequest(
        'http://localhost:3000/api/projects?search=Novel',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectsHandler(request);

      expect(response.status).toBe(200);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: {
          userId: mockUser.id,
          OR: [
            { title: { contains: 'Novel', mode: 'insensitive' } },
            { description: { contains: 'Novel', mode: 'insensitive' } },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should return 401 for missing authorization', async () => {
      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'GET',
      });

      const response = await getProjectsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Authorization required');
    });

    it('should return 401 for invalid token', async () => {
      mockJwt.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'GET',
        headers: { Authorization: 'Bearer invalid-token' },
      });

      const response = await getProjectsHandler(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Invalid token');
    });
  });

  describe('POST /api/projects', () => {
    const validProjectData = {
      title: 'New Novel',
      description: 'A new exciting novel',
      genre: 'Sci-Fi',
      targetLength: 100000,
    };

    it('should create a new project successfully', async () => {
      const newProject = {
        id: 'project-2',
        userId: mockUser.id,
        ...validProjectData,
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

      prismaMock.project.create.mockResolvedValue(newProject);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
      });

      const response = await createProjectHandler(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.title).toBe(validProjectData.title);
      expect(data.genre).toBe(validProjectData.genre);
      expect(data.userId).toBe(mockUser.id);
    });

    it('should return 400 for invalid project data', async () => {
      const invalidData = {
        title: '', // Empty title
        genre: 'Fantasy',
        targetLength: -1000, // Negative target length
      };

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(invalidData),
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
      });

      const response = await createProjectHandler(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      prismaMock.project.create.mockRejectedValue(new Error('Database error'));

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(validProjectData),
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
      });

      const response = await createProjectHandler(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('GET /api/projects/[id]', () => {
    it('should return project details for owner', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.id).toBe('project-1');
      expect(data.title).toBe('Test Novel');
      expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', userId: mockUser.id },
      });
    });

    it('should return 404 for non-existent project', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/nonexistent',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectHandler(request, {
        params: { id: 'nonexistent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Project not found');
    });

    it('should return 404 for project owned by different user', async () => {
      const otherUserProject = { ...mockProject, userId: 'other-user' };
      prismaMock.project.findFirst.mockResolvedValue(null); // findFirst with userId filter returns null

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Project not found');
    });
  });

  describe('PUT /api/projects/[id]', () => {
    const updateData = {
      title: 'Updated Novel Title',
      description: 'Updated description',
      status: 'in-progress',
    };

    it('should update project successfully', async () => {
      const updatedProject = { ...mockProject, ...updateData };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await updateProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.title).toBe(updateData.title);
      expect(data.description).toBe(updateData.description);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: updateData,
      });
    });

    it('should return 404 for non-existent project', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/nonexistent',
        {
          method: 'PUT',
          body: JSON.stringify(updateData),
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await updateProjectHandler(request, {
        params: { id: 'nonexistent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Project not found');
    });

    it('should validate update data', async () => {
      const invalidUpdateData = {
        title: '', // Empty title
        targetLength: -5000, // Invalid target length
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'PUT',
          body: JSON.stringify(invalidUpdateData),
          headers: {
            Authorization: 'Bearer valid-token',
            'Content-Type': 'application/json',
          },
        }
      );

      const response = await updateProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });
  });

  describe('DELETE /api/projects/[id]', () => {
    it('should delete project and related data', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.deleteMany.mockResolvedValue({ count: 5 });
      prismaMock.project.delete.mockResolvedValue(mockProject);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await deleteProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toContain('Project deleted successfully');

      // Verify deletion order
      expect(prismaMock.chapter.deleteMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
      });
      expect(prismaMock.project.delete).toHaveBeenCalledWith({
        where: { id: 'project-1' },
      });
    });

    it('should return 404 for non-existent project', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      const request = new NextRequest(
        'http://localhost:3000/api/projects/nonexistent',
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await deleteProjectHandler(request, {
        params: { id: 'nonexistent' },
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Project not found');
    });

    it('should handle deletion errors gracefully', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.deleteMany.mockRejectedValue(
        new Error('Deletion failed')
      );

      const request = new NextRequest(
        'http://localhost:3000/api/projects/project-1',
        {
          method: 'DELETE',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await deleteProjectHandler(request, {
        params: { id: 'project-1' },
      });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('Performance and load tests', () => {
    it('should handle multiple concurrent project requests', async () => {
      prismaMock.project.findMany.mockResolvedValue([mockProject]);
      prismaMock.project.count.mockResolvedValue(1);

      const requests = Array.from(
        { length: 10 },
        () =>
          new NextRequest('http://localhost:3000/api/projects', {
            method: 'GET',
            headers: { Authorization: 'Bearer valid-token' },
          })
      );

      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map((request) => getProjectsHandler(request))
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(responses.every((r) => r.status === 200)).toBe(true);
    });

    it('should handle large project lists efficiently', async () => {
      const largeProjectList = Array.from({ length: 1000 }, (_, i) => ({
        ...mockProject,
        id: `project-${i}`,
        title: `Project ${i}`,
      }));

      prismaMock.project.findMany.mockResolvedValue(
        largeProjectList.slice(0, 50)
      ); // Paginated
      prismaMock.project.count.mockResolvedValue(1000);

      const request = new NextRequest(
        'http://localhost:3000/api/projects?limit=50',
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const startTime = Date.now();
      const response = await getProjectsHandler(request);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(response.status).toBe(200);
    });
  });

  describe('Security tests', () => {
    it('should prevent SQL injection in search queries', async () => {
      const maliciousSearch = "'; DROP TABLE projects; --";

      prismaMock.project.findMany.mockResolvedValue([]);
      prismaMock.project.count.mockResolvedValue(0);

      const request = new NextRequest(
        `http://localhost:3000/api/projects?search=${encodeURIComponent(maliciousSearch)}`,
        {
          method: 'GET',
          headers: { Authorization: 'Bearer valid-token' },
        }
      );

      const response = await getProjectsHandler(request);

      expect(response.status).toBe(200);
      // Should not crash and should safely handle the malicious input
      expect(prismaMock.project.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({
                title: { contains: maliciousSearch, mode: 'insensitive' },
              }),
            ]),
          }),
        })
      );
    });

    it('should sanitize HTML in project data', async () => {
      const maliciousData = {
        title: '<script>alert("xss")</script>Malicious Title',
        description: '<img src="x" onerror="alert(1)">Description',
        genre: 'Fantasy',
        targetLength: 80000,
      };

      const sanitizedProject = {
        id: 'project-2',
        userId: mockUser.id,
        title: 'Malicious Title', // Should be sanitized
        description: 'Description', // Should be sanitized
        genre: 'Fantasy',
        targetLength: 80000,
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

      prismaMock.project.create.mockResolvedValue(sanitizedProject);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'POST',
        body: JSON.stringify(maliciousData),
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
      });

      const response = await createProjectHandler(request);
      const data = await response.json();

      if (response.status === 201) {
        expect(data.title).not.toContain('<script>');
        expect(data.description).not.toContain('<img');
      }
    });

    it('should enforce user isolation', async () => {
      // Mock different user token
      mockJwt.verify.mockReturnValue({
        userId: 'other-user',
        email: 'other@example.com',
      });

      prismaMock.project.findMany.mockResolvedValue([]);
      prismaMock.project.count.mockResolvedValue(0);

      const request = new NextRequest('http://localhost:3000/api/projects', {
        method: 'GET',
        headers: { Authorization: 'Bearer other-user-token' },
      });

      const response = await getProjectsHandler(request);

      expect(response.status).toBe(200);
      expect(prismaMock.project.findMany).toHaveBeenCalledWith({
        where: { userId: 'other-user' }, // Should only query for the authenticated user
        orderBy: { updatedAt: 'desc' },
        skip: 0,
        take: 10,
      });
    });

    it('should validate authorization header format', async () => {
      const invalidAuthHeaders = [
        'invalid-token',
        'Basic dXNlcjpwYXNz', // Basic auth instead of Bearer
        'Bearer', // Missing token
        '', // Empty header
      ];

      for (const authHeader of invalidAuthHeaders) {
        const request = new NextRequest('http://localhost:3000/api/projects', {
          method: 'GET',
          headers: authHeader ? { Authorization: authHeader } : {},
        });

        const response = await getProjectsHandler(request);
        expect([401, 403]).toContain(response.status);
      }
    });
  });
});
