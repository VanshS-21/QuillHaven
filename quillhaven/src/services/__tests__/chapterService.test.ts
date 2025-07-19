import { ChapterService } from '../chapterService';
import { prismaMock } from '../../../__mocks__/prisma';
import { AIService } from '../aiService';
import { Chapter, Project } from '@prisma/client';

// Mock AI Service
jest.mock('../aiService');
const MockAIService = AIService as jest.MockedClass<typeof AIService>;

describe('ChapterService', () => {
  let chapterService: ChapterService;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(() => {
    mockAIService = new MockAIService() as jest.Mocked<AIService>;
    chapterService = new ChapterService();
    jest.clearAllMocks();
  });

  describe('createChapter', () => {
    const mockChapterData = {
      title: 'Chapter 1: The Beginning',
      content: 'Once upon a time...',
      projectId: 'project-1',
    };

    it('should create a chapter successfully', async () => {
      const mockChapter: Chapter = {
        id: 'chapter-1',
        projectId: mockChapterData.projectId,
        title: mockChapterData.title,
        content: mockChapterData.content,
        wordCount: 4, // "Once upon a time"
        order: 1,
        status: 'draft',
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.chapter.count.mockResolvedValue(0);
      prismaMock.chapter.create.mockResolvedValue(mockChapter);

      const result = await chapterService.createChapter(mockChapterData);

      expect(result).toEqual(mockChapter);
      expect(prismaMock.chapter.create).toHaveBeenCalledWith({
        data: {
          projectId: mockChapterData.projectId,
          title: mockChapterData.title,
          content: mockChapterData.content,
          wordCount: 4,
          order: 1,
          status: 'draft',
        },
      });
    });

    it('should set correct order for new chapters', async () => {
      prismaMock.chapter.count.mockResolvedValue(3); // 3 existing chapters
      prismaMock.chapter.create.mockResolvedValue({} as Chapter);

      await chapterService.createChapter(mockChapterData);

      expect(prismaMock.chapter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          order: 4, // Should be next in sequence
        }),
      });
    });

    it('should calculate word count correctly', async () => {
      const longContent =
        'This is a longer chapter with more words to count accurately.';

      prismaMock.chapter.count.mockResolvedValue(0);
      prismaMock.chapter.create.mockResolvedValue({} as Chapter);

      await chapterService.createChapter({
        ...mockChapterData,
        content: longContent,
      });

      expect(prismaMock.chapter.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          wordCount: 11, // Actual word count
        }),
      });
    });
  });

  describe('generateChapter', () => {
    const mockGenerationRequest = {
      projectId: 'project-1',
      prompt: "Write about the hero's journey",
      parameters: {
        length: 2000,
        tone: 'adventurous',
        style: 'fantasy',
        focusCharacters: ['char-1'],
        plotPoints: ['plot-1'],
      },
    };

    const mockProject: Project = {
      id: 'project-1',
      userId: 'user-1',
      title: 'Test Project',
      description: 'Description',
      genre: 'Fantasy',
      targetLength: 80000,
      currentWordCount: 5000,
      status: 'in-progress',
      context: {
        characters: [
          {
            id: 'char-1',
            name: 'Hero',
            description: 'The main character',
            role: 'protagonist',
            relationships: [],
            developmentArc: 'Growth',
          },
        ],
        plotThreads: [
          {
            id: 'plot-1',
            title: 'Main Quest',
            description: 'Save the world',
            status: 'developing',
            relatedCharacters: ['char-1'],
            chapterReferences: [],
          },
        ],
        worldBuilding: [],
        timeline: [],
      },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should generate a chapter using AI service', async () => {
      const mockAIResponse = {
        content: 'Generated chapter content about the hero...',
        wordCount: 2000,
        generatedAt: new Date(),
        parameters: mockGenerationRequest.parameters,
      };

      const mockChapter: Chapter = {
        id: 'chapter-1',
        projectId: mockGenerationRequest.projectId,
        title: 'Generated Chapter',
        content: mockAIResponse.content,
        wordCount: mockAIResponse.wordCount,
        order: 1,
        status: 'generated',
        generationParams: mockGenerationRequest.parameters,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.project.findUnique.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue([]);
      prismaMock.chapter.count.mockResolvedValue(0);
      mockAIService.generateChapter.mockResolvedValue(mockAIResponse);
      prismaMock.chapter.create.mockResolvedValue(mockChapter);

      const result = await chapterService.generateChapter(
        mockGenerationRequest
      );

      expect(result).toEqual(mockChapter);
      expect(mockAIService.generateChapter).toHaveBeenCalledWith({
        prompt: mockGenerationRequest.prompt,
        projectContext: mockProject.context,
        previousChapters: [],
        parameters: mockGenerationRequest.parameters,
      });
    });

    it('should include previous chapters in generation context', async () => {
      const previousChapters = [
        {
          id: 'prev-1',
          content: 'Previous chapter content...',
          order: 1,
        },
      ];

      prismaMock.project.findUnique.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue(
        previousChapters as Chapter[]
      );
      prismaMock.chapter.count.mockResolvedValue(1);
      mockAIService.generateChapter.mockResolvedValue({
        content: 'Generated content',
        wordCount: 1000,
        generatedAt: new Date(),
        parameters: mockGenerationRequest.parameters,
      });
      prismaMock.chapter.create.mockResolvedValue({} as Chapter);

      await chapterService.generateChapter(mockGenerationRequest);

      expect(mockAIService.generateChapter).toHaveBeenCalledWith({
        prompt: mockGenerationRequest.prompt,
        projectContext: mockProject.context,
        previousChapters: ['Previous chapter content...'],
        parameters: mockGenerationRequest.parameters,
      });
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findUnique.mockResolvedValue(null);

      await expect(
        chapterService.generateChapter(mockGenerationRequest)
      ).rejects.toThrow('Project not found');
    });

    it('should handle AI service errors', async () => {
      prismaMock.project.findUnique.mockResolvedValue(mockProject);
      prismaMock.chapter.findMany.mockResolvedValue([]);
      mockAIService.generateChapter.mockRejectedValue(
        new Error('AI service error')
      );

      await expect(
        chapterService.generateChapter(mockGenerationRequest)
      ).rejects.toThrow('Failed to generate chapter: AI service error');
    });
  });

  describe('updateChapter', () => {
    const chapterId = 'chapter-1';
    const updateData = {
      title: 'Updated Chapter Title',
      content: 'Updated chapter content with more words.',
    };

    it('should update chapter and recalculate word count', async () => {
      const existingChapter: Chapter = {
        id: chapterId,
        projectId: 'project-1',
        title: 'Old Title',
        content: 'Old content',
        wordCount: 2,
        order: 1,
        status: 'draft',
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedChapter: Chapter = {
        ...existingChapter,
        ...updateData,
        wordCount: 7, // "Updated chapter content with more words"
        status: 'edited',
        updatedAt: new Date(),
      };

      prismaMock.chapter.findUnique.mockResolvedValue(existingChapter);
      prismaMock.chapter.update.mockResolvedValue(updatedChapter);

      const result = await chapterService.updateChapter(chapterId, updateData);

      expect(result).toEqual(updatedChapter);
      expect(prismaMock.chapter.update).toHaveBeenCalledWith({
        where: { id: chapterId },
        data: {
          ...updateData,
          wordCount: 7,
          status: 'edited',
        },
      });
    });

    it('should create version history entry', async () => {
      const existingChapter: Chapter = {
        id: chapterId,
        projectId: 'project-1',
        title: 'Old Title',
        content: 'Old content',
        wordCount: 2,
        order: 1,
        status: 'draft',
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.chapter.findUnique.mockResolvedValue(existingChapter);
      prismaMock.chapter.update.mockResolvedValue({} as Chapter);
      prismaMock.chapterVersion.create.mockResolvedValue({} as any);

      await chapterService.updateChapter(chapterId, updateData);

      expect(prismaMock.chapterVersion.create).toHaveBeenCalledWith({
        data: {
          chapterId,
          title: existingChapter.title,
          content: existingChapter.content,
          wordCount: existingChapter.wordCount,
          version: expect.any(Number),
        },
      });
    });

    it('should throw error if chapter not found', async () => {
      prismaMock.chapter.findUnique.mockResolvedValue(null);

      await expect(
        chapterService.updateChapter(chapterId, updateData)
      ).rejects.toThrow('Chapter not found');
    });
  });

  describe('deleteChapter', () => {
    const chapterId = 'chapter-1';

    it('should delete chapter and reorder remaining chapters', async () => {
      const chapterToDelete: Chapter = {
        id: chapterId,
        projectId: 'project-1',
        title: 'Chapter to Delete',
        content: 'Content',
        wordCount: 100,
        order: 2,
        status: 'draft',
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const remainingChapters = [
        { id: 'chapter-3', order: 3 },
        { id: 'chapter-4', order: 4 },
      ];

      prismaMock.chapter.findUnique.mockResolvedValue(chapterToDelete);
      prismaMock.chapter.findMany.mockResolvedValue(
        remainingChapters as Chapter[]
      );
      prismaMock.chapterVersion.deleteMany.mockResolvedValue({ count: 2 });
      prismaMock.chapter.delete.mockResolvedValue(chapterToDelete);
      prismaMock.chapter.updateMany.mockResolvedValue({ count: 2 });

      const result = await chapterService.deleteChapter(chapterId);

      expect(result).toEqual({ message: 'Chapter deleted successfully' });

      // Verify deletion order
      expect(prismaMock.chapterVersion.deleteMany).toHaveBeenCalledWith({
        where: { chapterId },
      });
      expect(prismaMock.chapter.delete).toHaveBeenCalledWith({
        where: { id: chapterId },
      });

      // Verify reordering
      expect(prismaMock.chapter.updateMany).toHaveBeenCalledWith({
        where: {
          projectId: chapterToDelete.projectId,
          order: { gt: chapterToDelete.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    });

    it('should throw error if chapter not found', async () => {
      prismaMock.chapter.findUnique.mockResolvedValue(null);

      await expect(chapterService.deleteChapter(chapterId)).rejects.toThrow(
        'Chapter not found'
      );
    });
  });

  describe('reorderChapters', () => {
    const projectId = 'project-1';
    const newOrder = ['chapter-3', 'chapter-1', 'chapter-2'];

    it('should reorder chapters correctly', async () => {
      const existingChapters = [
        { id: 'chapter-1', order: 1 },
        { id: 'chapter-2', order: 2 },
        { id: 'chapter-3', order: 3 },
      ];

      prismaMock.chapter.findMany.mockResolvedValue(
        existingChapters as Chapter[]
      );
      prismaMock.chapter.update.mockResolvedValue({} as Chapter);

      const result = await chapterService.reorderChapters(projectId, newOrder);

      expect(result).toEqual({ message: 'Chapters reordered successfully' });

      // Verify each chapter gets updated with correct order
      expect(prismaMock.chapter.update).toHaveBeenCalledWith({
        where: { id: 'chapter-3' },
        data: { order: 1 },
      });
      expect(prismaMock.chapter.update).toHaveBeenCalledWith({
        where: { id: 'chapter-1' },
        data: { order: 2 },
      });
      expect(prismaMock.chapter.update).toHaveBeenCalledWith({
        where: { id: 'chapter-2' },
        data: { order: 3 },
      });
    });

    it('should validate that all chapters exist', async () => {
      const existingChapters = [
        { id: 'chapter-1', order: 1 },
        { id: 'chapter-2', order: 2 },
      ];

      prismaMock.chapter.findMany.mockResolvedValue(
        existingChapters as Chapter[]
      );

      await expect(
        chapterService.reorderChapters(projectId, [
          'chapter-1',
          'chapter-2',
          'chapter-3',
        ])
      ).rejects.toThrow('Invalid chapter order: some chapters do not exist');
    });
  });

  describe('getChapterVersions', () => {
    const chapterId = 'chapter-1';

    it('should return chapter version history', async () => {
      const mockVersions = [
        {
          id: 'version-1',
          chapterId,
          title: 'Version 1',
          content: 'Content 1',
          wordCount: 100,
          version: 1,
          createdAt: new Date('2024-01-01'),
        },
        {
          id: 'version-2',
          chapterId,
          title: 'Version 2',
          content: 'Content 2',
          wordCount: 150,
          version: 2,
          createdAt: new Date('2024-01-02'),
        },
      ];

      prismaMock.chapterVersion.findMany.mockResolvedValue(mockVersions as any);

      const result = await chapterService.getChapterVersions(chapterId);

      expect(result).toEqual(mockVersions);
      expect(prismaMock.chapterVersion.findMany).toHaveBeenCalledWith({
        where: { chapterId },
        orderBy: { version: 'desc' },
      });
    });
  });

  describe('restoreChapterVersion', () => {
    const chapterId = 'chapter-1';
    const versionId = 'version-1';

    it('should restore chapter to previous version', async () => {
      const mockVersion = {
        id: versionId,
        chapterId,
        title: 'Restored Title',
        content: 'Restored content',
        wordCount: 100,
        version: 1,
        createdAt: new Date(),
      };

      const currentChapter: Chapter = {
        id: chapterId,
        projectId: 'project-1',
        title: 'Current Title',
        content: 'Current content',
        wordCount: 200,
        order: 1,
        status: 'edited',
        generationParams: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      prismaMock.chapterVersion.findUnique.mockResolvedValue(
        mockVersion as any
      );
      prismaMock.chapter.findUnique.mockResolvedValue(currentChapter);
      prismaMock.chapter.update.mockResolvedValue({
        ...currentChapter,
        title: mockVersion.title,
        content: mockVersion.content,
        wordCount: mockVersion.wordCount,
        status: 'restored',
      });

      const result = await chapterService.restoreChapterVersion(
        chapterId,
        versionId
      );

      expect(prismaMock.chapter.update).toHaveBeenCalledWith({
        where: { id: chapterId },
        data: {
          title: mockVersion.title,
          content: mockVersion.content,
          wordCount: mockVersion.wordCount,
          status: 'restored',
        },
      });
    });

    it('should throw error if version not found', async () => {
      prismaMock.chapterVersion.findUnique.mockResolvedValue(null);

      await expect(
        chapterService.restoreChapterVersion(chapterId, versionId)
      ).rejects.toThrow('Chapter version not found');
    });
  });
});
