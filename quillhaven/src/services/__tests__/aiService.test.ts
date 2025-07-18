import { AIService } from '../aiService';
import type {
  ChapterGenerationRequest,
  ProjectContextForAI,
} from '../../types/ai';
import {
  AIServiceError,
  AIRateLimitError,
  AIQuotaExceededError,
  AIContentFilterError,
} from '../../types/ai';

// Mock the Google Generative AI SDK
const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

describe('AIService', () => {
  let aiService: AIService;
  let mockRequest: ChapterGenerationRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create a fresh instance for each test
    aiService = new AIService({
      apiKey: 'test-api-key',
      maxRetries: 2,
      retryDelay: 100,
      timeout: 5000,
    });

    // Create mock request for all tests
    mockRequest = {
      prompt:
        'Write a dramatic chapter about the protagonist facing their fears.',
      projectContext: {
        characters: [
          {
            id: 'char1',
            projectId: 'proj1',
            name: 'Alice',
            description: 'A brave warrior',
            role: 'PROTAGONIST',
            developmentArc: 'Learning to trust others',
            firstAppearance: 'Chapter 1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        plotThreads: [
          {
            id: 'plot1',
            projectId: 'proj1',
            title: 'The Quest for the Crystal',
            description: 'Alice must find the magical crystal',
            status: 'DEVELOPING',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        worldElements: [
          {
            id: 'world1',
            projectId: 'proj1',
            type: 'LOCATION',
            name: 'The Dark Forest',
            description: 'A mysterious forest filled with ancient magic',
            significance: 'Where the crystal is hidden',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        timelineEvents: [
          {
            id: 'time1',
            projectId: 'proj1',
            title: 'The Great War',
            description: 'A war that changed everything',
            eventDate: '100 years ago',
            importance: 5,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        projectSummary: 'A fantasy adventure about finding a magical crystal',
        genre: 'Fantasy',
        writingStyle: 'Third-person narrative',
      },
      previousChapters: ['Previous chapter content here...'],
      parameters: {
        length: 2000,
        tone: 'dramatic',
        style: 'third-person',
        focusCharacters: ['char1'],
        plotPoints: ['plot1'],
      },
    };
  });

  describe('constructor', () => {
    it('should throw error if API key is not provided', () => {
      expect(() => new AIService({ apiKey: '' })).toThrow(
        'Gemini API key is required'
      );
    });

    it('should use default configuration values', () => {
      const service = new AIService({ apiKey: 'test-key' });
      expect(service).toBeInstanceOf(AIService);
    });

    it('should merge custom configuration with defaults', () => {
      const service = new AIService({
        apiKey: 'test-key',
        maxRetries: 5,
        timeout: 10000,
      });
      expect(service).toBeInstanceOf(AIService);
    });
  });

  describe('generateChapter', () => {
    it('should generate a chapter successfully', async () => {
      const mockResponse = {
        response: {
          text: () =>
            'Generated chapter content with exactly two thousand words repeated many times to reach the target length...',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateChapter(mockRequest);

      expect(result).toEqual({
        content: expect.any(String),
        wordCount: expect.any(Number),
        generatedAt: expect.any(Date),
        contextUsed: expect.arrayContaining(['char1', 'plot1', 'world1']),
        suggestions: expect.any(Array),
      });

      expect(mockGenerateContent).toHaveBeenCalledWith({
        contents: [
          { role: 'user', parts: [{ text: expect.stringContaining('Alice') }] },
        ],
        generationConfig: expect.objectContaining({
          temperature: 0.8,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: expect.any(Number),
        }),
      });
    });

    it('should include all context elements in the prompt', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated content',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      await aiService.generateChapter(mockRequest);

      const calledPrompt =
        mockGenerateContent.mock.calls[0][0].contents[0].parts[0].text;

      expect(calledPrompt).toContain('Alice');
      expect(calledPrompt).toContain('The Quest for the Crystal');
      expect(calledPrompt).toContain('The Dark Forest');
      expect(calledPrompt).toContain('The Great War');
      expect(calledPrompt).toContain('Fantasy');
      expect(calledPrompt).toContain('2000 words');
    });

    it('should handle API errors and retry', async () => {
      mockGenerateContent
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({
          response: {
            text: () => 'Generated content after retry',
          },
        });

      const result = await aiService.generateChapter(mockRequest);

      expect(result.content).toBe('Generated content after retry');
      expect(mockGenerateContent).toHaveBeenCalledTimes(2);
    });

    it('should throw AIRateLimitError for rate limit errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('rate limit exceeded'));

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        AIRateLimitError
      );
    });

    it('should throw AIQuotaExceededError for quota errors', async () => {
      mockGenerateContent.mockRejectedValue(new Error('quota exceeded'));

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        AIQuotaExceededError
      );
    });

    it('should throw AIContentFilterError for safety policy violations', async () => {
      mockGenerateContent.mockRejectedValue(
        new Error('content policy violation')
      );

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        AIContentFilterError
      );
    });

    it('should handle timeout errors', async () => {
      mockGenerateContent.mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 10000))
      );

      const fastService = new AIService({
        apiKey: 'test-key',
        timeout: 100,
        maxRetries: 1,
      });

      await expect(fastService.generateChapter(mockRequest)).rejects.toThrow(
        /timeout|Network error/
      );
    });
  });

  describe('analyzeContext', () => {
    it('should analyze content and return structured data', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              extractedCharacters: ['Alice', 'Bob'],
              extractedPlotPoints: ['Quest begins', 'Crystal found'],
              extractedWorldElements: ['Dark Forest', 'Magic Crystal'],
              inconsistencies: [],
              suggestions: ['Add more dialogue'],
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeContext('Sample chapter content');

      expect(result).toEqual({
        extractedCharacters: ['Alice', 'Bob'],
        extractedPlotPoints: ['Quest begins', 'Crystal found'],
        extractedWorldElements: ['Dark Forest', 'Magic Crystal'],
        inconsistencies: [],
        suggestions: ['Add more dialogue'],
      });
    });

    it('should handle malformed JSON responses gracefully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeContext('Sample content');

      expect(result).toEqual({
        extractedCharacters: [],
        extractedPlotPoints: [],
        extractedWorldElements: [],
        inconsistencies: [],
        suggestions: ['Unable to parse analysis response'],
      });
    });
  });

  describe('checkConsistency', () => {
    const mockContext: ProjectContextForAI = {
      characters: [
        {
          id: 'char1',
          projectId: 'proj1',
          name: 'Alice',
          description: 'A brave warrior',
          role: 'PROTAGONIST',
          developmentArc: null,
          firstAppearance: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      plotThreads: [],
      worldElements: [],
      timelineEvents: [],
      projectSummary: 'Test project',
      genre: 'Fantasy',
      writingStyle: 'Third-person',
    };

    it('should check consistency and return a report', async () => {
      const mockResponse = {
        response: {
          text: () =>
            JSON.stringify({
              issues: [
                {
                  type: 'character',
                  description: 'Alice acts out of character',
                  severity: 'medium',
                  suggestedFix: 'Revise dialogue to match personality',
                },
              ],
              score: 75,
              recommendations: ['Review character motivations'],
            }),
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.checkConsistency(
        mockContext,
        'New chapter content'
      );

      expect(result).toEqual({
        issues: [
          {
            type: 'character',
            description: 'Alice acts out of character',
            severity: 'medium',
            suggestedFix: 'Revise dialogue to match personality',
          },
        ],
        score: 75,
        recommendations: ['Review character motivations'],
      });
    });

    it('should handle malformed consistency report responses', async () => {
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON',
        },
      };

      mockGenerateContent.mockResolvedValue(mockResponse);

      const result = await aiService.checkConsistency(mockContext, 'Content');

      expect(result).toEqual({
        issues: [],
        score: 50,
        recommendations: ['Unable to parse consistency report'],
      });
    });
  });

  describe('error handling', () => {
    it('should not retry non-retryable errors', async () => {
      const quotaError = new Error('quota exceeded');
      mockGenerateContent.mockRejectedValue(quotaError);

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        AIQuotaExceededError
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    });

    it('should retry retryable errors up to maxRetries', async () => {
      const networkError = new Error('network timeout');
      mockGenerateContent.mockRejectedValue(networkError);

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        AIServiceError
      );

      expect(mockGenerateContent).toHaveBeenCalledTimes(2); // maxRetries = 2
    });
  });

  describe('utility methods', () => {
    it('should count words correctly', () => {
      const service = new AIService({ apiKey: 'test' });

      // Access private method through type assertion for testing
      const countWords = (
        service as unknown as { countWords: (text: string) => number }
      ).countWords;

      expect(countWords('Hello world')).toBe(2);
      expect(countWords('  Hello   world  ')).toBe(2);
      expect(countWords('')).toBe(0);
      expect(countWords('Single')).toBe(1);
    });

    it('should extract context IDs correctly', () => {
      const service = new AIService({ apiKey: 'test' });
      const extractContextIds = (
        service as unknown as {
          extractContextIds: (context: unknown) => unknown;
        }
      ).extractContextIds;

      const context: ProjectContextForAI = {
        characters: [
          { id: 'char1' },
          { id: 'char2' },
        ] as unknown as ProjectContextForAI['characters'],
        plotThreads: [
          { id: 'plot1' },
        ] as unknown as ProjectContextForAI['plotThreads'],
        worldElements: [
          { id: 'world1' },
          { id: 'world2' },
        ] as unknown as ProjectContextForAI['worldElements'],
        timelineEvents: [],
        projectSummary: '',
        genre: '',
        writingStyle: '',
      };

      const ids = extractContextIds(context);
      expect(ids).toEqual(['char1', 'char2', 'plot1', 'world1', 'world2']);
    });
  });
});
