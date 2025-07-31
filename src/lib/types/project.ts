/**
 * Project Type Definitions
 *
 * Shared types for project-related operations across the application
 */

import { Project, ProjectStatus, ProjectVisibility } from '@/generated/prisma'

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
  message?: string
}

export interface PaginatedResponse<T = unknown> extends ApiResponse<T> {
  pagination?: {
    limit: number
    offset: number
    total: number
    hasMore?: boolean
  }
}

// Project API Types
export interface ProjectCreateRequest {
  title: string
  description?: string
  genre?: string
  targetWordCount?: number
  isPublic?: boolean
  tags?: string[]
  templateId?: string
}

export interface ProjectUpdateRequest {
  title?: string
  description?: string
  genre?: string
  targetWordCount?: number
  status?: ProjectStatus
  visibility?: ProjectVisibility
  tags?: string[]
  settings?: Record<string, unknown>
}

export interface ProjectListQuery {
  status?: ProjectStatus
  visibility?: ProjectVisibility
  genre?: string
  tags?: string
  archived?: boolean
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'
  sortOrder?: 'asc' | 'desc'
}

export interface ProjectSearchQuery {
  q: string
  limit?: number
}

export interface ProjectDuplicateRequest {
  title: string
}

// Extended Project Types
export interface ProjectWithStatistics extends Project {
  statistics: {
    totalWords: number
    totalChapters: number
    completedChapters: number
    averageWordsPerChapter: number
    writingStreak: number
    totalWritingTime: number
    sessionsCount: number
    lastWritingSession?: Date
    progressPercentage: number
    dailyWordCounts: Array<{
      date: Date
      wordsWritten: number
      timeSpent: number
      chaptersWorked: number
    }>
  }
}

export interface ProjectSummaryCard {
  id: string
  title: string
  description?: string
  genre?: string
  status: ProjectStatus
  visibility: ProjectVisibility
  currentWordCount: number
  targetWordCount?: number
  progressPercentage: number
  isArchived: boolean
  tags: string[]
  createdAt: Date
  updatedAt: Date
  lastAccessedAt: Date
  thumbnail?: string
}

export interface ProjectSearchResult {
  id: string
  title: string
  description?: string
  genre?: string
  tags: string[]
  relevanceScore: number
  matchedFields: string[]
}

// Project Settings Types
export interface ProjectSettings {
  autoSave: boolean
  autoSaveInterval: number
  spellCheck: boolean
  grammarCheck: boolean
  aiAssistance: boolean
  collaborationEnabled: boolean
  exportFormats: ExportFormat[]
  backupEnabled: boolean
  versionControl: boolean
  theme?: 'light' | 'dark' | 'sepia'
  fontSize?: number
  fontFamily?: string
  lineHeight?: number
  wordWrapEnabled?: boolean
  showWordCount?: boolean
  showCharacterCount?: boolean
  showReadingTime?: boolean
}

export type ExportFormat = 'docx' | 'pdf' | 'epub' | 'txt' | 'html' | 'markdown'

// Project Activity Types
export interface ProjectActivity {
  id: string
  projectId: string
  userId: string
  action: ProjectActivityAction
  timestamp: Date
  metadata: Record<string, unknown>
  ipAddress?: string
  userAgent?: string
}

export type ProjectActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'archived'
  | 'restored'
  | 'duplicated'
  | 'shared'
  | 'exported'
  | 'accessed'
  | 'chapter_added'
  | 'chapter_updated'
  | 'chapter_deleted'
  | 'settings_updated'

// Project Sharing Types
export interface ProjectShareSettings {
  visibility: ProjectVisibility
  allowComments?: boolean
  allowCollaboration?: boolean
  allowDownload?: boolean
  expiresAt?: Date
  password?: string
}

export interface ProjectShareResult {
  shareId: string
  shareUrl: string
  qrCode?: string
  expiresAt?: Date
  accessCount: number
  maxAccess?: number
}

export interface ProjectCollaborator {
  id: string
  userId: string
  projectId: string
  role: CollaboratorRole
  permissions: CollaboratorPermissions
  invitedAt: Date
  acceptedAt?: Date
  lastActiveAt?: Date
  invitedBy: string
}

export type CollaboratorRole = 'viewer' | 'commenter' | 'editor' | 'admin'

export interface CollaboratorPermissions {
  canRead: boolean
  canWrite: boolean
  canComment: boolean
  canShare: boolean
  canManageCollaborators: boolean
  canExport: boolean
  canDelete: boolean
}

// Project Template Types
export interface ProjectTemplate {
  id: string
  name: string
  description: string
  category: TemplateCategory
  genre?: string
  structure: TemplateStructure
  settings: ProjectSettings
  isPublic: boolean
  createdBy: string
  usageCount: number
  rating: number
  tags: string[]
  createdAt: Date
  updatedAt: Date
}

export type TemplateCategory =
  | 'novel'
  | 'short_story'
  | 'screenplay'
  | 'poetry'
  | 'non_fiction'
  | 'academic'
  | 'blog'
  | 'other'

export interface TemplateStructure {
  chapters: TemplateChapter[]
  sections?: TemplateSection[]
  metadata?: Record<string, unknown>
}

export interface TemplateChapter {
  title: string
  description?: string
  wordCountTarget?: number
  order: number
  isOptional?: boolean
}

export interface TemplateSection {
  name: string
  description?: string
  chapters: string[]
  order: number
}

// Project Analytics Types
export interface ProjectAnalytics {
  projectId: string
  period: AnalyticsPeriod
  metrics: {
    wordsWritten: number
    timeSpent: number
    sessionsCount: number
    averageSessionLength: number
    dailyGoalAchievement: number
    weeklyGoalAchievement: number
    monthlyGoalAchievement: number
    writingStreak: number
    longestWritingStreak: number
    mostProductiveDay: string
    mostProductiveHour: number
    chaptersCompleted: number
    averageWordsPerChapter: number
  }
  trends: {
    wordsPerDay: Array<{ date: string; words: number }>
    timePerDay: Array<{ date: string; minutes: number }>
    productivityScore: Array<{ date: string; score: number }>
  }
  goals: {
    dailyWordGoal?: number
    weeklyWordGoal?: number
    monthlyWordGoal?: number
    targetCompletionDate?: Date
    currentProgress: number
    projectedCompletionDate?: Date
  }
}

export type AnalyticsPeriod = 'week' | 'month' | 'quarter' | 'year' | 'all'

// Error Types
export interface ProjectErrorDetails {
  code: string
  message: string
  field?: string
  value?: unknown
  constraint?: string
}

export interface ProjectValidationError {
  errors: ProjectErrorDetails[]
  message: string
}

// Utility Types
export type ProjectSortField = keyof Pick<
  Project,
  'title' | 'createdAt' | 'updatedAt' | 'lastAccessedAt'
>
export type SortOrder = 'asc' | 'desc'

export interface ProjectFilters {
  status?: ProjectStatus[]
  visibility?: ProjectVisibility[]
  genres?: string[]
  tags?: string[]
  dateRange?: {
    from: Date
    to: Date
  }
  wordCountRange?: {
    min: number
    max: number
  }
  isArchived?: boolean
  hasCollaborators?: boolean
}

// Form Types for UI Components
export interface ProjectFormData {
  title: string
  description: string
  genre: string
  targetWordCount: string
  isPublic: boolean
  tags: string[]
  templateId?: string
}

export interface ProjectFormErrors {
  title?: string
  description?: string
  genre?: string
  targetWordCount?: string
  tags?: string
  general?: string
}

// Constants
export const PROJECT_CONSTANTS = {
  MAX_TITLE_LENGTH: 200,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_TAGS: 20,
  MAX_TAG_LENGTH: 50,
  MIN_TARGET_WORD_COUNT: 1,
  MAX_TARGET_WORD_COUNT: 10000000,
  DEFAULT_AUTO_SAVE_INTERVAL: 30,
  MAX_PROJECTS_PER_USER: 1000,
  MAX_COLLABORATORS_PER_PROJECT: 50,
} as const

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: 'Draft',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
  PUBLISHED: 'Published',
} as const

export const PROJECT_VISIBILITY_LABELS: Record<ProjectVisibility, string> = {
  PRIVATE: 'Private',
  SHARED: 'Shared',
  PUBLIC: 'Public',
} as const
