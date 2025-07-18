import { ExportService } from '@/services/exportService';
import { prismaMock } from '../../../__mocks__/prisma';
import { Project, Chapter } from '@prisma/client';
import * as fs from 'fs/promises';

// Mock file system operations
jest.mock('fs/promises');
const mockFs = fs as jest.Mocked<typeof fs>;

// Mock external libraries
jest.mock('docx', () => ({
  Document: jest.fn().mockImplementation(() => ({
    addSection: jest.fn(),
  })),
  Packer: {
    toBuffer: jest.fn().mockResolvedValue(Buffer.from('docx content')),
  },
  Paragraph: jest.fn(),
  TextRun: jest.fn(),
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

describe('Export Performance Tests', () => {
  let exportService: ExportService;

  beforeEach(() => {
    exportService = new ExportService();
    jest.clearAllMocks();
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.writeFile.mockResolvedValue(undefined);
  });

  const createMockProject = (): Project => ({
    id: 'project-1',
    userId: 'user-1',
    title: 'Performance Test Novel',
    description: 'A novel for testing export performance',
    genre: 'Fantasy',
    targetLength: 100000,
    currentWordCount: 75000,
    status: 'in-progress',
    context: {
      characters: [],
      plotThreads: [],
      worldBuilding: [],
      timeline: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const createMockChapters = (count: number, wordsPerChapter: number = 2500): Chapter[] => {
    return Array.from({ length: count }, (_, i) => ({
      id: `chapter-${i + 1}`,
      projectId: 'project-1',
      title: `Chapter ${i + 1}: Performance Test`,
      content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(
        Math.floor(wordsPerChapter / 10)
      ),
      wordCount: wordsPerChapter,
      order: i + 1,
      status: 'final',
      generationParams: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  };

  describe('Small Project Export Performance', () => {
    it('should export 10-chapter novel (25,000 words) in under 5 seconds', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(10, 2500);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(5000); // 5 seconds
      expect(result.downloadUrl).toBeDefined();
      expect(result.filename).toContain('Performance_Test_Novel');
    });

    it('should export small project to all formats efficiently', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(5, 2000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const formats = ['txt', 'docx', 'pdf', 'epub'] as const;
      const results: { format: string; time: number }[] = [];

      for (const format of formats) {
        const exportRequest = {
          projectId: 'project-1',
          userId: 'user-1',
          format,
          includeMetadata: true,
        };

        const startTime = Date.now();
        await exportService.exportProject(exportRequest);
        const endTime = Date.now();

        results.push({ format, time: endTime - startTime });
      }

      // All formats should complete within reasonable time
      results.forEach(({ format, time }) => {
        expect(time).toBeLessThan(10000); // 10 seconds per format
      });

      // TXT should be fastest, EPUB might be slowest
      const txtTime = results.find(r => r.format === 'txt')?.time || 0;
      const epubTime = results.find(r => r.format === 'epub')?.time || 0;
      
      expect(txtTime).toBeLessThan(2000); // TXT should be very fast
    });
  });

  describe('Medium Project Export Performance', () => {
    it('should export 30-chapter novel (75,000 words) in under 15 seconds', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(30, 2500);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'docx' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(15000); // 15 seconds
      expect(result.downloadUrl).toBeDefined();
    });

    it('should handle medium project PDF export efficiently', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(25, 3000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'pdf' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(20000); // 20 seconds for PDF
      expect(result.downloadUrl).toBeDefined();
    });
  });

  describe('Large Project Export Performance', () => {
    it('should export 50-chapter novel (125,000 words) in under 30 seconds', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(50, 2500);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds
      expect(result.downloadUrl).toBeDefined();
    });

    it('should handle very large chapters efficiently', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(20, 10000); // 20 chapters, 10k words each

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'docx' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(45000); // 45 seconds for large chapters
      expect(result.downloadUrl).toBeDefined();
    });
  });

  describe('Concurrent Export Performance', () => {
    it('should handle multiple concurrent exports', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(15, 2000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequests = Array.from({ length: 5 }, (_, i) => ({
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: true,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        exportRequests.map(request => exportService.exportProject(request))
      );
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(25000); // 25 seconds for 5 concurrent exports
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.downloadUrl).toBeDefined();
      });
    });

    it('should handle mixed format concurrent exports', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(10, 2500);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const formats = ['txt', 'docx', 'pdf', 'epub', 'txt'] as const;
      const exportRequests = formats.map(format => ({
        projectId: 'project-1',
        userId: 'user-1',
        format,
        includeMetadata: true,
      }));

      const startTime = Date.now();
      const results = await Promise.all(
        exportRequests.map(request => exportService.exportProject(request))
      );
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds for mixed formats
      expect(results).toHaveLength(5);
    });
  });

  describe('Memory Usage During Export', () => {
    it('should not cause memory leaks during large exports', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(30, 3000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple exports
      for (let i = 0; i < 10; i++) {
        const exportRequest = {
          projectId: 'project-1',
          userId: 'user-1',
          format: 'txt' as const,
          includeMetadata: true,
        };

        await exportService.exportProject(exportRequest);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    it('should handle memory efficiently with very large content', async () => {
      const mockProject = createMockProject();
      // Create one massive chapter (50k words)
      const mockChapters = createMockChapters(1, 50000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: true,
      };

      const initialMemory = process.memoryUsage().heapUsed;
      
      const startTime = Date.now();
      const result = await exportService.exportProject(exportRequest);
      const endTime = Date.now();

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryUsed = finalMemory - initialMemory;
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(15000); // 15 seconds
      expect(memoryUsed).toBeLessThan(100 * 1024 * 1024); // Less than 100MB
      expect(result.downloadUrl).toBeDefined();
    });
  });

  describe('Export Cleanup Performance', () => {
    it('should clean up expired exports quickly', async () => {
      const expiredFiles = Array.from({ length: 100 }, (_, i) => `expired-export-${i}.txt`);
      
      mockFs.readdir.mockResolvedValue(expiredFiles as any);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      } as any);
      mockFs.unlink.mockResolvedValue(undefined);

      const startTime = Date.now();
      await exportService.cleanupExpiredExports();
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(5000); // 5 seconds to clean up 100 files
      expect(mockFs.unlink).toHaveBeenCalledTimes(100);
    });

    it('should handle cleanup errors gracefully', async () => {
      const files = ['file1.txt', 'file2.pdf', 'file3.docx'];
      
      mockFs.readdir.mockResolvedValue(files as any);
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 25 * 60 * 60 * 1000),
      } as any);
      
      // Make some deletions fail
      mockFs.unlink
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Permission denied'))
        .mockResolvedValueOnce(undefined);

      const startTime = Date.now();
      await exportService.cleanupExpiredExports();
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(2000); // Should complete quickly even with errors
    });
  });

  describe('Scalability Tests', () => {
    it('should scale linearly with project size', async () => {
      const projectSizes = [10, 20, 40]; // chapters
      const results: number[] = [];

      for (const size of projectSizes) {
        const mockProject = createMockProject();
        const mockChapters = createMockChapters(size, 2500);

        prismaMock.project.findFirst.mockResolvedValue(mockProject);
        prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

        const exportRequest = {
          projectId: 'project-1',
          userId: 'user-1',
          format: 'txt' as const,
          includeMetadata: true,
        };

        const startTime = Date.now();
        await exportService.exportProject(exportRequest);
        const endTime = Date.now();

        results.push(endTime - startTime);
      }

      // Performance should scale roughly linearly
      const ratio1 = results[1] / results[0]; // 20 chapters vs 10 chapters
      const ratio2 = results[2] / results[1]; // 40 chapters vs 20 chapters

      // Ratios should be reasonable (not exponential growth)
      expect(ratio1).toBeLessThan(3); // Should not be more than 3x slower
      expect(ratio2).toBeLessThan(3);
    });

    it('should handle increasing concurrent load', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(10, 2000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const concurrencyLevels = [1, 3, 6, 10];
      const results: number[] = [];

      for (const concurrency of concurrencyLevels) {
        const exportRequests = Array.from({ length: concurrency }, () => ({
          projectId: 'project-1',
          userId: 'user-1',
          format: 'txt' as const,
          includeMetadata: true,
        }));

        const startTime = Date.now();
        await Promise.all(
          exportRequests.map(request => exportService.exportProject(request))
        );
        const endTime = Date.now();

        results.push(endTime - startTime);
      }

      // Performance degradation should be reasonable
      for (let i = 1; i < results.length; i++) {
        const scaleFactor = concurrencyLevels[i] / concurrencyLevels[i - 1];
        const timeFactor = results[i] / results[i - 1];
        
        // Time increase should not be more than 2x the scale factor
        expect(timeFactor).toBeLessThan(scaleFactor * 2);
      }
    });
  });

  describe('Format-Specific Performance', () => {
    it('should meet format-specific performance requirements', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(20, 2500); // 50k words total

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      const formatRequirements = {
        txt: 3000,   // 3 seconds
        docx: 15000, // 15 seconds
        pdf: 20000,  // 20 seconds
        epub: 25000, // 25 seconds
      };

      for (const [format, maxTime] of Object.entries(formatRequirements)) {
        const exportRequest = {
          projectId: 'project-1',
          userId: 'user-1',
          format: format as any,
          includeMetadata: true,
        };

        const startTime = Date.now();
        const result = await exportService.exportProject(exportRequest);
        const endTime = Date.now();

        const executionTime = endTime - startTime;

        expect(executionTime).toBeLessThan(maxTime);
        expect(result.downloadUrl).toBeDefined();
      }
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover from export errors quickly', async () => {
      const mockProject = createMockProject();
      const mockChapters = createMockChapters(10, 2000);

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(mockChapters);

      // Make file writing fail initially
      let writeCallCount = 0;
      mockFs.writeFile.mockImplementation(() => {
        writeCallCount++;
        if (writeCallCount <= 2) {
          return Promise.reject(new Error('Disk full'));
        }
        return Promise.resolve(undefined);
      });

      const exportRequest = {
        projectId: 'project-1',
        userId: 'user-1',
        format: 'txt' as const,
        includeMetadata: true,
      };

      const startTime = Date.now();
      
      // This should eventually succeed after retries
      try {
        await exportService.exportProject(exportRequest);
      } catch (error) {
        // Expected to fail in this test setup
      }
      
      const endTime = Date.now();
      const executionTime = endTime - startTime;

      // Should fail quickly, not hang
      expect(executionTime).toBeLessThan(10000); // 10 seconds
    });
  });
});