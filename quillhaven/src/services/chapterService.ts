import { prisma } from '@/lib/prisma';
import { createAIService } from './aiService';
import type {
  Chapter,
  ChapterWithVersions,
  ChapterStatus,
} from '@/types/database';
import type { ChapterGenerationRequest, ProjectContextForAI } from '@/types/ai';

export interface CreateChapterData {
  title: string;
  content?: string;
  order?: number;
  status?: ChapterStatus;
}

export interface UpdateChapterData {
  title?: string;
  content?: string;
  status?: ChapterStatus;
}

export interface ChapterGenerationData {
  prompt: string;
  parameters: {
    length: number;
    tone: string;
    style: string;
    focusCharacters?: string[];
    plotPoints?: string[];
  };
}

export interface ChapterListOptions {
  page?: number;
  limit?: number;
  status?: ChapterStatus;
  search?: string;
  sortBy?: 'title' | 'order' | 'createdAt' | 'updatedAt' | 'wordCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ChapterListResult {
  chapters: Chapter[];
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
 * Create a new chapter for a project
 */
export async function createChapter(
  projectId: string,
  userId: string,
  data: CreateChapterData
): Promise<Chapter> {
  try {
    // Validate project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Determine the order if not provided
    let order = data.order;
    if (order === undefined) {
      const lastChapter = await prisma.chapter.findFirst({
        where: { projectId },
        orderBy: { order: 'desc' },
      });
      order = (lastChapter?.order || 0) + 1;
    }

    // Create the chapter
    const chapter = await prisma.chapter.create({
      data: {
        projectId,
        title: data.title,
        content: data.content || '',
        order,
        status: data.status || 'DRAFT',
        wordCount: countWords(data.content || ''),
      },
    });

    // Create initial version
    await createChapterVersion(chapter.id, chapter.content, chapter.wordCount);

    // Update project word count
    await updateProjectWordCount(projectId);

    return chapter;
  } catch (error) {
    console.error('Error creating chapter:', error);
    throw new Error('Failed to create chapter');
  }
}

/**
 * Get a chapter by ID with ownership validation
 */
export async function getChapter(
  chapterId: string,
  userId: string
): Promise<ChapterWithVersions | null> {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId }, // Validates ownership through project
      },
      include: {
        project: true,
        versions: {
          orderBy: { version: 'desc' },
          take: 10, // Limit to last 10 versions
        },
      },
    });

    return chapter;
  } catch (error) {
    console.error('Error getting chapter:', error);
    throw new Error('Failed to get chapter');
  }
}

/**
 * Update a chapter with ownership validation
 */
export async function updateChapter(
  chapterId: string,
  userId: string,
  data: UpdateChapterData
): Promise<Chapter | null> {
  try {
    // First verify ownership
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
    });

    if (!existingChapter) {
      return null;
    }

    // Calculate new word count if content is being updated
    const wordCount =
      data.content !== undefined
        ? countWords(data.content)
        : existingChapter.wordCount;

    const updatedChapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...data,
        wordCount,
        updatedAt: new Date(),
      },
    });

    // Create new version if content changed
    if (
      data.content !== undefined &&
      data.content !== existingChapter.content
    ) {
      await createChapterVersion(chapterId, data.content, wordCount);
    }

    // Update project word count
    await updateProjectWordCount(existingChapter.projectId);

    return updatedChapter;
  } catch (error) {
    console.error('Error updating chapter:', error);
    throw new Error('Failed to update chapter');
  }
}

/**
 * Delete a chapter with ownership validation
 */
export async function deleteChapter(
  chapterId: string,
  userId: string
): Promise<boolean> {
  try {
    // First verify ownership and get project ID
    const existingChapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
    });

    if (!existingChapter) {
      return false;
    }

    const projectId = existingChapter.projectId;

    // Delete chapter (cascade will handle versions)
    await prisma.chapter.delete({
      where: { id: chapterId },
    });

    // Reorder remaining chapters
    await reorderChaptersAfterDeletion(projectId, existingChapter.order);

    // Update project word count
    await updateProjectWordCount(projectId);

    return true;
  } catch (error) {
    console.error('Error deleting chapter:', error);
    throw new Error('Failed to delete chapter');
  }
}

/**
 * List chapters for a project with pagination and filtering
 */
export async function listChapters(
  projectId: string,
  userId: string,
  options: ChapterListOptions = {}
): Promise<ChapterListResult> {
  try {
    // Validate project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    const {
      page = 1,
      limit = 50,
      status,
      search,
      sortBy = 'order',
      sortOrder = 'asc',
    } = options;

    // Build where clause
    const where: {
      projectId: string;
      status?: ChapterStatus;
      OR?: Array<{
        title?: { contains: string; mode: 'insensitive' };
        content?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      projectId,
    };

    if (status) {
      where.status = status;
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
          content: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get total count
    const total = await prisma.chapter.count({ where });

    // Get chapters
    const chapters = await prisma.chapter.findMany({
      where,
      skip,
      take: limit,
      orderBy: {
        [sortBy]: sortOrder,
      },
    });

    // Calculate pagination info
    const totalPages = Math.ceil(total / limit);

    return {
      chapters,
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
    console.error('Error listing chapters:', error);
    throw new Error('Failed to list chapters');
  }
}

/**
 * Generate chapter content using AI
 */
export async function generateChapter(
  chapterId: string,
  userId: string,
  generationData: ChapterGenerationData
): Promise<Chapter> {
  try {
    // Get chapter and validate ownership
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
      include: {
        project: {
          include: {
            characters: true,
            plotThreads: true,
            worldElements: true,
            timelineEvents: true,
            chapters: {
              where: { id: { not: chapterId } },
              orderBy: { order: 'asc' },
            },
          },
        },
      },
    });

    if (!chapter) {
      throw new Error('Chapter not found or access denied');
    }

    // Build project context for AI
    const projectContext: ProjectContextForAI = {
      characters: chapter.project.characters,
      plotThreads: chapter.project.plotThreads,
      worldElements: chapter.project.worldElements,
      timelineEvents: chapter.project.timelineEvents,
      projectSummary:
        chapter.project.description ||
        `A ${chapter.project.genre} story titled "${chapter.project.title}"`,
      genre: chapter.project.genre,
      writingStyle: 'narrative', // Could be extracted from user preferences
    };

    // Get previous chapters content for context
    const previousChapters = chapter.project.chapters
      .filter((c) => c.order < chapter.order)
      .map((c) => c.content);

    // Create AI generation request
    const aiRequest: ChapterGenerationRequest = {
      prompt: generationData.prompt,
      projectContext,
      previousChapters,
      parameters: {
        length: generationData.parameters.length,
        tone: generationData.parameters.tone,
        style: generationData.parameters.style,
        focusCharacters: generationData.parameters.focusCharacters || [],
        plotPoints: generationData.parameters.plotPoints || [],
      },
    };

    // Generate content using AI service
    const aiService = createAIService();
    const aiResponse = await aiService.generateChapter(aiRequest);

    // Update chapter with generated content
    const updatedChapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        content: aiResponse.content,
        wordCount: aiResponse.wordCount,
        status: 'GENERATED',
        generationParams: {
          prompt: generationData.prompt,
          length: generationData.parameters.length,
          tone: generationData.parameters.tone,
          style: generationData.parameters.style,
          contextIds: aiResponse.contextUsed,
        },
        updatedAt: new Date(),
      },
    });

    // Create version for generated content
    await createChapterVersion(
      chapterId,
      aiResponse.content,
      aiResponse.wordCount
    );

    // Update project word count
    await updateProjectWordCount(chapter.projectId);

    return updatedChapter;
  } catch (error) {
    console.error('Error generating chapter:', error);
    throw new Error('Failed to generate chapter content');
  }
}

/**
 * Reorder chapters within a project
 */
export async function reorderChapters(
  projectId: string,
  userId: string,
  chapterOrders: { id: string; order: number }[]
): Promise<Chapter[]> {
  try {
    // Validate project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
    });

    if (!project) {
      throw new Error('Project not found or access denied');
    }

    // Validate that all chapters belong to the project
    const chapterIds = chapterOrders.map((co) => co.id);
    const existingChapters = await prisma.chapter.findMany({
      where: {
        id: { in: chapterIds },
        projectId,
      },
    });

    if (existingChapters.length !== chapterIds.length) {
      throw new Error('Some chapters do not belong to this project');
    }

    // Update chapter orders in a transaction
    const updatedChapters = await prisma.$transaction(
      chapterOrders.map(({ id, order }) =>
        prisma.chapter.update({
          where: { id },
          data: { order, updatedAt: new Date() },
        })
      )
    );

    return updatedChapters;
  } catch (error) {
    console.error('Error reordering chapters:', error);
    throw new Error('Failed to reorder chapters');
  }
}

/**
 * Get chapter version history
 */
export async function getChapterVersions(
  chapterId: string,
  userId: string,
  limit: number = 20
) {
  try {
    // Validate ownership
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
    });

    if (!chapter) {
      throw new Error('Chapter not found or access denied');
    }

    const versions = await prisma.chapterVersion.findMany({
      where: { chapterId },
      orderBy: { version: 'desc' },
      take: limit,
    });

    return versions;
  } catch (error) {
    console.error('Error getting chapter versions:', error);
    throw new Error('Failed to get chapter versions');
  }
}

/**
 * Restore a chapter to a specific version
 */
export async function restoreChapterVersion(
  chapterId: string,
  userId: string,
  version: number
): Promise<Chapter> {
  try {
    // Validate ownership
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
    });

    if (!chapter) {
      throw new Error('Chapter not found or access denied');
    }

    // Get the version to restore
    const versionToRestore = await prisma.chapterVersion.findFirst({
      where: { chapterId, version },
    });

    if (!versionToRestore) {
      throw new Error('Version not found');
    }

    // Update chapter with version content
    const updatedChapter = await prisma.chapter.update({
      where: { id: chapterId },
      data: {
        content: versionToRestore.content,
        wordCount: versionToRestore.wordCount,
        updatedAt: new Date(),
      },
    });

    // Create new version for the restoration
    await createChapterVersion(
      chapterId,
      versionToRestore.content,
      versionToRestore.wordCount
    );

    // Update project word count
    await updateProjectWordCount(chapter.projectId);

    return updatedChapter;
  } catch (error) {
    console.error('Error restoring chapter version:', error);
    throw new Error('Failed to restore chapter version');
  }
}

// Helper functions

/**
 * Count words in text
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0).length;
}

/**
 * Create a new chapter version
 */
async function createChapterVersion(
  chapterId: string,
  content: string,
  wordCount: number
): Promise<void> {
  try {
    // Get the next version number
    const lastVersion = await prisma.chapterVersion.findFirst({
      where: { chapterId },
      orderBy: { version: 'desc' },
    });

    const nextVersion = (lastVersion?.version || 0) + 1;

    await prisma.chapterVersion.create({
      data: {
        chapterId,
        content,
        wordCount,
        version: nextVersion,
      },
    });
  } catch (error) {
    console.error('Error creating chapter version:', error);
    // Don't throw here as it's a helper function
  }
}

/**
 * Update project word count based on all chapters
 */
async function updateProjectWordCount(projectId: string): Promise<void> {
  try {
    const chapters = await prisma.chapter.findMany({
      where: { projectId },
      select: { wordCount: true },
    });

    const totalWordCount = chapters.reduce(
      (sum, chapter) => sum + chapter.wordCount,
      0
    );

    await prisma.project.update({
      where: { id: projectId },
      data: { currentWordCount: totalWordCount },
    });
  } catch (error) {
    console.error('Error updating project word count:', error);
    // Don't throw here as it's a helper function
  }
}

/**
 * Reorder chapters after deletion
 */
async function reorderChaptersAfterDeletion(
  projectId: string,
  deletedOrder: number
): Promise<void> {
  try {
    // Get all chapters with order greater than deleted chapter
    const chaptersToReorder = await prisma.chapter.findMany({
      where: {
        projectId,
        order: { gt: deletedOrder },
      },
    });

    // Update their orders
    await prisma.$transaction(
      chaptersToReorder.map((chapter) =>
        prisma.chapter.update({
          where: { id: chapter.id },
          data: { order: chapter.order - 1 },
        })
      )
    );
  } catch (error) {
    console.error('Error reordering chapters after deletion:', error);
    // Don't throw here as it's a helper function
  }
}

/**
 * Validate chapter ownership
 */
export async function validateChapterOwnership(
  chapterId: string,
  userId: string
): Promise<boolean> {
  try {
    const chapter = await prisma.chapter.findFirst({
      where: {
        id: chapterId,
        project: { userId },
      },
    });

    return !!chapter;
  } catch (error) {
    console.error('Error validating chapter ownership:', error);
    return false;
  }
}
