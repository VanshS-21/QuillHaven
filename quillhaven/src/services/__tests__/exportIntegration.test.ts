/**
 * Integration test for export functionality
 * This test verifies the complete export workflow
 */
/* eslint-disable @typescript-eslint/no-require-imports */

// Mock external dependencies BEFORE imports
jest.mock('@/lib/prisma', () => ({
  prisma: {
    project: {
      findFirst: jest.fn(),
    },
    export: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    queueJob: {
      create: jest.fn(() => Promise.resolve({ id: 'job-123' })),
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      fields: {
        maxAttempts: 'maxAttempts',
      },
    },
  },
}));

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => Buffer.from('test content')),
  statSync: jest.fn(() => ({ size: 1024 })),
}));

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: {
    launch: jest.fn(() => ({
      newPage: jest.fn(() => ({
        setContent: jest.fn(),
        pdf: jest.fn(),
      })),
      close: jest.fn(),
    })),
  },
}));

jest.mock('nodepub', () => ({
  document: jest.fn(() => ({
    addSection: jest.fn(),
    writeEPUB: jest.fn((path, callback) => callback(null)),
  })),
}));

jest.mock('archiver', () => jest.fn());

jest.mock('docx', () => ({
  Document: jest.fn(),
  Packer: {
    toBuffer: jest.fn(() => Promise.resolve(Buffer.from('docx content'))),
  },
  Paragraph: jest.fn(),
  TextRun: jest.fn(),
  HeadingLevel: {
    TITLE: 'TITLE',
    HEADING_1: 'HEADING_1',
  },
}));

// Mock queue service
jest.mock('../queueService', () => ({
  queueService: {
    addJob: jest.fn(() => Promise.resolve('job-123')),
    registerProcessor: jest.fn(),
    stopProcessing: jest.fn(),
    cleanupOldJobs: jest.fn(),
  },
  SimpleQueueService: {
    getInstance: jest.fn(() => ({
      addJob: jest.fn(() => Promise.resolve('job-123')),
      registerProcessor: jest.fn(),
      stopProcessing: jest.fn(),
      cleanupOldJobs: jest.fn(),
    })),
  },
}));

import { exportService } from '../exportService';
import { ExportRequest } from '@/types/export';

describe('Export Integration', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle complete export workflow', async () => {
    // Mock project data
    const mockProject = {
      id: mockProjectId,
      userId: mockUserId,
      title: 'Test Novel',
      description: 'A test novel',
      genre: 'Fiction',
      user: {
        firstName: 'John',
        lastName: 'Doe',
      },
      chapters: [
        {
          id: 'chapter-1',
          title: 'Chapter 1: The Beginning',
          content: 'Once upon a time...\n\nIn a land far away...',
          order: 1,
          wordCount: 100,
        },
        {
          id: 'chapter-2',
          title: 'Chapter 2: The Journey',
          content:
            'The hero set out on a journey...\n\nMany challenges awaited...',
          order: 2,
          wordCount: 150,
        },
      ],
    };

    const mockExport = {
      id: 'export-123',
      projectId: mockProjectId,
      format: 'DOCX',
      filename: 'Test_Novel_2025-01-01.docx',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    // Setup mocks
    const { prisma } = require('@/lib/prisma');
    prisma.project.findFirst.mockResolvedValue(mockProject);
    prisma.export.create.mockResolvedValue(mockExport);
    prisma.export.update.mockResolvedValue({
      ...mockExport,
      status: 'COMPLETED',
    });

    // Test export creation
    const request: ExportRequest = {
      projectId: mockProjectId,
      format: 'DOCX',
      includeMetadata: true,
      metadata: {
        author: 'John Doe',
        description: 'A test novel for integration testing',
      },
    };

    const result = await exportService.createExport(request, mockUserId);

    expect(result.success).toBe(true);
    expect(result.exportId).toBe('export-123');

    // Verify export was queued
    expect(prisma.export.create).toHaveBeenCalledWith({
      data: {
        projectId: mockProjectId,
        format: 'DOCX',
        filename: expect.stringContaining('Test_Novel'),
        status: 'PENDING',
        expiresAt: expect.any(Date),
      },
    });
  });

  it('should validate export request data', async () => {
    const { prisma } = require('@/lib/prisma');
    prisma.project.findFirst.mockResolvedValue(null);

    const request: ExportRequest = {
      projectId: 'non-existent',
      format: 'DOCX',
    };

    const result = await exportService.createExport(request, mockUserId);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Project not found or access denied');
  });

  it('should generate secure download links', async () => {
    const mockExport = {
      id: 'export-123',
      status: 'COMPLETED',
    };

    const { prisma } = require('@/lib/prisma');
    prisma.export.findUnique.mockResolvedValue(mockExport);
    prisma.export.update.mockResolvedValue({});

    const downloadUrl = await exportService.generateDownloadLink('export-123');

    expect(downloadUrl).toContain('/api/exports/export-123/download');
    expect(downloadUrl).toContain('token=');
    expect(downloadUrl).toContain('expires=');
  });

  it('should handle export status tracking', async () => {
    const mockExport = {
      id: 'export-123',
      projectId: mockProjectId,
      format: 'PDF',
      status: 'PROCESSING',
      filename: 'test.pdf',
      fileSize: null,
      downloadUrl: null,
      expiresAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const { prisma } = require('@/lib/prisma');
    prisma.export.findFirst.mockResolvedValue(mockExport);

    const status = await exportService.getExportStatus(
      'export-123',
      mockUserId
    );

    expect(status).toEqual({
      id: 'export-123',
      projectId: mockProjectId,
      format: 'PDF',
      status: 'PROCESSING',
      filename: 'test.pdf',
      fileSize: undefined,
      downloadUrl: undefined,
      expiresAt: mockExport.expiresAt,
      createdAt: mockExport.createdAt,
      updatedAt: mockExport.updatedAt,
    });
  });

  it('should support all export formats', async () => {
    const formats: Array<'DOCX' | 'PDF' | 'TXT' | 'EPUB'> = [
      'DOCX',
      'PDF',
      'TXT',
      'EPUB',
    ];

    const mockProject = {
      id: mockProjectId,
      userId: mockUserId,
      title: 'Test Project',
    };

    const { prisma } = require('@/lib/prisma');
    prisma.project.findFirst.mockResolvedValue(mockProject);

    for (const format of formats) {
      const mockExport = {
        id: `export-${format}`,
        projectId: mockProjectId,
        format,
        filename: `test.${format.toLowerCase()}`,
        status: 'PENDING',
      };

      prisma.export.create.mockResolvedValue(mockExport);

      const request: ExportRequest = {
        projectId: mockProjectId,
        format,
      };

      const result = await exportService.createExport(request, mockUserId);

      expect(result.success).toBe(true);
      expect(result.exportId).toBe(`export-${format}`);
    }
  });
});
