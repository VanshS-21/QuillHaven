import { prisma } from '@/lib/prisma';
import { cacheService, CacheKeys } from '@/services/cacheService';
import type {
  Project,
  ProjectWithDetails,
  ProjectStatus,
} from '@/types/database';

export interface CreateProjectData {
  title: string;
  description?: string;
  genre: string;
  targetLength: number;
}

export interface UpdateProjectData {
  title?: string;
  description?: string;
  genre?: string;
  targetLength?: number;
  status?: ProjectStatus;
}

export interface ProjectListOptions {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  genre?: string;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'currentWordCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ProjectListResult {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

/**
 * Create a new project with initialized context
 */
export async function createProject(
  userId: string,
  data: CreateProjectData
): Promise<Project> {
  try {
    const project = await prisma.project.create({
      data: {
        userId,
        title: data.title,
        description: data.description,
        genre: data.genre,
        targetLength: data.targetLength,
        status: 'DRAFT',
        currentWordCount: 0,
      },
    });

    // Initialize project context (empty but structured)
    // This creates the foundation for characters, plot threads, etc.
    await initializeProjectContext(project.id);

    // Invalidate user projects cache
    await cacheService.del(CacheKeys.userProjects(userId));
    await cacheService.del(`user:${userId}:stats`);

    return project;
  } catch (error) {
    console.error('Error creating project:', error);
    throw new Error('Failed to create project');
  }
}

/**
 * Get a project by ID with ownership validation
 */
export async function getProject(
  projectId: string,
  userId: string
): Promise<ProjectWithDetails | null> {
  const cacheKey = `${CacheKeys.project(projectId)}:user:${userId}`;
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      try {
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            userId, // Ensures ownership validation
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

        return project;
      } catch (error) {
        console.error('Error getting project:', error);
        throw new Error('Failed to get project');
      }
    },
    { ttl: 300 } // Cache for 5 minutes
  );
}

/**
 * Update a project with ownership validation
 */
export async function updateProject(
  projectId: string,
  userId: string,
  data: UpdateProjectData
): Promise<Project | null> {
  try {
    // First verify ownership
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      return null;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    // Invalidate related caches
    await Promise.all([
      cacheService.del(`${CacheKeys.project(projectId)}:user:${userId}`),
      cacheService.del(CacheKeys.userProjects(userId)),
      cacheService.del(`user:${userId}:stats`),
    ]);

    return updatedProject;
  } catch (error) {
    console.error('Error updating project:', error);
    throw new Error('Failed to update project');
  }
}

/**
 * Delete a project with ownership validation
 */
export async function deleteProject(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    // First verify ownership
    const existingProject = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    if (!existingProject) {
      return false;
    }

    // Delete project (cascade will handle related data)
    await prisma.project.delete({
      where: { id: projectId },
    });

    // Invalidate all related caches
    await Promise.all([
      cacheService.delPattern(`*project:${projectId}*`),
      cacheService.del(CacheKeys.userProjects(userId)),
      cacheService.del(`user:${userId}:stats`),
    ]);

    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    throw new Error('Failed to delete project');
  }
}

/**
 * List projects for a user with pagination and filtering
 */
export async function listProjects(
  userId: string,
  options: ProjectListOptions = {}
): Promise<ProjectListResult> {
  const {
    page = 1,
    limit = 10,
    status,
    genre,
    search,
    sortBy = 'updatedAt',
    sortOrder = 'desc',
  } = options;

  // Create cache key based on all parameters
  const cacheKey = `${CacheKeys.userProjects(userId)}:${JSON.stringify({
    page,
    limit,
    status,
    genre,
    search,
    sortBy,
    sortOrder,
  })}`;

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      try {
        // Build where clause
        const where: Record<string, unknown> = {
          userId,
        };

        if (status) {
          where.status = status;
        }

        if (genre) {
          where.genre = {
            contains: genre,
            mode: 'insensitive',
          };
        }

        if (search) {
          where.OR = [
            {
              title: {
                contains: search,
                mode: 'insensitive',
              },
            },
            {
              description: {
                contains: search,
                mode: 'insensitive',
              },
            },
          ];
        }

        // Calculate pagination
        const skip = (page - 1) * limit;

        // Get total count and projects in parallel
        const [total, projects] = await Promise.all([
          prisma.project.count({ where }),
          prisma.project.findMany({
            where,
            skip,
            take: limit,
            orderBy: {
              [sortBy]: sortOrder,
            },
          }),
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / limit);

        return {
          projects,
          pagination: {
            page,
            limit,
            total,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1,
          },
        };
      } catch (error) {
        console.error('Error listing projects:', error);
        throw new Error('Failed to list projects');
      }
    },
    { ttl: 180 } // Cache for 3 minutes
  );
}

/**
 * Initialize project context with empty structures
 */
async function initializeProjectContext(projectId: string): Promise<void> {
  try {
    // Create a default main character placeholder
    await prisma.character.create({
      data: {
        projectId,
        name: 'Main Character',
        description: 'The protagonist of your story',
        role: 'PROTAGONIST',
        developmentArc: 'To be developed',
      },
    });

    // Create a default plot thread
    await prisma.plotThread.create({
      data: {
        projectId,
        title: 'Main Plot',
        description: 'The primary storyline',
        status: 'INTRODUCED',
      },
    });

    // Create a default world element
    await prisma.worldElement.create({
      data: {
        projectId,
        type: 'LOCATION',
        name: 'Primary Setting',
        description: 'The main location where your story takes place',
        significance: 'Central to the story',
      },
    });

    // Create a default timeline event
    await prisma.timelineEvent.create({
      data: {
        projectId,
        title: 'Story Beginning',
        description: 'The opening of your story',
        eventDate: 'Day 1',
        importance: 5,
      },
    });
  } catch (error) {
    console.error('Error initializing project context:', error);
    // Don't throw here as the project was already created successfully
  }
}

/**
 * Validate project ownership
 */
export async function validateProjectOwnership(
  projectId: string,
  userId: string
): Promise<boolean> {
  try {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        userId,
      },
    });

    return !!project;
  } catch (error) {
    console.error('Error validating project ownership:', error);
    return false;
  }
}

/**
 * Get project statistics for dashboard
 */
export async function getProjectStats(userId: string): Promise<{
  totalProjects: number;
  totalWordCount: number;
  projectsByStatus: Record<ProjectStatus, number>;
  recentActivity: Project[];
}> {
  const cacheKey = `user:${userId}:stats`;
  
  return cacheService.getOrSet(
    cacheKey,
    async () => {
      try {
        // Get all data in parallel for better performance
        const [totalProjects, projects, recentActivity] = await Promise.all([
          prisma.project.count({
            where: { userId },
          }),
          prisma.project.findMany({
            where: { userId },
            select: {
              status: true,
              currentWordCount: true,
            },
          }),
          prisma.project.findMany({
            where: { userId },
            orderBy: { updatedAt: 'desc' },
            take: 5,
          }),
        ]);

        const totalWordCount = projects.reduce(
          (sum, project) => sum + project.currentWordCount,
          0
        );

        const projectsByStatus = projects.reduce(
          (acc, project) => {
            acc[project.status] = (acc[project.status] || 0) + 1;
            return acc;
          },
          {} as Record<ProjectStatus, number>
        );

        return {
          totalProjects,
          totalWordCount,
          projectsByStatus,
          recentActivity,
        };
      } catch (error) {
        console.error('Error getting project stats:', error);
        throw new Error('Failed to get project statistics');
      }
    },
    { ttl: 600 } // Cache for 10 minutes
  );
}
