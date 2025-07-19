import { ExportService } from '../exportService';
import { prismaMock } from '../../../__mocks__/prisma';
import { Project, Chapter } from '@prisma/client';
import * as path from 'path';

// Mock file system operations
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn(),
    readdir: jest.fn(),
    stat: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn(),
  },
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
}));

// Mock puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue({
    newPage: jest.fn().mockResolvedValue({
      setContent: jest.fn(),
      pdf: jest.fn(),
    }),
    close: jest.fn(),
  }),
}));

// Mock queue service
jest.mock('../queueService', () => ({
  queueService: {
    registerProcessor: jest.fn(),
    addJob: jest.fn(),
  },
}));

const fs = require('fs');
const mockFs = fs;

// Mock external libraries
jest.mock('docx', () => ({
  Document: jest.fn().mockImplementation(() => ({
    addSection: jest.fn(),
  })),
  Packer: {
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('docx content')),
  },
  Paragraph: jest.fn().mockImplementation((props) => props),
  TextRun: jest.fn().mockImplementation((props) => props),
  HeadingLevel: {
    TITLE: 'TITLE',
    HEADING_1: 'HEADING_1',
    HEADING_2: 'HEADING_2',
  },
}));

jest.mock('jspdf', () => {
  return jest.fn().mockImplementation(() => ({
    text: jest.fn(),
    addPage: jest.fn(),
    save: jest.fn(),
    output: jest.fn().mockReturnValue('pdf content'),
  }));
});

jest.mock('nodepub', () => ({
  document: jest.fn().mockImplementation(() => ({
    addCSS: jest.fn(),
    addSection: jest.fn(),
    writeEPUB: jest.fn().mockResolvedValue(Buffer.from('epub content')),
  })),
}));

describe('ExportService', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    jest.clearAllMocks();
  });

  const mockProject: Project = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Novel',
    description: 'A test novel for export',
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
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date(),
  };

  const mockChapters: Chapter[] = [
    {
      id: 'chapter-1',
      projectId: 'project-1',
      title: 'Chapter 1: The Beginning',
      content: 'This is the first chapter content...',
      wordCount: 500,
      order: 1,
      status: 'final',
      generationParams: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 'chapter-2',
      projectId: 'project-1',
      title: 'Chapter 2: The Journey',
      content: 'This is the second chapter content...',
      wordCount: 600,
      order: 2,
      status: 'final',
      generationParams: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  describe('exportProject', () => {
    beforeEach(() => {
      // Reset all mocks first
      jest.clearAllMocks();

      // Set up basic mocks
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);
      prismaMock.export.findMany.mockResolvedValue([]);
      mockFs.promises.mkdir.mockResolvedValue(undefined);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as any);
      mockFs.promises.readdir.mockResolvedValue([]);

      // Set up library mocks to succeed by default
      const { Packer } = require('docx');
      Packer.toBuffer.mockResolvedValue(Buffer.from('docx content'));

      const puppeteer = require('puppeteer');
      puppeteer.launch.mockResolvedValue({
        newPage: jest.fn().mockResolvedValue({
          setContent: jest.fn(),
          pdf: jest.fn(),
        }),
        close: jest.fn(),
      });

      const nodepub = require('nodepub');
      nodepub.document.mockImplementation(() => ({
        addSection: jest.fn(),
        writeEPUB: jest.fn().mockImplementation((path, callback) => {
          callback(null); // Success
        }),
      }));
    });

    it('should export project as DOCX format', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'docx' as const,
        includeMetadata: true,
        chapterIds: ['chapter-1', 'chapter-2'],
      };

      const result = await exportService.exportProject(exportRequest);

      expect(result).toEqual({
        downloadUrl: expect.stringContaining('.docx'),
        filename: expect.stringContaining('Test_Novel'),
        format: 'docx',
        size: expect.any(Number),
        expiresAt: expect.any(Date),
      });

      expect(prismaMock.project.findFirst).toHaveBeenCalledWith({
        where: { id: 'project-1', userId: 'user-1' },
      });
    });

    it('should export project as PDF format', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'pdf' as const,
        includeMetadata: true,
        chapterIds: ['chapter-1', 'chapter-2'],
      };

      const result = await exportService.exportProject(exportRequest);

      expect(result).toEqual({
        downloadUrl: expect.stringContaining('.pdf'),
        filename: expect.stringContaining('Test_Novel'),
        format: 'pdf',
        size: expect.any(Number),
        expiresAt: expect.any(Date),
      });
    });

    it('should export project as TXT format', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: false,
        chapterIds: ['chapter-1'],
      };

      const result = await exportService.exportProject(exportRequest);

      expect(result).toEqual({
        downloadUrl: expect.stringContaining('.txt'),
        filename: expect.stringContaining('Test_Novel'),
        format: 'txt',
        size: expect.any(Number),
        expiresAt: expect.any(Date),
      });
    });

    it('should export project as EPUB format', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'epub' as const,
        includeMetadata: true,
        chapterIds: ['chapter-1', 'chapter-2'],
      };

      const result = await exportService.exportProject(exportRequest);

      expect(result).toEqual({
        downloadUrl: expect.stringContaining('.epub'),
        filename: expect.stringContaining('Test_Novel'),
        format: 'epub',
        size: expect.any(Number),
        expiresAt: expect.any(Date),
      });
    });

    it('should filter chapters by provided IDs', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: false,
        chapterIds: ['chapter-1'], // Only first chapter
      };

      await exportService.exportProject(exportRequest);

      expect(prismaMock.chapter.findMany).toHaveBeenCalledWith({
        where: {
          projectId: 'project-1',
          id: { in: ['chapter-1'] },
        },
        orderBy: { order: 'asc' },
      });
    });

    it('should include all chapters if no specific IDs provided', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: false,
      };

      await exportService.exportProject(exportRequest);

      expect(prismaMock.chapter.findMany).toHaveBeenCalledWith({
        where: { projectId: 'project-1' },
        orderBy: { order: 'asc' },
      });
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      const exportRequest = {
        projectId: 'nonexistent-project',
        userId: 'user-1',
        format: 'txt' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'Project not found'
      );
    });

    it('should throw error if no chapters found', async () => {
      prismaMock.chapter.findMany.mockResolvedValue([]);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'No chapters found for export'
      );
    });

    it('should handle file system errors gracefully', async () => {
      mockFs.promises.writeFile.mockRejectedValue(new Error('Disk full'));

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'Export failed: TXT generation failed'
      );
    });
  });

  describe('generateTxtExport', () => {
    it('should generate plain text export with metadata', async () => {
      const result = await exportService['generateTxtExport'](
        mockProject,
        mockChapters,
        true
      );

      expect(result).toContain('Test Novel');
      expect(result).toContain('A test novel for export');
      expect(result).toContain('Fantasy');
      expect(result).toContain('Chapter 1: The Beginning');
      expect(result).toContain('This is the first chapter content...');
      expect(result).toContain('Chapter 2: The Journey');
      expect(result).toContain('This is the second chapter content...');
    });

    it('should generate plain text export without metadata', async () => {
      const result = await exportService['generateTxtExport'](
        mockProject,
        mockChapters,
        false
      );

      expect(result).not.toContain('A test novel for export');
      expect(result).not.toContain('Fantasy');
      expect(result).toContain('Chapter 1: The Beginning');
      expect(result).toContain('This is the first chapter content...');
    });
  });

  describe('getDownloadUrl', () => {
    it('should generate secure download URL', () => {
      const filename = 'test-export.txt';
      const url = exportService['getDownloadUrl'](filename);

      expect(url).toContain('/api/exports/download/');
      expect(url).toContain(filename);
    });
  });

  describe('cleanupExpiredExports', () => {
    beforeEach(() => {
      prismaMock.export.findMany.mockResolvedValue([]);
      prismaMock.export.delete.mockResolvedValue({} as any);
    });

    it('should remove expired export files', async () => {
      const expiredFiles = ['expired-export-1.txt', 'expired-export-2.pdf'];

      mockFs.promises.readdir.mockResolvedValue(expiredFiles as any);
      mockFs.promises.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      } as any);
      mockFs.promises.unlink.mockResolvedValue(undefined);

      await exportService.cleanupExpiredExports();

      expect(mockFs.promises.unlink).toHaveBeenCalledTimes(2);
      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('expired-export-1.txt')
      );
      expect(mockFs.promises.unlink).toHaveBeenCalledWith(
        expect.stringContaining('expired-export-2.pdf')
      );
    });

    it('should not remove recent export files', async () => {
      const recentFiles = ['recent-export.txt'];

      mockFs.promises.readdir.mockResolvedValue(recentFiles as any);
      mockFs.promises.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      } as any);
      mockFs.promises.unlink.mockResolvedValue(undefined);

      await exportService.cleanupExpiredExports();

      expect(mockFs.promises.unlink).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.promises.readdir.mockRejectedValue(new Error('Permission denied'));

      // Should not throw
      await expect(
        exportService.cleanupExpiredExports()
      ).resolves.toBeUndefined();
    });
  });

  describe('getExportHistory', () => {
    it('should return export history for user', async () => {
      const mockExports = [
        {
          id: 'export-1',
          userId: 'user-1',
          projectId: 'project-1',
          format: 'pdf',
          filename: 'Test_Novel.pdf',
          downloadUrl: '/api/exports/download/test-novel.pdf',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      ];

      prismaMock.export.findMany.mockResolvedValue(mockExports as any);

      const result = await exportService.getExportHistory('user-1');

      expect(result).toEqual(mockExports);
      expect(prismaMock.export.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });
    });
  });

  describe('performance tests', () => {
    beforeEach(() => {
      // Reset mocks for performance tests
      jest.clearAllMocks();
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);
      prismaMock.export.findMany.mockResolvedValue([]);
      mockFs.promises.writeFile.mockResolvedValue(undefined);
      mockFs.promises.stat.mockResolvedValue({ size: 1024 } as any);
    });

    it('should handle large projects efficiently', async () => {
      // Create a large project with many chapters
      const largeChapters = Array.from({ length: 100 }, (_, i) => ({
        id: `chapter-${i + 1}`,
        projectId: 'project-1',
        title: `Chapter ${i + 1}`,
        content: 'Lorem ipsum '.repeat(1000), // ~11,000 characters per chapter
        wordCount: 1000,
        order: i + 1,
        status: 'final' as const,
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      prismaMock.chapter.findMany.mockResolvedValue(largeChapters);

      const startTime = Date.now();

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
      };

      await exportService.exportProject(exportRequest);

      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should complete within 30 seconds for large projects
      expect(executionTime).toBeLessThan(30000);
    });

    it('should handle concurrent export requests', async () => {
      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
      };

      // Run 5 concurrent exports
      const promises = Array.from({ length: 5 }, () =>
        exportService.exportProject(exportRequest)
      );

      const results = await Promise.all(promises);

      // All exports should succeed
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.downloadUrl).toBeDefined();
        expect(result.filename).toBeDefined();
      });
    });
  });

  describe('error handling', () => {
    beforeEach(() => {
      // Ensure project and chapters are found for error handling tests
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);
    });

    it('should handle DOCX generation errors', async () => {
      const { Packer } = require('docx');
      Packer.toBuffer.mockRejectedValue(new Error('DOCX generation failed'));

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'docx' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'Export failed: DOCX generation failed'
      );
    });

    it('should handle PDF generation errors', async () => {
      const puppeteer = require('puppeteer');
      puppeteer.launch.mockRejectedValue(new Error('PDF generation failed'));

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'pdf' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'Export failed: PDF generation failed'
      );
    });

    it('should handle EPUB generation errors', async () => {
      const nodepub = require('nodepub');
      nodepub.document.mockImplementation(() => ({
        addSection: jest.fn(),
        writeEPUB: jest.fn().mockImplementation((path, callback) => {
          callback(new Error('EPUB generation failed'));
        }),
      }));

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'epub' as const,
      };

      await expect(exportService.exportProject(exportRequest)).rejects.toThrow(
        'Export failed: EPUB generation failed'
      );
    });
  });
});
