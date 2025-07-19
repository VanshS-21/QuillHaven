import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx';
import * as nodepub from 'nodepub';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import puppeteer from 'puppeteer';
import { prisma } from '@/lib/prisma';
import {
  ExportRequest,
  ExportJob,
  ExportContent,
  ExportResult,
  ExportMetadata,
  ChapterContent,
  DownloadLinkOptions,
} from '@/types/export';
import { queueService } from './queueService';

export class ExportService {
  private static readonly EXPORT_DIR = path.join(process.cwd(), 'exports');
  private static readonly MAX_FILE_AGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

  constructor() {
    this.ensureExportDirectory();
    this.registerQueueProcessor();
  }

  /**
   * Export project directly (for testing and immediate exports)
   */
  async exportProject(request: {
    projectId: string;
    userId: string;
    format: 'docx' | 'pdf' | 'txt' | 'epub';
    includeMetadata?: boolean;
    chapterIds?: string[];
  }): Promise<{
    downloadUrl: string;
    filename: string;
    format: string;
    size: number;
    expiresAt: Date;
  }> {
    try {
      // Validate project ownership
      const project = await prisma.project.findFirst({
        where: {
          id: request.projectId,
          userId: request.userId,
        },
      });

      if (!project) {
        throw new Error('Project not found');
      }

      // Get chapters
      const chapters = await prisma.chapter.findMany({
        where: request.chapterIds
          ? {
              projectId: request.projectId,
              id: { in: request.chapterIds },
            }
          : { projectId: request.projectId },
        orderBy: { order: 'asc' },
      });

      if (chapters.length === 0) {
        throw new Error('No chapters found for export');
      }

      // Generate filename
      const timestamp = new Date().toISOString().slice(0, 10);
      const sanitizedTitle = project.title
        .replace(/[^a-zA-Z0-9\s]/g, '')
        .replace(/\s+/g, '_');
      const filename = `${sanitizedTitle}_${timestamp}.${request.format}`;
      const filePath = path.join(ExportService.EXPORT_DIR, filename);

      // Generate export content
      const content = await this.generateExportContent(
        project,
        chapters,
        request.includeMetadata
      );

      // Generate file based on format
      await this.generateFileByFormat(content, request.format, filePath);

      // Get file size
      const stats = await fs.promises.stat(filePath);
      const size = stats.size;

      // Generate download URL
      const downloadUrl = this.getDownloadUrl(filename);

      // Set expiration date
      const expiresAt = new Date(Date.now() + ExportService.MAX_FILE_AGE);

      return {
        downloadUrl,
        filename,
        format: request.format,
        size,
        expiresAt,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Export failed: ${error.message}`);
      }
      throw new Error('Export failed: Unknown error');
    }
  }

  /**
   * Register export processor with queue service
   */
  private registerQueueProcessor(): void {
    queueService.registerProcessor('export', async (data: unknown) => {
      const { exportId, request, userId } = data as {
        exportId: string;
        request: ExportRequest;
        userId: string;
      };
      await this.processExport(exportId, request, userId);
    });
  }

  /**
   * Create a new export job
   */
  async createExport(
    request: ExportRequest,
    userId: string
  ): Promise<ExportResult> {
    try {
      // Validate project ownership
      const project = await prisma.project.findFirst({
        where: {
          id: request.projectId,
          userId: userId,
        },
      });

      if (!project) {
        return { success: false, error: 'Project not found or access denied' };
      }

      // Create export record
      const exportRecord = await prisma.export.create({
        data: {
          projectId: request.projectId,
          format: request.format,
          filename: this.generateFilename(project.title, request.format),
          status: 'PENDING',
          expiresAt: new Date(Date.now() + ExportService.MAX_FILE_AGE),
        },
      });

      // Add export job to queue
      await queueService.addJob('export', {
        exportId: exportRecord.id,
        request,
        userId,
      });

      return {
        success: true,
        exportId: exportRecord.id,
      };
    } catch (error) {
      console.error('Export creation failed:', error);
      return { success: false, error: 'Failed to create export' };
    }
  }

  /**
   * Get export status and download URL
   */
  async getExportStatus(
    exportId: string,
    userId: string
  ): Promise<ExportJob | null> {
    const exportRecord = await prisma.export.findFirst({
      where: {
        id: exportId,
        project: {
          userId: userId,
        },
      },
    });

    if (!exportRecord) {
      return null;
    }

    return {
      id: exportRecord.id,
      projectId: exportRecord.projectId,
      format: exportRecord.format as 'DOCX' | 'PDF' | 'TXT' | 'EPUB',
      status: exportRecord.status as
        | 'PENDING'
        | 'PROCESSING'
        | 'COMPLETED'
        | 'FAILED',
      filename: exportRecord.filename,
      fileSize: exportRecord.fileSize || undefined,
      downloadUrl: exportRecord.downloadUrl || undefined,
      expiresAt: exportRecord.expiresAt || undefined,
      createdAt: exportRecord.createdAt,
      updatedAt: exportRecord.updatedAt,
    };
  }

  /**
   * Generate secure download link
   */
  async generateDownloadLink(
    exportId: string,
    options: DownloadLinkOptions = {}
  ): Promise<string | null> {
    const exportRecord = await prisma.export.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord || exportRecord.status !== 'COMPLETED') {
      return null;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(
      Date.now() + (options.expiresIn || 24 * 60 * 60) * 1000
    );

    const downloadUrl = `/api/exports/${exportId}/download?token=${token}&expires=${expiresAt.getTime()}`;

    // Update export record with download URL
    await prisma.export.update({
      where: { id: exportId },
      data: {
        downloadUrl,
        expiresAt,
      },
    });

    return downloadUrl;
  }

  /**
   * Process export job
   */
  private async processExport(
    exportId: string,
    request: ExportRequest,
    userId: string
  ): Promise<void> {
    await this.updateExportStatus(exportId, 'PROCESSING');

    try {
      // Get export content
      const content = await this.getExportContent(request, userId);

      // Generate file based on format
      const filePath = await this.generateFile(
        content,
        request.format,
        exportId
      );

      // Get file size
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;

      // Generate download URL
      const downloadUrl = await this.generateDownloadLink(exportId);

      // Update export record
      await prisma.export.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          fileSize,
          downloadUrl,
        },
      });
    } catch (error) {
      await this.updateExportStatus(
        exportId,
        'FAILED',
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  }

  /**
   * Get content for export
   */
  private async getExportContent(
    request: ExportRequest,
    userId: string
  ): Promise<ExportContent> {
    const project = await prisma.project.findFirst({
      where: {
        id: request.projectId,
        userId: userId,
      },
      include: {
        chapters: {
          where: request.chapterIds
            ? {
                id: { in: request.chapterIds },
              }
            : undefined,
          orderBy: { order: 'asc' },
        },
        user: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (!project) {
      throw new Error('Project not found');
    }

    const chapters: ChapterContent[] = project.chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      order: chapter.order,
      wordCount: chapter.wordCount,
    }));

    const metadata: ExportMetadata = {
      title: project.title,
      author:
        request.metadata?.author ||
        (project.user.firstName && project.user.lastName
          ? `${project.user.firstName} ${project.user.lastName}`
          : undefined),
      description:
        request.metadata?.description || project.description || undefined,
      genre: request.metadata?.genre || project.genre,
      language: request.metadata?.language || 'en',
      publishDate: request.metadata?.publishDate || new Date(),
      version: request.metadata?.version || '1.0',
    };

    return {
      title: project.title,
      chapters,
      metadata,
    };
  }

  /**
   * Generate file based on format
   */
  private async generateFile(
    content: ExportContent,
    format: string,
    exportId: string
  ): Promise<string> {
    const filename = `${exportId}.${format.toLowerCase()}`;
    const filePath = path.join(ExportService.EXPORT_DIR, filename);

    switch (format) {
      case 'DOCX':
        await this.generateDocx(content, filePath);
        break;
      case 'PDF':
        await this.generatePdf(content, filePath);
        break;
      case 'TXT':
        await this.generateTxt(content, filePath);
        break;
      case 'EPUB':
        await this.generateEpub(content, filePath);
        break;
      default:
        throw new Error(`Unsupported format: ${format}`);
    }

    return filePath;
  }

  /**
   * Generate DOCX file
   */
  private async generateDocx(
    content: ExportContent,
    filePath: string
  ): Promise<void> {
    try {
      const children: Paragraph[] = [];

      // Add title
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: content.title, bold: true, size: 32 }),
          ],
          heading: HeadingLevel.TITLE,
        })
      );

      // Add metadata
      if (content.metadata.author) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: `By ${content.metadata.author}`,
                italics: true,
              }),
            ],
          })
        );
      }

      children.push(new Paragraph({ children: [new TextRun({ text: '' })] })); // Empty line

      // Add chapters
      for (const chapter of content.chapters) {
        // Chapter title
        children.push(
          new Paragraph({
            children: [
              new TextRun({ text: chapter.title, bold: true, size: 24 }),
            ],
            heading: HeadingLevel.HEADING_1,
          })
        );

        // Chapter content - split by paragraphs
        const paragraphs = chapter.content.split('\n\n');
        for (const paragraph of paragraphs) {
          if (paragraph.trim()) {
            children.push(
              new Paragraph({
                children: [new TextRun({ text: paragraph.trim() })],
              })
            );
          }
        }

        children.push(new Paragraph({ children: [new TextRun({ text: '' })] })); // Empty line between chapters
      }

      const doc = new Document({
        sections: [
          {
            properties: {},
            children,
          },
        ],
      });

      const buffer = await Packer.toBuffer(doc);
      await fs.promises.writeFile(filePath, buffer);
    } catch (error) {
      throw new Error('DOCX generation failed');
    }
  }

  /**
   * Generate PDF file using Puppeteer (more secure and flexible)
   */
  private async generatePdf(
    content: ExportContent,
    filePath: string
  ): Promise<void> {
    let browser;
    try {
      // Create HTML content
      const html = this.generateHtmlContent(content);

      // Launch Puppeteer
      browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      await page.pdf({
        path: filePath,
        format: 'A4',
        margin: {
          top: '1in',
          right: '1in',
          bottom: '1in',
          left: '1in',
        },
        printBackground: true,
      });
    } catch (error) {
      throw new Error('PDF generation failed');
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Generate HTML content for PDF generation
   */
  private generateHtmlContent(content: ExportContent): string {
    let html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>${content.title}</title>
        <style>
          body {
            font-family: 'Times New Roman', serif;
            line-height: 1.6;
            color: #333;
            max-width: 100%;
            margin: 0;
            padding: 0;
          }
          .title {
            text-align: center;
            font-size: 2.5em;
            font-weight: bold;
            margin-bottom: 0.5em;
            page-break-after: avoid;
          }
          .author {
            text-align: center;
            font-size: 1.2em;
            font-style: italic;
            margin-bottom: 2em;
            page-break-after: avoid;
          }
          .chapter {
            page-break-before: always;
            margin-bottom: 2em;
          }
          .chapter:first-of-type {
            page-break-before: avoid;
          }
          .chapter-title {
            font-size: 1.8em;
            font-weight: bold;
            margin-bottom: 1em;
            page-break-after: avoid;
          }
          .chapter-content {
            text-align: justify;
            text-indent: 2em;
          }
          .chapter-content p {
            margin-bottom: 1em;
          }
          @page {
            margin: 1in;
          }
        </style>
      </head>
      <body>
        <div class="title">${this.escapeHtml(content.title)}</div>
    `;

    if (content.metadata.author) {
      html += `<div class="author">By ${this.escapeHtml(content.metadata.author)}</div>`;
    }

    // Add chapters
    for (const chapter of content.chapters) {
      html += `
        <div class="chapter">
          <div class="chapter-title">${this.escapeHtml(chapter.title)}</div>
          <div class="chapter-content">
      `;

      // Split content into paragraphs and wrap in <p> tags
      const paragraphs = chapter.content.split('\n\n');
      for (const paragraph of paragraphs) {
        if (paragraph.trim()) {
          html += `<p>${this.escapeHtml(paragraph.trim()).replace(/\n/g, '<br>')}</p>`;
        }
      }

      html += `
          </div>
        </div>
      `;
    }

    html += `
      </body>
      </html>
    `;

    return html;
  }

  /**
   * Escape HTML characters
   */
  private escapeHtml(text: string): string {
    const map: { [key: string]: string } = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Generate TXT file
   */
  private async generateTxt(
    content: ExportContent,
    filePath: string
  ): Promise<void> {
    let text = '';

    // Add title and metadata
    text += `${content.title}\n`;
    text += '='.repeat(content.title.length) + '\n\n';

    if (content.metadata.author) {
      text += `By ${content.metadata.author}\n\n`;
    }

    if (content.metadata.description) {
      text += `${content.metadata.description}\n\n`;
    }

    if (content.metadata.genre) {
      text += `Genre: ${content.metadata.genre}\n\n`;
    }

    // Add chapters
    for (const chapter of content.chapters) {
      text += `${chapter.title}\n`;
      text += '-'.repeat(chapter.title.length) + '\n\n';
      text += `${chapter.content}\n\n\n`;
    }

    await fs.promises.writeFile(filePath, text, 'utf8');
  }

  /**
   * Generate EPUB file using nodepub (more secure)
   */
  private async generateEpub(
    content: ExportContent,
    filePath: string
  ): Promise<void> {
    try {
      const epub = nodepub.document({
        title: content.title,
        author: content.metadata.author || 'Unknown Author',
        genre: content.metadata.genre || 'Fiction',
        language: content.metadata.language || 'en',
        publisher: 'QuillHaven',
        published: content.metadata.publishDate || new Date(),
        description: content.metadata.description || '',
      });

      // Add chapters
      for (const chapter of content.chapters) {
        // Convert plain text to HTML with proper paragraph formatting
        const htmlContent = chapter.content
          .split('\n\n')
          .map((paragraph) => paragraph.trim())
          .filter((paragraph) => paragraph.length > 0)
          .map(
            (paragraph) =>
              `<p>${this.escapeHtml(paragraph).replace(/\n/g, '<br>')}</p>`
          )
          .join('\n');

        epub.addSection(chapter.title, htmlContent);
      }

      return new Promise((resolve, reject) => {
        epub.writeEPUB(filePath, (err: unknown) => {
          if (err) {
            reject(new Error('EPUB generation failed'));
          } else {
            resolve();
          }
        });
      });
    } catch (error) {
      throw new Error('EPUB generation failed');
    }
  }

  /**
   * Update export status
   */
  private async updateExportStatus(
    exportId: string,
    status: string,
    error?: string
  ): Promise<void> {
    await prisma.export.update({
      where: { id: exportId },
      data: {
        status: status as 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED',
        updatedAt: new Date(),
        ...(error && { error }),
      },
    });
  }

  /**
   * Generate filename
   */
  private generateFilename(title: string, format: string): string {
    const sanitizedTitle = title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '_');
    const timestamp = new Date().toISOString().slice(0, 10);
    return `${sanitizedTitle}_${timestamp}.${format.toLowerCase()}`;
  }

  /**
   * Ensure export directory exists
   */
  private ensureExportDirectory(): void {
    if (!fs.existsSync(ExportService.EXPORT_DIR)) {
      fs.mkdirSync(ExportService.EXPORT_DIR, { recursive: true });
    }
  }

  /**
   * Generate export content from project and chapters
   */
  private async generateExportContent(
    project: any,
    chapters: any[],
    includeMetadata: boolean = true
  ): Promise<ExportContent> {
    const chapterContent: ChapterContent[] = chapters.map((chapter) => ({
      id: chapter.id,
      title: chapter.title,
      content: chapter.content,
      order: chapter.order,
      wordCount: chapter.wordCount,
    }));

    const metadata: ExportMetadata = includeMetadata
      ? {
          title: project.title,
          author:
            project.user?.firstName && project.user?.lastName
              ? `${project.user.firstName} ${project.user.lastName}`
              : undefined,
          description: project.description || undefined,
          genre: project.genre,
          language: 'en',
          publishDate: new Date(),
          version: '1.0',
        }
      : {
          title: project.title,
          genre: project.genre,
          language: 'en',
          publishDate: new Date(),
          version: '1.0',
        };

    return {
      title: project.title,
      chapters: chapterContent,
      metadata,
    };
  }

  /**
   * Generate file by format
   */
  private async generateFileByFormat(
    content: ExportContent,
    format: string,
    filePath: string
  ): Promise<void> {
    try {
      switch (format.toLowerCase()) {
        case 'docx':
          await this.generateDocx(content, filePath);
          break;
        case 'pdf':
          await this.generatePdf(content, filePath);
          break;
        case 'txt':
          await this.generateTxt(content, filePath);
          break;
        case 'epub':
          await this.generateEpub(content, filePath);
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`${format.toUpperCase()} generation failed`);
      }
      throw error;
    }
  }

  /**
   * Generate TXT export (updated method name for consistency)
   */
  private async generateTxtExport(
    project: any,
    chapters: any[],
    includeMetadata: boolean = true,
    filePath?: string
  ): Promise<string> {
    let text = '';

    // Add title and metadata
    text += `${project.title}\n`;
    text += '='.repeat(project.title.length) + '\n\n';

    if (includeMetadata) {
      if (project.description) {
        text += `${project.description}\n\n`;
      }

      if (project.genre) {
        text += `Genre: ${project.genre}\n\n`;
      }
    }

    // Add chapters
    for (const chapter of chapters) {
      text += `${chapter.title}\n`;
      text += '-'.repeat(chapter.title.length) + '\n\n';
      text += `${chapter.content}\n\n\n`;
    }

    if (filePath) {
      await fs.promises.writeFile(filePath, text, 'utf8');
    }

    return text;
  }

  /**
   * Get download URL for a filename
   */
  private getDownloadUrl(filename: string): string {
    const token = crypto.randomBytes(16).toString('hex');
    return `/api/exports/download/${filename}?token=${token}`;
  }

  /**
   * Clean up expired exports
   */
  async cleanupExpiredExports(): Promise<void> {
    try {
      const exportDir = ExportService.EXPORT_DIR;
      const files = await fs.promises.readdir(exportDir);

      for (const file of files) {
        const filePath = path.join(exportDir, file);
        const stats = await fs.promises.stat(filePath);

        // Check if file is older than MAX_FILE_AGE
        if (Date.now() - stats.mtime.getTime() > ExportService.MAX_FILE_AGE) {
          await fs.promises.unlink(filePath);
        }
      }
    } catch (error) {
      // Silently handle cleanup errors
      console.warn('Export cleanup failed:', error);
    }

    // Also clean up database records
    const expiredExports = await prisma.export.findMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    for (const exportRecord of expiredExports) {
      // Delete file if it exists
      const filePath = path.join(
        ExportService.EXPORT_DIR,
        `${exportRecord.id}.${exportRecord.format.toLowerCase()}`
      );
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      // Delete database record
      await prisma.export.delete({
        where: { id: exportRecord.id },
      });
    }
  }

  /**
   * Get export history for a user
   */
  async getExportHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      const exports = await prisma.export.findMany({
        where: {
          project: {
            userId: userId,
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
      });

      return exports;
    } catch (error) {
      console.error('Failed to get export history:', error);
      throw new Error('Failed to retrieve export history');
    }
  }

  /**
   * Get user's export history (legacy method)
   */
  async getUserExports(
    userId: string,
    limit: number = 10
  ): Promise<ExportJob[]> {
    const exports = await prisma.export.findMany({
      where: {
        project: {
          userId: userId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      include: {
        project: {
          select: {
            title: true,
          },
        },
      },
    });

    return exports.map((exportRecord) => ({
      id: exportRecord.id,
      projectId: exportRecord.projectId,
      format: exportRecord.format as 'DOCX' | 'PDF' | 'TXT' | 'EPUB',
      status: exportRecord.status as
        | 'PENDING'
        | 'PROCESSING'
        | 'COMPLETED'
        | 'FAILED',
      filename: exportRecord.filename,
      fileSize: exportRecord.fileSize || undefined,
      downloadUrl: exportRecord.downloadUrl || undefined,
      expiresAt: exportRecord.expiresAt || undefined,
      createdAt: exportRecord.createdAt,
      updatedAt: exportRecord.updatedAt,
    }));
  }
}

export const exportService = new ExportService();
