import { exportService } from '../exportService';
import { ExportRequest } from '@/types/export';

// Mock Prisma
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
  },
}));

// Mock queue service
jest.mock('../queueService', () => ({
  queueService: {
    addJob: jest.fn(),
    registerProcessor: jest.fn(),
  },
}));

// Mock file system operations
jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  mkdirSync: jest.fn(),
  writeFileSync: jest.fn(),
  readFileSync: jest.fn(() => Buffer.from('test content')),
  statSync: jest.fn(() => ({ size: 1024 })),
}));

// Mock Puppeteer
jest.mock('puppeteer', () => ({
  launch: jest.fn(() => ({
    newPage: jest.fn(() => ({
      setContent: jest.fn(),
      pdf: jest.fn(),
    })),
    close: jest.fn(),
  })),
}));

// Mock nodepub
jest.mock('nodepub', () => ({
  document: jest.fn(() => ({
    addSection: jest.fn(),
    writeEPUB: jest.fn((path, callback) => callback(null)),
  })),
}));

// Mock archiver
jest.mock('archiver', () => jest.fn());

// Mock docx
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

describe('ExportService', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'project-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createExport', () => {
    it('should create an export request successfully', async () => {
      const mockProject = {
        id: mockProjectId,
        userId: mockUserId,
        title: 'Test Project',
      };

      const mockExport = {
        id: 'export-123',
        projectId: mockProjectId,
        format: 'DOCX',
        filename: 'Test_Project_2025-01-01.docx',
        status: 'PENDING',
      };

      const { prisma } = require('@/lib/prisma');
      const { queueService } = require('../queueService');

      prisma.project.findFirst.mockResolvedValue(mockProject);
      prisma.export.create.mockResolvedValue(mockExport);
      queueService.addJob.mockResolvedValue('job-123');

      const request: ExportRequest = {
        projectId: mockProjectId,
        format: 'DOCX',
      };

      const result = await exportService.createExport(request, mockUserId);

      expect(result.success).toBe(true);
      expect(result.exportId).toBe('export-123');
      expect(prisma.project.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockProjectId,
          userId: mockUserId,
        },
      });
      expect(queueService.addJob).toHaveBeenCalledWith('export', {
        exportId: 'export-123',
        request,
        userId: mockUserId,
      });
    });

    it('should return error for non-existent project', async () => {
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
  });

  describe('getExportStatus', () => {
    it('should return export status successfully', async () => {
      const mockExport = {
        id: 'export-123',
        projectId: mockProjectId,
        format: 'DOCX',
        status: 'COMPLETED',
        filename: 'test.docx',
        fileSize: 1024,
        downloadUrl: '/download/123',
        expiresAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const { prisma } = require('@/lib/prisma');
      prisma.export.findFirst.mockResolvedValue(mockExport);

      const result = await exportService.getExportStatus('export-123', mockUserId);

      expect(result).toEqual({
        id: 'export-123',
        projectId: mockProjectId,
        format: 'DOCX',
        status: 'COMPLETED',
        filename: 'test.docx',
        fileSize: 1024,
        downloadUrl: '/download/123',
        expiresAt: mockExport.expiresAt,
        createdAt: mockExport.createdAt,
        updatedAt: mockExport.updatedAt,
      });
    });

    it('should return null for non-existent export', async () => {
      const { prisma } = require('@/lib/prisma');
      prisma.export.findFirst.mockResolvedValue(null);

      const result = await exportService.getExportStatus('non-existent', mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('generateDownloadLink', () => {
    it('should generate download link for completed export', async () => {
      const mockExport = {
        id: 'export-123',
        status: 'COMPLETED',
      };

      const { prisma } = require('@/lib/prisma');
      prisma.export.findUnique.mockResolvedValue(mockExport);
      prisma.export.update.mockResolvedValue({});

      const result = await exportService.generateDownloadLink('export-123');

      expect(result).toContain('/api/exports/export-123/download?token=');
      expect(prisma.export.update).toHaveBeenCalled();
    });

    it('should return null for non-completed export', async () => {
      const mockExport = {
        id: 'export-123',
        status: 'PENDING',
      };

      const { prisma } = require('@/lib/prisma');
      prisma.export.findUnique.mockResolvedValue(mockExport);

      const result = await exportService.generateDownloadLink('export-123');

      expect(result).toBeNull();
    });
  });
});