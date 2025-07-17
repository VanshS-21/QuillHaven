import type {
  User,
  Project,
  Chapter,
  ChapterVersion,
  Character,
  Relationship,
  PlotThread,
  WorldElement,
  WorldElementRelation,
  TimelineEvent,
  Export,
  Session,
  SubscriptionTier,
  ProjectStatus,
  ChapterStatus,
  CharacterRole,
  PlotThreadStatus,
  WorldElementType,
  ExportFormat,
  ExportStatus,
} from '@prisma/client';

// Extended types with relations
export type UserWithProjects = User & {
  projects: Project[];
};

export type ProjectWithDetails = Project & {
  user: User;
  chapters: Chapter[];
  characters: Character[];
  plotThreads: PlotThread[];
  worldElements: WorldElement[];
  timelineEvents: TimelineEvent[];
  exports: Export[];
};

export type ChapterWithVersions = Chapter & {
  project: Project;
  versions: ChapterVersion[];
};

export type CharacterWithRelationships = Character & {
  project: Project;
  relationships: (Relationship & {
    relatedCharacter: Character;
  })[];
  relatedTo: (Relationship & {
    character: Character;
  })[];
  plotThreads: PlotThread[];
};

export type PlotThreadWithCharacters = PlotThread & {
  project: Project;
  relatedCharacters: Character[];
};

export type WorldElementWithRelations = WorldElement & {
  project: Project;
  relatedElements: (WorldElementRelation & {
    relatedElement: WorldElement;
  })[];
  relatedTo: (WorldElementRelation & {
    element: WorldElement;
  })[];
};

// Writing preferences interface
export interface WritingPreferences {
  defaultGenre: string;
  preferredChapterLength: number;
  writingStyle: string;
  aiAssistanceLevel: 'minimal' | 'moderate' | 'extensive';
}

// Generation parameters interface
export interface GenerationParams {
  prompt: string;
  length: number;
  tone: string;
  style: string;
  contextIds: string[];
}

// Project context interface
export interface ProjectContext {
  characters: Character[];
  plotThreads: PlotThread[];
  worldBuilding: WorldElement[];
  timeline: TimelineEvent[];
}

// Export all Prisma types
export type {
  User,
  Project,
  Chapter,
  ChapterVersion,
  Character,
  Relationship,
  PlotThread,
  WorldElement,
  WorldElementRelation,
  TimelineEvent,
  Export,
  Session,
  SubscriptionTier,
  ProjectStatus,
  ChapterStatus,
  CharacterRole,
  PlotThreadStatus,
  WorldElementType,
  ExportFormat,
  ExportStatus,
};
