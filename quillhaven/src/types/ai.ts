import type {
  Character,
  PlotThread,
  WorldElement,
  TimelineEvent,
} from './database';

// AI Service interfaces for Gemini integration
export interface ChapterGenerationRequest {
  prompt: string;
  projectContext: ProjectContextForAI;
  previousChapters: string[];
  parameters: ChapterGenerationParameters;
}

export interface ChapterGenerationParameters {
  length: number; // Target word count (1000-5000)
  tone: string; // e.g., "dramatic", "humorous", "mysterious"
  style: string; // e.g., "first-person", "third-person", "descriptive"
  focusCharacters: string[]; // Character IDs to focus on
  plotPoints: string[]; // Plot thread IDs to advance
}

export interface ChapterGenerationResponse {
  content: string;
  wordCount: number;
  generatedAt: Date;
  contextUsed: string[]; // IDs of context elements used
  suggestions?: string[]; // Optional suggestions for improvement
}

export interface ProjectContextForAI {
  characters: Character[];
  plotThreads: PlotThread[];
  worldElements: WorldElement[];
  timelineEvents: TimelineEvent[];
  projectSummary: string;
  genre: string;
  writingStyle: string;
}

export interface ContextAnalysis {
  extractedCharacters: string[];
  extractedPlotPoints: string[];
  extractedWorldElements: string[];
  inconsistencies: ConsistencyIssue[];
  suggestions: string[];
}

export interface ConsistencyIssue {
  type: 'character' | 'plot' | 'world' | 'timeline';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestedFix?: string;
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  score: number; // 0-100, higher is better
  recommendations: string[];
}

// AI Service configuration
export interface AIServiceConfig {
  apiKey: string;
  model: string;
  maxRetries: number;
  retryDelay: number;
  timeout: number;
}

// Error types for AI service
export class AIServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIServiceError';
  }
}

export class AIRateLimitError extends AIServiceError {
  constructor(
    message: string,
    public retryAfter?: number
  ) {
    super(message, 'RATE_LIMIT', true);
    this.name = 'AIRateLimitError';
  }
}

export class AIQuotaExceededError extends AIServiceError {
  constructor(message: string) {
    super(message, 'QUOTA_EXCEEDED', false);
    this.name = 'AIQuotaExceededError';
  }
}

export class AIContentFilterError extends AIServiceError {
  constructor(message: string) {
    super(message, 'CONTENT_FILTER', false);
    this.name = 'AIContentFilterError';
  }
}
