export interface ExportRequest {
  projectId: string;
  format: 'DOCX' | 'PDF' | 'TXT' | 'EPUB';
  chapterIds?: string[]; // If not provided, export all chapters
  includeMetadata?: boolean;
  metadata?: ExportMetadata;
}

export interface ExportMetadata {
  title?: string;
  author?: string;
  description?: string;
  genre?: string;
  language?: string;
  publishDate?: Date;
  version?: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: 'DOCX' | 'PDF' | 'TXT' | 'EPUB';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  filename: string;
  fileSize?: number | null;
  downloadUrl?: string | null;
  expiresAt?: Date | null;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportContent {
  title: string;
  chapters: ChapterContent[];
  metadata: ExportMetadata;
}

export interface ChapterContent {
  id: string;
  title: string;
  content: string;
  order: number;
  wordCount: number;
}

export interface ExportResult {
  success: boolean;
  exportId?: string;
  downloadUrl?: string;
  error?: string;
}

export interface DownloadLinkOptions {
  expiresIn?: number; // seconds, default 24 hours
  secure?: boolean;
}
