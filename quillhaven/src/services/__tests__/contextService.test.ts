import { ContextService } from '../contextService';
import { prismaMock } from '../../../__mocks__/prisma';
import { AIService } from '../aiService';
import { Project } from '@prisma/client';
import { ProjectContext, Character, PlotThread, WorldBuildingElement } from '@/types/ai';

// Mock AI Service
jest.mock('../aiService');
const MockAIService = AIService as jest.MockedClass<typeof AIService>;

describe('ContextService', () => {
  let contextService: ContextService;
  let mockAIService: jest.Mocked<AIService>;

  beforeEach(() => {
    mockAIService = new MockAIService() as jest.Mocked<AIService>;
    contextService = new ContextService();
    jest.clearAllMocks();
  });

  const mockProject: Project = {
    id: 'project-1',
    userId: 'user-1',
    title: 'Test Project',
    description: 'A test project',
    genre: 'Fantasy',
    targetLength: 80000,
    currentWordCount: 25000,
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
      worldBuilding: [
        {
          id: 'world-1',
          type: 'location',
          name: 'Fantasy Kingdom',
          description: 'A magical realm',
          significance: 'Setting',
          relatedElements: [],
        },
      ],
      timeline: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  describe('addCharacter', () => {
    const newCharacter: Omit<Character, 'id'> = {
      name: 'Villain',
      description: 'The antagonist',
      role: 'antagonist',
      relationships: [],
      developmentArc: 'Corruption',
    };

    it('should add a new character to project context', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          characters: [
            ...mockProject.context.characters,
            { ...newCharacter, id: expect.any(String) },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.addCharacter('project-1', 'user-1', newCharacter);

      expect(result.name).toBe(newCharacter.name);
      expect(result.id).toBeDefined();
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          context: expect.objectContaining({
            characters: expect.arrayContaining([
              expect.objectContaining({ name: 'Villain' }),
            ]),
          }),
        },
      });
    });

    it('should validate character name uniqueness', async () => {
      const duplicateCharacter = {
        name: 'Hero', // Same as existing character
        description: 'Another hero',
        role: 'protagonist' as const,
        relationships: [],
        developmentArc: 'Different arc',
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        contextService.addCharacter('project-1', 'user-1', duplicateCharacter)
      ).rejects.toThrow('Character with this name already exists');
    });

    it('should throw error if project not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(null);

      await expect(
        contextService.addCharacter('nonexistent', 'user-1', newCharacter)
      ).rejects.toThrow('Project not found');
    });
  });

  describe('updateCharacter', () => {
    const updateData = {
      description: 'Updated description',
      developmentArc: 'New arc',
    };

    it('should update existing character', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          characters: [
            {
              ...mockProject.context.characters[0],
              ...updateData,
            },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.updateCharacter(
        'project-1',
        'user-1',
        'char-1',
        updateData
      );

      expect(result.description).toBe(updateData.description);
      expect(result.developmentArc).toBe(updateData.developmentArc);
    });

    it('should throw error if character not found', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        contextService.updateCharacter('project-1', 'user-1', 'nonexistent', updateData)
      ).rejects.toThrow('Character not found');
    });
  });

  describe('deleteCharacter', () => {
    it('should remove character from project context', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          characters: [], // Character removed
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      await contextService.deleteCharacter('project-1', 'user-1', 'char-1');

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          context: expect.objectContaining({
            characters: [],
          }),
        },
      });
    });

    it('should update related plot threads when character is deleted', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          characters: [],
          plotThreads: [
            {
              ...mockProject.context.plotThreads[0],
              relatedCharacters: [], // Character reference removed
            },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      await contextService.deleteCharacter('project-1', 'user-1', 'char-1');

      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: {
          context: expect.objectContaining({
            plotThreads: expect.arrayContaining([
              expect.objectContaining({
                relatedCharacters: [],
              }),
            ]),
          }),
        },
      });
    });
  });

  describe('addPlotThread', () => {
    const newPlotThread: Omit<PlotThread, 'id'> = {
      title: 'Subplot',
      description: 'A secondary storyline',
      status: 'planning',
      relatedCharacters: ['char-1'],
      chapterReferences: [],
    };

    it('should add a new plot thread', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          plotThreads: [
            ...mockProject.context.plotThreads,
            { ...newPlotThread, id: expect.any(String) },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.addPlotThread('project-1', 'user-1', newPlotThread);

      expect(result.title).toBe(newPlotThread.title);
      expect(result.id).toBeDefined();
    });

    it('should validate related characters exist', async () => {
      const invalidPlotThread = {
        ...newPlotThread,
        relatedCharacters: ['nonexistent-char'],
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        contextService.addPlotThread('project-1', 'user-1', invalidPlotThread)
      ).rejects.toThrow('Some related characters do not exist');
    });
  });

  describe('addWorldBuildingElement', () => {
    const newWorldElement: Omit<WorldBuildingElement, 'id'> = {
      type: 'culture',
      name: 'Elven Society',
      description: 'Ancient elven civilization',
      significance: 'Cultural background',
      relatedElements: [],
    };

    it('should add a new world building element', async () => {
      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          worldBuilding: [
            ...mockProject.context.worldBuilding,
            { ...newWorldElement, id: expect.any(String) },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.addWorldBuildingElement(
        'project-1',
        'user-1',
        newWorldElement
      );

      expect(result.name).toBe(newWorldElement.name);
      expect(result.type).toBe(newWorldElement.type);
    });

    it('should validate world building element type', async () => {
      const invalidElement = {
        ...newWorldElement,
        type: 'invalid-type' as any,
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      await expect(
        contextService.addWorldBuildingElement('project-1', 'user-1', invalidElement)
      ).rejects.toThrow('Invalid world building element type');
    });
  });

  describe('analyzeContextConsistency', () => {
    const chapterContent = 'Hero fought the dragon in the Fantasy Kingdom.';

    it('should analyze context consistency using AI', async () => {
      const mockConsistencyResult = {
        issues: [
          {
            type: 'character_inconsistency',
            description: 'Character behavior inconsistent with established personality',
            severity: 'medium',
            suggestions: ['Review character development arc'],
          },
        ],
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.checkConsistency.mockResolvedValue(mockConsistencyResult);

      const result = await contextService.analyzeContextConsistency(
        'project-1',
        'user-1',
        chapterContent
      );

      expect(result).toEqual(mockConsistencyResult);
      expect(mockAIService.checkConsistency).toHaveBeenCalledWith(
        mockProject.context,
        chapterContent
      );
    });

    it('should handle AI service errors', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.checkConsistency.mockRejectedValue(new Error('AI service error'));

      await expect(
        contextService.analyzeContextConsistency('project-1', 'user-1', chapterContent)
      ).rejects.toThrow('Failed to analyze consistency: AI service error');
    });
  });

  describe('extractContextFromContent', () => {
    const content = 'Alice met Bob at the tavern in Rivertown. They discussed the ancient prophecy.';

    it('should extract context elements from content', async () => {
      const mockAnalysisResult = {
        characters: ['Alice', 'Bob'],
        locations: ['tavern', 'Rivertown'],
        plotPoints: ['ancient prophecy'],
        themes: ['destiny', 'friendship'],
      };

      mockAIService.analyzeContext.mockResolvedValue(mockAnalysisResult);

      const result = await contextService.extractContextFromContent(content);

      expect(result).toEqual(mockAnalysisResult);
      expect(mockAIService.analyzeContext).toHaveBeenCalledWith(content);
    });

    it('should handle empty content', async () => {
      const result = await contextService.extractContextFromContent('');

      expect(result).toEqual({
        characters: [],
        locations: [],
        plotPoints: [],
        themes: [],
      });
    });
  });

  describe('suggestContextUpdates', () => {
    const chapterContent = 'Hero discovered a new magical artifact.';

    it('should suggest context updates based on chapter content', async () => {
      const mockAnalysisResult = {
        characters: ['Hero'],
        locations: [],
        plotPoints: ['magical artifact discovery'],
        themes: ['magic', 'discovery'],
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.analyzeContext.mockResolvedValue(mockAnalysisResult);

      const result = await contextService.suggestContextUpdates(
        'project-1',
        'user-1',
        chapterContent
      );

      expect(result).toEqual({
        newCharacters: [], // Hero already exists
        newLocations: [],
        newPlotPoints: ['magical artifact discovery'],
        characterUpdates: [
          {
            characterId: 'char-1',
            suggestedUpdates: {
              developmentArc: expect.stringContaining('magical artifact'),
            },
          },
        ],
      });
    });

    it('should identify new characters not in existing context', async () => {
      const mockAnalysisResult = {
        characters: ['Hero', 'NewCharacter'],
        locations: ['NewLocation'],
        plotPoints: [],
        themes: [],
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      mockAIService.analyzeContext.mockResolvedValue(mockAnalysisResult);

      const result = await contextService.suggestContextUpdates(
        'project-1',
        'user-1',
        chapterContent
      );

      expect(result.newCharacters).toContain('NewCharacter');
      expect(result.newLocations).toContain('NewLocation');
    });
  });

  describe('getContextSummary', () => {
    it('should return comprehensive context summary', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const result = await contextService.getContextSummary('project-1', 'user-1');

      expect(result).toEqual({
        charactersCount: 1,
        plotThreadsCount: 1,
        worldBuildingCount: 1,
        timelineEventsCount: 0,
        characters: mockProject.context.characters,
        plotThreads: mockProject.context.plotThreads,
        worldBuilding: mockProject.context.worldBuilding,
        recentUpdates: expect.any(Array),
      });
    });
  });

  describe('validateContextIntegrity', () => {
    it('should validate context integrity and return issues', async () => {
      const projectWithIssues = {
        ...mockProject,
        context: {
          ...mockProject.context,
          plotThreads: [
            {
              ...mockProject.context.plotThreads[0],
              relatedCharacters: ['nonexistent-char'], // Invalid reference
            },
          ],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(projectWithIssues);

      const result = await contextService.validateContextIntegrity('project-1', 'user-1');

      expect(result.isValid).toBe(false);
      expect(result.issues).toContainEqual(
        expect.objectContaining({
          type: 'invalid_character_reference',
          description: expect.stringContaining('nonexistent-char'),
        })
      );
    });

    it('should return valid result for consistent context', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const result = await contextService.validateContextIntegrity('project-1', 'user-1');

      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });
  });

  describe('exportContext', () => {
    it('should export context in specified format', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const result = await contextService.exportContext('project-1', 'user-1', 'json');

      expect(result.format).toBe('json');
      expect(result.data).toEqual(mockProject.context);
      expect(result.filename).toContain('context.json');
    });

    it('should export context as markdown', async () => {
      prismaMock.project.findFirst.mockResolvedValue(mockProject);

      const result = await contextService.exportContext('project-1', 'user-1', 'markdown');

      expect(result.format).toBe('markdown');
      expect(result.data).toContain('# Project Context');
      expect(result.data).toContain('## Characters');
      expect(result.data).toContain('Hero');
    });
  });

  describe('importContext', () => {
    it('should import context from JSON data', async () => {
      const importData = {
        characters: [
          {
            id: 'imported-char',
            name: 'Imported Character',
            description: 'A character from import',
            role: 'supporting',
            relationships: [],
            developmentArc: 'Static',
          },
        ],
        plotThreads: [],
        worldBuilding: [],
        timeline: [],
      };

      const updatedProject = {
        ...mockProject,
        context: {
          ...mockProject.context,
          characters: [...mockProject.context.characters, ...importData.characters],
        },
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.importContext(
        'project-1',
        'user-1',
        importData,
        'merge'
      );

      expect(result.imported.characters).toBe(1);
      expect(result.skipped.characters).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle import conflicts in merge mode', async () => {
      const importData = {
        characters: [
          {
            id: 'char-1', // Same ID as existing character
            name: 'Hero', // Same name
            description: 'Different description',
            role: 'protagonist',
            relationships: [],
            developmentArc: 'Different arc',
          },
        ],
        plotThreads: [],
        worldBuilding: [],
        timeline: [],
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(mockProject);

      const result = await contextService.importContext(
        'project-1',
        'user-1',
        importData,
        'merge'
      );

      expect(result.skipped.characters).toBe(1);
      expect(result.imported.characters).toBe(0);
    });

    it('should replace context in replace mode', async () => {
      const importData = {
        characters: [
          {
            id: 'new-char',
            name: 'New Character',
            description: 'Replacement character',
            role: 'protagonist',
            relationships: [],
            developmentArc: 'New arc',
          },
        ],
        plotThreads: [],
        worldBuilding: [],
        timeline: [],
      };

      const updatedProject = {
        ...mockProject,
        context: importData,
      };

      prismaMock.project.findFirst.mockResolvedValue(mockProject);
      prismaMock.project.update.mockResolvedValue(updatedProject);

      const result = await contextService.importContext(
        'project-1',
        'user-1',
        importData,
        'replace'
      );

      expect(result.imported.characters).toBe(1);
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: 'project-1' },
        data: { context: importData },
      });
    });
  });
});