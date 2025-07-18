import { AIService } from '../aiService';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ProjectContext, ChapterGenerationRequest } from '@/types/ai';

// Mock the Google Generative AI
jest.mock('@google/generative-ai');

describe('AIService', () => {
  let aiService: AIService;
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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateChapter', () => {
    const mockRequest: ChapterGenerationRequest = {
      prompt: 'Write a chapter about the hero\'s journey',
      projectContext: {
        characters: [
          {
            id: '1',
            name: 'John Doe',
            description: 'A brave hero',
            role: 'protagonist',
            relationships: [],
            developmentArc: 'Hero\'s journey',
          },
        ],
        plotThreads: [
          {
            id: '1',
            title: 'Main Quest',
            description: 'The hero must save the world',
            status: 'developing',
            relatedCharacters: ['1'],
            chapterReferences: [],
          },
        ],
        worldBuilding: [
          {
            id: '1',
            type: 'location',
            name: 'Fantasy Kingdom',
            description: 'A magical realm',
            significance: 'Setting for the adventure',
            relatedElements: [],
          },
        ],
        timeline: [],
      },
      previousChapters: ['Chapter 1 content...'],
      parameters: {
        length: 2000,
        tone: 'adventurous',
        style: 'fantasy',
        focusCharacters: ['1'],
        plotPoints: ['1'],
      },
    };

    it('should generate a chapter successfully', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated chapter content...',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await aiService.generateChapter(mockRequest);

      expect(result).toEqual({
        content: 'Generated chapter content...',
        wordCount: expect.any(Number),
        generatedAt: expect.any(Date),
        parameters: mockRequest.parameters,
      });

      expect(mockModel.generateContent).toHaveBeenCalledWith(
        expect.stringContaining('Write a chapter about the hero\'s journey')
      );
    });

    it('should handle API errors gracefully', async () => {
      mockModel.generateContent.mockRejectedValue(new Error('API Error'));

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow(
        'Failed to generate chapter: API Error'
      );
    });

    it('should include context in the prompt', async () => {
      const mockResponse = {
        response: {
          text: () => 'Generated content',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await aiService.generateChapter(mockRequest);

      const calledPrompt = mockModel.generateContent.mock.calls[0][0];
      expect(calledPrompt).toContain('John Doe');
      expect(calledPrompt).toContain('Main Quest');
      expect(calledPrompt).toContain('Fantasy Kingdom');
    });

    it('should respect length parameters', async () => {
      const mockResponse = {
        response: {
          text: () => 'Short content',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const shortRequest = {
        ...mockRequest,
        parameters: { ...mockRequest.parameters, length: 500 },
      };

      await aiService.generateChapter(shortRequest);

      const calledPrompt = mockModel.generateContent.mock.calls[0][0];
      expect(calledPrompt).toContain('500');
    });
  });

  describe('analyzeContext', () => {
    it('should extract characters from content', async () => {
      const content = 'John walked through the forest. Mary followed behind him.';
      
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            characters: ['John', 'Mary'],
            locations: ['forest'],
            plotPoints: ['journey begins'],
          }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeContext(content);

      expect(result.characters).toContain('John');
      expect(result.characters).toContain('Mary');
      expect(result.locations).toContain('forest');
    });

    it('should handle malformed JSON responses', async () => {
      const content = 'Some content';
      
      const mockResponse = {
        response: {
          text: () => 'Invalid JSON response',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await aiService.analyzeContext(content);

      expect(result).toEqual({
        characters: [],
        locations: [],
        plotPoints: [],
        themes: [],
      });
    });
  });

  describe('checkConsistency', () => {
    const mockContext: ProjectContext = {
      characters: [
        {
          id: '1',
          name: 'John',
          description: 'Hero',
          role: 'protagonist',
          relationships: [],
          developmentArc: 'Growth',
        },
      ],
      plotThreads: [],
      worldBuilding: [],
      timeline: [],
    };

    it('should identify consistency issues', async () => {
      const newContent = 'John suddenly had blue eyes instead of brown.';
      
      const mockResponse = {
        response: {
          text: () => JSON.stringify({
            issues: [
              {
                type: 'character_inconsistency',
                description: 'Eye color changed',
                severity: 'medium',
                suggestions: ['Maintain consistent character descriptions'],
              },
            ],
          }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await aiService.checkConsistency(mockContext, newContent);

      expect(result.issues).toHaveLength(1);
      expect(result.issues[0].type).toBe('character_inconsistency');
    });

    it('should return no issues for consistent content', async () => {
      const newContent = 'John continued his heroic journey.';
      
      const mockResponse = {
        response: {
          text: () => JSON.stringify({ issues: [] }),
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      const result = await aiService.checkConsistency(mockContext, newContent);

      expect(result.issues).toHaveLength(0);
    });
  });

  describe('retry mechanism', () => {
    it('should retry on temporary failures', async () => {
      const mockRequest: ChapterGenerationRequest = {
        prompt: 'Test prompt',
        projectContext: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        previousChapters: [],
        parameters: {
          length: 1000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      // First call fails, second succeeds
      mockModel.generateContent
        .mockRejectedValueOnce(new Error('Temporary error'))
        .mockResolvedValueOnce({
          response: {
            text: () => 'Generated content',
          },
        });

      const result = await aiService.generateChapter(mockRequest);

      expect(result.content).toBe('Generated content');
      expect(mockModel.generateContent).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      const mockRequest: ChapterGenerationRequest = {
        prompt: 'Test prompt',
        projectContext: {
          characters: [],
          plotThreads: [],
          worldBuilding: [],
          timeline: [],
        },
        previousChapters: [],
        parameters: {
          length: 1000,
          tone: 'neutral',
          style: 'modern',
          focusCharacters: [],
          plotPoints: [],
        },
      };

      mockModel.generateContent.mockRejectedValue(new Error('Persistent error'));

      await expect(aiService.generateChapter(mockRequest)).rejects.toThrow();
      expect(mockModel.generateContent).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });
  });

  describe('prompt construction', () => {
    it('should build comprehensive prompts', async () => {
      const mockRequest: ChapterGenerationRequest = {
        prompt: 'Write about conflict',
        projectContext: {
          characters: [
            {
              id: '1',
              name: 'Alice',
              description: 'Protagonist',
              role: 'protagonist',
              relationships: [],
              developmentArc: 'Coming of age',
            },
          ],
          plotThreads: [
            {
              id: '1',
              title: 'Central Conflict',
              description: 'Main story arc',
              status: 'developing',
              relatedCharacters: ['1'],
              chapterReferences: [],
            },
          ],
          worldBuilding: [],
          timeline: [],
        },
        previousChapters: ['Previous chapter content'],
        parameters: {
          length: 1500,
          tone: 'dramatic',
          style: 'literary',
          focusCharacters: ['1'],
          plotPoints: ['1'],
        },
      };

      const mockResponse = {
        response: {
          text: () => 'Generated content',
        },
      };

      mockModel.generateContent.mockResolvedValue(mockResponse);

      await aiService.generateChapter(mockRequest);

      const calledPrompt = mockModel.generateContent.mock.calls[0][0];
      
      // Check that prompt includes all necessary elements
      expect(calledPrompt).toContain('Write about conflict');
      expect(calledPrompt).toContain('Alice');
      expect(calledPrompt).toContain('Central Conflict');
      expect(calledPrompt).toContain('1500');
      expect(calledPrompt).toContain('dramatic');
      expect(calledPrompt).toContain('literary');
      expect(calledPrompt).toContain('Previous chapter content');
    });
  });
});