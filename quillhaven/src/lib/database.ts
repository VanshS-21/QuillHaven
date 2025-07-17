import { prisma } from './prisma';
import type {
  UserWithProjects,
  ProjectWithDetails,
  ChapterWithVersions,
  CharacterWithRelationships,
  PlotThreadWithCharacters,
  WorldElementWithRelations,
} from '@/types/database';

// User queries
export const getUserById = async (
  id: string
): Promise<UserWithProjects | null> => {
  return prisma.user.findUnique({
    where: { id },
    include: {
      projects: {
        orderBy: { updatedAt: 'desc' },
      },
    },
  });
};

export const getUserByEmail = async (email: string) => {
  return prisma.user.findUnique({
    where: { email },
  });
};

// Project queries
export const getProjectById = async (
  id: string
): Promise<ProjectWithDetails | null> => {
  return prisma.project.findUnique({
    where: { id },
    include: {
      user: true,
      chapters: {
        orderBy: { order: 'asc' },
      },
      characters: {
        orderBy: { createdAt: 'asc' },
      },
      plotThreads: {
        orderBy: { createdAt: 'asc' },
      },
      worldElements: {
        orderBy: { createdAt: 'asc' },
      },
      timelineEvents: {
        orderBy: { createdAt: 'asc' },
      },
      exports: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

export const getUserProjects = async (userId: string) => {
  return prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
    include: {
      chapters: {
        select: {
          id: true,
          title: true,
          wordCount: true,
          status: true,
        },
      },
    },
  });
};

// Chapter queries
export const getChapterById = async (
  id: string
): Promise<ChapterWithVersions | null> => {
  return prisma.chapter.findUnique({
    where: { id },
    include: {
      project: true,
      versions: {
        orderBy: { version: 'desc' },
      },
    },
  });
};

export const getProjectChapters = async (projectId: string) => {
  return prisma.chapter.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    include: {
      versions: {
        select: {
          id: true,
          version: true,
          createdAt: true,
        },
        orderBy: { version: 'desc' },
        take: 1,
      },
    },
  });
};

// Character queries
export const getCharacterById = async (
  id: string
): Promise<CharacterWithRelationships | null> => {
  return prisma.character.findUnique({
    where: { id },
    include: {
      project: true,
      relationships: {
        include: {
          relatedCharacter: true,
        },
      },
      relatedTo: {
        include: {
          character: true,
        },
      },
      plotThreads: true,
    },
  });
};

export const getProjectCharacters = async (projectId: string) => {
  return prisma.character.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      relationships: {
        include: {
          relatedCharacter: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
    },
  });
};

// Plot thread queries
export const getPlotThreadById = async (
  id: string
): Promise<PlotThreadWithCharacters | null> => {
  return prisma.plotThread.findUnique({
    where: { id },
    include: {
      project: true,
      relatedCharacters: true,
    },
  });
};

export const getProjectPlotThreads = async (projectId: string) => {
  return prisma.plotThread.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
    include: {
      relatedCharacters: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });
};

// World element queries
export const getWorldElementById = async (
  id: string
): Promise<WorldElementWithRelations | null> => {
  return prisma.worldElement.findUnique({
    where: { id },
    include: {
      project: true,
      relatedElements: {
        include: {
          relatedElement: true,
        },
      },
      relatedTo: {
        include: {
          element: true,
        },
      },
    },
  });
};

export const getProjectWorldElements = async (projectId: string) => {
  return prisma.worldElement.findMany({
    where: { projectId },
    orderBy: { name: 'asc' },
    include: {
      relatedElements: {
        include: {
          relatedElement: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
        },
      },
    },
  });
};

// Timeline queries
export const getProjectTimeline = async (projectId: string) => {
  return prisma.timelineEvent.findMany({
    where: { projectId },
    orderBy: { importance: 'desc' },
  });
};

// Export queries
export const getProjectExports = async (projectId: string) => {
  return prisma.export.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
};

// Utility functions
export const updateProjectWordCount = async (projectId: string) => {
  const chapters = await prisma.chapter.findMany({
    where: { projectId },
    select: { wordCount: true },
  });

  const totalWordCount = chapters.reduce(
    (sum, chapter) => sum + chapter.wordCount,
    0
  );

  return prisma.project.update({
    where: { id: projectId },
    data: { currentWordCount: totalWordCount },
  });
};

export const createChapterVersion = async (
  chapterId: string,
  content: string,
  wordCount: number
) => {
  const latestVersion = await prisma.chapterVersion.findFirst({
    where: { chapterId },
    orderBy: { version: 'desc' },
  });

  const nextVersion = (latestVersion?.version || 0) + 1;

  return prisma.chapterVersion.create({
    data: {
      chapterId,
      content,
      wordCount,
      version: nextVersion,
    },
  });
};
