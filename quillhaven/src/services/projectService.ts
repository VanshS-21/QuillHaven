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
    // Validate input data
    if (!data.title || data.title.trim().length === 0) {
      throw new Error('Title is required');
    }
    if (!data.genre || data.genre.trim().length === 0) {
      throw new Error('Genre is required');
    }
    if (data.targetLength && data.targetLength < 1000) {
      throw new Error('Target length must be at least 1,000 words');
    }

    const project = await prisma.project.create({
      data: {
        userId,
        title: data.title.trim(),
        description: data.description?.trim(),
        genre: data.genre.trim(),
        targetLength: data.targetLength || 50000,
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
    if (error instanceof Error && error.message.includes('required')) {
      throw error; // Re-throw validation errors
    }
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
    // Validate input data
    if (data.title !== undefined && data.title.trim().length === 0) {
      throw new Error('Title cannot be empty');
    }
    if (data.genre !== undefined && data.genre.trim().length === 0) {
      throw new Error('Genre cannot be empty');
    }
    if (data.targetLength !== undefined && data.targetLength < 1000) {
      throw new Error('Target length must be at least 1,000 words');
    }

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

    // Prepare update data with trimmed strings
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (data.title !== undefined) {
      updateData.title = data.title.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim();
    }
    if (data.genre !== undefined) {
      updateData.genre = data.genre.trim();
    }
    if (data.targetLength !== undefined) {
      updateData.targetLength = data.targetLength;
    }
    if (data.status !== undefined) {
      updateData.status = data.status;
    }

    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: updateData,
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
    if (error instanceof Error && (error.message.includes('cannot be empty') || error.message.includes('must be at least'))) {
      throw error; // Re-throw validation errors
    }
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
    // Use transaction to ensure data consistency
    const result = await prisma.$transaction(async (tx) => {
      // First verify ownership
      const existingProject = await tx.project.findFirst({
        where: {
          id: projectId,
          userId,
        },
      });

      if (!existingProject) {
        return false;
      }

      // Delete related data in proper order to avoid foreign key constraints
      // Note: With proper cascade settings in schema, this should be automatic
      // but we're being explicit for safety

      // Delete exports first
      await tx.export.deleteMany({
        where: { projectId },
      });

      // Delete timeline events
      await tx.timelineEvent.deleteMany({
        where: { projectId },
      });

      // Delete world element relations
      await tx.worldElementRelation.deleteMany({
        where: {
          OR: [
            { element: { projectId } },
            { relatedElement: { projectId } },
          ],
        },
      });

      // Delete world elements
      await tx.worldElement.deleteMany({
        where: { projectId },
      });

      // Delete plot threads (relations will be cleaned up automatically)
      await tx.plotThread.deleteMany({
        where: { projectId },
      });

      // Delete character relationships
      await tx.relationship.deleteMany({
        where: {
          OR: [
            { character: { projectId } },
            { relatedCharacter: { projectId } },
          ],
        },
      });

      // Delete characters
      await tx.character.deleteMany({
        where: { projectId },
      });

      // Delete chapter versions
      await tx.chapterVersion.deleteMany({
        where: {
          chapter: { projectId },
        },
      });

      // Delete chapters
      await tx.chapter.deleteMany({
        where: { projectId },
      });

      // Finally delete the project
      await tx.project.delete({
        where: { id: projectId },
      });

      return true;
    });

    if (!result) {
      return false;
    }

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
            select: {
              id: true,
              title: true,
              description: true,
              genre: true,
              targetLength: true,
              currentWordCount: true,
              status: true,
              createdAt: true,
              updatedAt: true,
              userId: true,
              // Only include counts for related data to improve performance
              _count: {
                select: {
                  chapters: true,
                  characters: true,
                  plotThreads: true,
                  worldElements: true,
                },
              },
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
 * Get aggregated project statistics efficiently
 */
export async function getAggregatedProjectStats(userId: string): Promise<{
  totalProjects: number;
  totalWordCount: number;
  averageWordCount: number;
  projectsByStatus: Record<ProjectStatus, number>;
  projectsByGenre: Record<string, number>;
  completionRate: number;
}> {
  const cacheKey = `user:${userId}:aggregated-stats`;

  return cacheService.getOrSet(
    cacheKey,
    async () => {
      try {
        // Use aggregation query for better performance
        const [
          totalProjects,
          statusStats,
          genreStats,
          wordCountStats,
        ] = await Promise.all([
          prisma.project.count({ where: { userId } }),
          prisma.project.groupBy({
            by: ['status'],
            where: { userId },
            _count: { status: true },
          }),
          prisma.project.groupBy({
            by: ['genre'],
            where: { userId },
            _count: { genre: true },
          }),
          prisma.project.aggregate({
            where: { userId },
            _sum: { currentWordCount: true },
            _avg: { currentWordCount: true },
          }),
        ]);

        const projectsByStatus = statusStats.reduce(
          (acc, stat) => {
            acc[stat.status] = stat._count.status;
            return acc;
          },
          {} as Record<ProjectStatus, number>
        );

        const projectsByGenre = genreStats.reduce(
          (acc, stat) => {
            acc[stat.genre] = stat._count.genre;
            return acc;
          },
          {} as Record<string, number>
        );

        // Ensure all status types are represented
        const allStatuses: ProjectStatus[] = ['DRAFT', 'IN_PROGRESS', 'COMPLETED'];
        allStatuses.forEach(status => {
          if (!(status in projectsByStatus)) {
            projectsByStatus[status] = 0;
          }
        });

        const completedProjects = projectsByStatus['COMPLETED'] || 0;
        const completionRate = totalProjects > 0 ? (completedProjects / totalProjects) * 100 : 0;

        return {
          totalProjects,
          totalWordCount: wordCountStats._sum.currentWordCount || 0,
          averageWordCount: Math.round(wordCountStats._avg.currentWordCount || 0),
          projectsByStatus,
          projectsByGenre,
          completionRate: Math.round(completionRate * 100) / 100, // Round to 2 decimal places
        };
      } catch (error) {
        console.error('Error getting aggregated project stats:', error);
        throw new Error('Failed to get aggregated project statistics');
      }
    },
    { ttl: 900 } // Cache for 15 minutes
  );
}

/**
 * Initialize project context with empty structures
 */
async function initializeProjectContext(projectId: string): Promise<void> {
  try {
    // Use transaction to ensure all context is created atomically
    await prisma.$transaction(async (tx) => {
      // Create a default main character placeholder
      await tx.character.create({
        data: {
          projectId,
          name: 'Main Character',
          description: 'The protagonist of your story',
          role: 'PROTAGONIST',
          developmentArc: 'To be developed',
        },
      });

      // Create a default plot thread
      await tx.plotThread.create({
        data: {
          projectId,
          title: 'Main Plot',
          description: 'The primary storyline',
          status: 'INTRODUCED',
        },
      });

      // Create a default world element
      await tx.worldElement.create({
        data: {
          projectId,
          type: 'LOCATION',
          name: 'Primary Setting',
          description: 'The main location where your story takes place',
          significance: 'Central to the story',
        },
      });

      // Create a default timeline event
      await tx.timelineEvent.create({
        data: {
          projectId,
          title: 'Story Beginning',
          description: 'The opening of your story',
          eventDate: 'Day 1',
          importance: 5,
        },
      });
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
 * Update project word count based on chapters
 */
export async function updateProjectWordCount(projectId: string): Promise<void> {
  try {
    // Calculate total word count from all chapters
    const chapters = await prisma.chapter.findMany({
      where: { projectId },
      select: { wordCount: true },
    });

    const totalWordCount = chapters.reduce(
      (sum, chapter) => sum + chapter.wordCount,
      0
    );

    // Update project with new word count
    await prisma.project.update({
      where: { id: projectId },
      data: { currentWordCount: totalWordCount },
    });

    // Invalidate related caches
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { userId: true },
    });

    if (project) {
      await Promise.all([
        cacheService.del(`${CacheKeys.project(projectId)}:user:${project.userId}`),
        cacheService.del(CacheKeys.userProjects(project.userId)),
        cacheService.del(`user:${project.userId}:stats`),
      ]);
    }
  } catch (error) {
    console.error('Error updating project word count:', error);
    throw new Error('Failed to update project word count');
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

        // Ensure all status types are represented
        const allStatuses: ProjectStatus[] = ['DRAFT', 'IN_PROGRESS', 'COMPLETED'];
        allStatuses.forEach(status => {
          if (!(status in projectsByStatus)) {
            projectsByStatus[status] = 0;
          }
        });

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
