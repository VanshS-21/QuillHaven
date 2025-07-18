import { AIService } from '@/services/aiService';
import { ExportService } from '@/services/exportService';
import { ChapterGenerationRequest, ProjectContext } from '@/types/ai';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Mock the Google Generative AI
jest.mock('@google/generative-ai');

describe('AI Generation Performance Tests', () => {
  let aiService: AIService;
  let exportService: ExportService;
  let mockGenAI: jest.Mocked<GoogleGenerativeAI>;
  let mockModel: any;

  beforeEach(() => {
    mockModel = {
      generateContent: jest.fn(),
    };

    mockGenAI = {
      getGenerativeModel: jest.fn().mockReturnValue(mockModel),
    } as any;

    (GoogleGenerativeAI as jest.MockedClass<typeof GoogleGenerativeAI>).mockImplementation(
      () => mockGenAI
    );

    aiService = new AIService();
    exportService = new ExportService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Chapter Generation Performance', () => {
    const createMockProjectContext = (size: 'small' | 'medium' | 'large'): ProjectContext => {
      const sizes = {
        small: { characters: 5, plotThreads: 2, worldBuilding: 3 },
        medium: { characters: 20, plotThreads: 8, worldBuilding: 15 },
        large: { characters: 50, plotThreads: 20, worldBuilding: 30 },
      };

      const config = sizes[size];

      return {
        characters: Array.from({ length: config.characters }, (_, i) => ({
          id: `char-${i}`,
          name: `Character ${i}`,
          description: `Description for character ${i}`.repeat(10),
          role: i % 2 === 0 ? 'protagonist' : 'antagonist',
          relationships: [],
          developmentArc: `Development arc for character ${i}`,
        })),
        plotThreads: Array.from({ length: config.plotThreads }, (_, i) => ({
          id: `plot-${i}`,
          title: `Plot Thread ${i}`,
          description: `Description for plot thread ${i}`.repeat(15),
          status: 'developing',
          relatedCharacters: [`char-${i % config.characters}`],
          chapterReferences: [],
        })),
        worldBuilding: Array.from({ length: config.worldBuilding }, (_, i) => ({
          id: `world-${i}`,
          type: 'location',
          name: `Location ${i}`,
          description: `Description for location ${i}`.repeat(20),
          significance: `Significance of location ${i}`,
          relatedElements: [],
        })),
        timeline: [],
      };
    };

    it('should generate 2000-word chapter within 60 seconds', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated chapter content '.repeat(400), // ~2000 words
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter about the hero\'s journey',
        projectContext: createMockProjectContext('medium'),
        previousChapters: ['Previous chapter content...'],
        parameters: {
          length: 2000,
          tone: 'adventurous',
          style: 'fantasy',
          focusCharacters: ['char-1', 'char-2'],
          plotPoints: ['plot-1'],
        },
      };

      const startTime = Date.now();
      const result = await aiService.generateChapter(generationRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(60000); // 60 seconds
      expect(result.content).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(1500); // Allow some variance
    });

    it('should generate 5000-word chapter within 60 seconds', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated chapter content '.repeat(1000), // ~5000 words
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a detailed chapter with complex plot development',
        projectContext: createMockProjectContext('large'),
        previousChapters: [
          'Chapter 1 content...'.repeat(500),
          'Chapter 2 content...'.repeat(500),
          'Chapter 3 content...'.repeat(500),
        ],
        parameters: {
          length: 5000,
          tone: 'dramatic',
          style: 'literary',
          focusCharacters: ['char-1', 'char-2', 'char-3'],
          plotPoints: ['plot-1', 'plot-2'],
        },
      };

      const startTime = Date.now();
      const result = await aiService.generateChapter(generationRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(60000); // 60 seconds
      expect(result.content).toBeDefined();
      expect(result.wordCount).toBeGreaterThan(4000); // Allow some variance
    });

    it('should handle multiple concurrent chapter generations', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated chapter content '.repeat(400),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter',
        projectContext: createMockProjectContext('small'),
        previousChapters: [],
        parameters: {
          length: 2000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      const startTime = Date.now();
      
      // Generate 5 chapters concurrently
      const promises = Array.from({ length: 5 }, () =>
        aiService.generateChapter(generationRequest)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(120000); // 2 minutes for 5 concurrent generations
      expect(results).toHaveLength(5);
      results.forEach((result) => {
        expect(result.content).toBeDefined();
        expect(result.wordCount).toBeGreaterThan(0);
      });
    });

    it('should handle large context efficiently', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated content with large context',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const largeContext = createMockProjectContext('large');
      const largePreviousChapters = Array.from({ length: 20 }, (_, i) =>
        `Chapter ${i + 1} content `.repeat(1000) // ~5000 words each
      );

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter with extensive context',
        projectContext: largeContext,
        previousChapters: largePreviousChapters,
        parameters: {
          length: 3000,
          tone: 'epic',
          style: 'fantasy',
          focusCharacters: largeContext.characters.slice(0, 10).map(c => c.id),
          plotPoints: largeContext.plotThreads.slice(0, 5).map(p => p.id),
        },
      };

      const startTime = Date.now();
      const result = await aiService.generateChapter(generationRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(90000); // 90 seconds for large context
      expect(result.content).toBeDefined();
    });

    it('should maintain performance with retry mechanism', async () => {
      let callCount = 0;
      mockModel.generateContent.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          return Promise.reject(new Error('Temporary failure'));
        }
        return Promise.resolve({
          response: {
            text: () => 'Generated content after retries',
          },
        });
      });

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter with retries',
        projectContext: createMockProjectContext('small'),
        previousChapters: [],
        parameters: {
          length: 2000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      const startTime = Date.now();
      const result = await aiService.generateChapter(generationRequest);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(75000); // 75 seconds including retries
      expect(result.content).toBeDefined();
      expect(callCount).toBe(3); // Initial + 2 retries
    });
  });

  describe('Context Analysis Performance', () => {
    it('should analyze large content quickly', async () => {
      const largeContent = 'This is a story with many characters and plot points. '.repeat(2000); // ~20,000 words

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            characters: ['Hero', 'Villain', 'Mentor'],
            locations: ['Castle', 'Forest', 'Village'],
            plotPoints: ['Quest begins', 'Conflict arises', 'Resolution'],
            themes: ['Good vs Evil', 'Coming of age'],
          }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      const result = await aiService.analyzeContext(largeContent);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(30000); // 30 seconds
      expect(result.characters).toContain('Hero');
      expect(result.locations).toContain('Castle');
      expect(result.plotPoints).toContain('Quest begins');
    });

    it('should handle multiple concurrent analyses', async () => {
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            characters: ['Character'],
            locations: ['Location'],
            plotPoints: ['Plot point'],
            themes: ['Theme'],
          }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const contents = Array.from({ length: 10 }, (_, i) =>
        `Content for analysis ${i} `.repeat(500)
      );

      const startTime = Date.now();
      const results = await Promise.all(
        contents.map(content => aiService.analyzeContext(content))
      );
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(60000); // 60 seconds for 10 analyses
      expect(results).toHaveLength(10);
      results.forEach(result => {
        expect(result.characters).toBeDefined();
        expect(result.locations).toBeDefined();
      });
    });
  });

  describe('Consistency Check Performance', () => {
    it('should check consistency quickly for large projects', async () => {
      const largeContext = createMockProjectContext('large');
      const longContent = 'Chapter content with many details and character interactions. '.repeat(1000);

      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            issues: [
              {
                type: 'character_inconsistency',
                description: 'Minor inconsistency found',
                severity: 'low',
                suggestions: ['Review character description'],
              },
            ],
          }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const startTime = Date.now();
      const result = await aiService.checkConsistency(largeContext, longContent);
      const endTime = Date.now();

      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(45000); // 45 seconds
      expect(result.issues).toBeDefined();
      expect(Array.isArray(result.issues)).toBe(true);
    });
  });

  describe('Memory Usage Tests', () => {
    it('should not cause memory leaks during generation', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated content',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter',
        projectContext: createMockProjectContext('medium'),
        previousChapters: [],
        parameters: {
          length: 2000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      const initialMemory = process.memoryUsage().heapUsed;

      // Generate many chapters to test for memory leaks
      for (let i = 0; i < 50; i++) {
        await aiService.generateChapter(generationRequest);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 100MB)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);
    });
  });

  describe('Error Recovery Performance', () => {
    it('should recover from errors quickly', async () => {
      let callCount = 0;
      mockModel.generateContent.mockImplementation(() => {
        callCount++;
        if (callCount % 3 === 0) {
          return Promise.resolve({
            response: {
              text: () => 'Successful generation',
            },
          });
        }
        return Promise.reject(new Error('Temporary error'));
      });

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter with errors',
        projectContext: createMockProjectContext('small'),
        previousChapters: [],
        parameters: {
          length: 1000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      const startTime = Date.now();
      
      // Try multiple generations, some will fail, some will succeed
      const promises = Array.from({ length: 10 }, () =>
        aiService.generateChapter(generationRequest).catch(() => null)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();

      const executionTime = endTime - startTime;
      const successfulResults = results.filter(r => r !== null);

      expect(executionTime).toBeLessThan(120000); // 2 minutes
      expect(successfulResults.length).toBeGreaterThan(0);
    });
  });

  describe('Scalability Tests', () => {
    it('should handle increasing load gracefully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated content',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const generationRequest: ChapterGenerationRequest = {
        prompt: 'Write a chapter',
        projectContext: createMockProjectContext('small'),
        previousChapters: [],
        parameters: {
          length: 1000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      const loadLevels = [1, 5, 10, 20];
      const results: number[] = [];

      for (const load of loadLevels) {
        const startTime = Date.now();
        
        const promises = Array.from({ length: load }, () =>
          aiService.generateChapter(generationRequest)
        );

        await Promise.all(promises);
        const endTime = Date.now();
        
        const executionTime = endTime - startTime;
        results.push(executionTime);
      }

      // Performance should degrade gracefully, not exponentially
      for (let i = 1; i < results.length; i++) {
        const scaleFactor = loadLevels[i] / loadLevels[i - 1];
        const timeFactor = results[i] / results[i - 1];
        
        // Time increase should not be more than 3x the scale factor
        expect(timeFactor).toBeLessThan(scaleFactor * 3);
      }
    });
  });
});