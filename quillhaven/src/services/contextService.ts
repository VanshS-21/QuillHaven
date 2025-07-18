import { prisma } from '@/lib/prisma';
import type {
  Character,
  CharacterWithRelationships,
  PlotThread,
  PlotThreadWithCharacters,
  WorldElement,
  WorldElementWithRelations,
  TimelineEvent,
  CharacterRole,
  PlotThreadStatus,
  WorldElementType,
} from '@/types/database';

// Character service functions
export interface CreateCharacterData {
  name: string;
  description?: string;
  role?: CharacterRole;
  developmentArc?: string;
  firstAppearance?: string;
}

export interface UpdateCharacterData {
  name?: string;
  description?: string;
  role?: CharacterRole;
  developmentArc?: string;
  firstAppearance?: string;
}

export interface CreateRelationshipData {
  relatedId: string;
  type: string;
  description?: string;
}

/**
 * Create a new character for a project
 */
export async function createCharacter(
  projectId: string,
  data: CreateCharacterData
): Promise<Character> {
  try {
    const character = await prisma.character.create({
      data: {
        projectId,
        name: data.name,
        description: data.description || '',
        role: data.role || 'MINOR',
        developmentArc: data.developmentArc,
        firstAppearance: data.firstAppearance,
      },
    });

    return character;
  } catch (error) {
    console.error('Error creating character:', error);
    throw new Error('Failed to create character');
  }
}

/**
 * Get all characters for a project
 */
export async function getProjectCharacters(
  projectId: string
): Promise<CharacterWithRelationships[]> {
  try {
    const characters = await prisma.character.findMany({
      where: { projectId },
      include: {
        project: true,
        relationships: {
          include: {
            relatedCharacter: true,
          },
        },
        relatedTo: {
          include: {
            character: true,
          },
        },
        plotThreads: true,
      },
      orderBy: { name: 'asc' },
    });

    return characters;
  } catch (error) {
    console.error('Error getting project characters:', error);
    throw new Error('Failed to get project characters');
  }
}

/**
 * Get a character by ID
 */
export async function getCharacter(
  characterId: string,
  projectId: string
): Promise<CharacterWithRelationships | null> {
  try {
    const character = await prisma.character.findFirst({
      where: {
        id: characterId,
        projectId,
      },
      include: {
        project: true,
        relationships: {
          include: {
            relatedCharacter: true,
          },
        },
        relatedTo: {
          include: {
            character: true,
          },
        },
        plotThreads: true,
      },
    });

    return character;
  } catch (error) {
    console.error('Error getting character:', error);
    throw new Error('Failed to get character');
  }
}

/**
 * Update a character
 */
export async function updateCharacter(
  characterId: string,
  projectId: string,
  data: UpdateCharacterData
): Promise<Character | null> {
  try {
    // Verify character belongs to project
    const existingCharacter = await prisma.character.findFirst({
      where: {
        id: characterId,
        projectId,
      },
    });

    if (!existingCharacter) {
      return null;
    }

    const updatedCharacter = await prisma.character.update({
      where: { id: characterId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return updatedCharacter;
  } catch (error) {
    console.error('Error updating character:', error);
    throw new Error('Failed to update character');
  }
}

/**
 * Delete a character
 */
export async function deleteCharacter(
  characterId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Verify character belongs to project
    const existingCharacter = await prisma.character.findFirst({
      where: {
        id: characterId,
        projectId,
      },
    });

    if (!existingCharacter) {
      return false;
    }

    await prisma.character.delete({
      where: { id: characterId },
    });

    return true;
  } catch (error) {
    console.error('Error deleting character:', error);
    throw new Error('Failed to delete character');
  }
}

/**
 * Create a relationship between characters
 */
export async function createCharacterRelationship(
  characterId: string,
  projectId: string,
  data: CreateRelationshipData
): Promise<boolean> {
  try {
    // Verify both characters belong to the same project
    const characters = await prisma.character.findMany({
      where: {
        id: { in: [characterId, data.relatedId] },
        projectId,
      },
    });

    if (characters.length !== 2) {
      return false;
    }

    await prisma.relationship.create({
      data: {
        characterId,
        relatedId: data.relatedId,
        type: data.type,
        description: data.description,
      },
    });

    return true;
  } catch (error) {
    console.error('Error creating character relationship:', error);
    throw new Error('Failed to create character relationship');
  }
}

// Plot thread service functions
export interface CreatePlotThreadData {
  title: string;
  description?: string;
  status?: PlotThreadStatus;
  relatedCharacterIds?: string[];
}

export interface UpdatePlotThreadData {
  title?: string;
  description?: string;
  status?: PlotThreadStatus;
  relatedCharacterIds?: string[];
}

/**
 * Create a new plot thread for a project
 */
export async function createPlotThread(
  projectId: string,
  data: CreatePlotThreadData
): Promise<PlotThread> {
  try {
    const plotThread = await prisma.plotThread.create({
      data: {
        projectId,
        title: data.title,
        description: data.description || '',
        status: data.status || 'INTRODUCED',
        relatedCharacters: data.relatedCharacterIds
          ? {
              connect: data.relatedCharacterIds.map((id) => ({ id })),
            }
          : undefined,
      },
    });

    return plotThread;
  } catch (error) {
    console.error('Error creating plot thread:', error);
    throw new Error('Failed to create plot thread');
  }
}

/**
 * Get all plot threads for a project
 */
export async function getProjectPlotThreads(
  projectId: string
): Promise<PlotThreadWithCharacters[]> {
  try {
    const plotThreads = await prisma.plotThread.findMany({
      where: { projectId },
      include: {
        project: true,
        relatedCharacters: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return plotThreads;
  } catch (error) {
    console.error('Error getting project plot threads:', error);
    throw new Error('Failed to get project plot threads');
  }
}

/**
 * Get a plot thread by ID
 */
export async function getPlotThread(
  plotThreadId: string,
  projectId: string
): Promise<PlotThreadWithCharacters | null> {
  try {
    const plotThread = await prisma.plotThread.findFirst({
      where: {
        id: plotThreadId,
        projectId,
      },
      include: {
        project: true,
        relatedCharacters: true,
      },
    });

    return plotThread;
  } catch (error) {
    console.error('Error getting plot thread:', error);
    throw new Error('Failed to get plot thread');
  }
}

/**
 * Update a plot thread
 */
export async function updatePlotThread(
  plotThreadId: string,
  projectId: string,
  data: UpdatePlotThreadData
): Promise<PlotThread | null> {
  try {
    // Verify plot thread belongs to project
    const existingPlotThread = await prisma.plotThread.findFirst({
      where: {
        id: plotThreadId,
        projectId,
      },
    });

    if (!existingPlotThread) {
      return null;
    }

    const updateData: Record<string, unknown> = {
      ...data,
      updatedAt: new Date(),
    };

    // Handle character relationships update
    if (data.relatedCharacterIds !== undefined) {
      updateData.relatedCharacters = {
        set: data.relatedCharacterIds.map((id) => ({ id })),
      };
      delete updateData.relatedCharacterIds;
    }

    const updatedPlotThread = await prisma.plotThread.update({
      where: { id: plotThreadId },
      data: updateData,
    });

    return updatedPlotThread;
  } catch (error) {
    console.error('Error updating plot thread:', error);
    throw new Error('Failed to update plot thread');
  }
}

/**
 * Delete a plot thread
 */
export async function deletePlotThread(
  plotThreadId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Verify plot thread belongs to project
    const existingPlotThread = await prisma.plotThread.findFirst({
      where: {
        id: plotThreadId,
        projectId,
      },
    });

    if (!existingPlotThread) {
      return false;
    }

    await prisma.plotThread.delete({
      where: { id: plotThreadId },
    });

    return true;
  } catch (error) {
    console.error('Error deleting plot thread:', error);
    throw new Error('Failed to delete plot thread');
  }
}

// World element service functions
export interface CreateWorldElementData {
  type: WorldElementType;
  name: string;
  description?: string;
  significance?: string;
  relatedElementIds?: string[];
}

export interface UpdateWorldElementData {
  type?: WorldElementType;
  name?: string;
  description?: string;
  significance?: string;
  relatedElementIds?: string[];
}

/**
 * Create a new world element for a project
 */
export async function createWorldElement(
  projectId: string,
  data: CreateWorldElementData
): Promise<WorldElement> {
  try {
    const worldElement = await prisma.worldElement.create({
      data: {
        projectId,
        type: data.type,
        name: data.name,
        description: data.description || '',
        significance: data.significance,
      },
    });

    // Create relations if specified
    if (data.relatedElementIds && data.relatedElementIds.length > 0) {
      await Promise.all(
        data.relatedElementIds.map((relatedId) =>
          prisma.worldElementRelation.create({
            data: {
              elementId: worldElement.id,
              relatedId,
              relationType: 'related_to',
              description: 'Related element',
            },
          })
        )
      );
    }

    return worldElement;
  } catch (error) {
    console.error('Error creating world element:', error);
    throw new Error('Failed to create world element');
  }
}

/**
 * Get all world elements for a project
 */
export async function getProjectWorldElements(
  projectId: string
): Promise<WorldElementWithRelations[]> {
  try {
    const worldElements = await prisma.worldElement.findMany({
      where: { projectId },
      include: {
        project: true,
        relatedElements: {
          include: {
            relatedElement: true,
          },
        },
        relatedTo: {
          include: {
            element: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return worldElements;
  } catch (error) {
    console.error('Error getting project world elements:', error);
    throw new Error('Failed to get project world elements');
  }
}

/**
 * Get a world element by ID
 */
export async function getWorldElement(
  worldElementId: string,
  projectId: string
): Promise<WorldElementWithRelations | null> {
  try {
    const worldElement = await prisma.worldElement.findFirst({
      where: {
        id: worldElementId,
        projectId,
      },
      include: {
        project: true,
        relatedElements: {
          include: {
            relatedElement: true,
          },
        },
        relatedTo: {
          include: {
            element: true,
          },
        },
      },
    });

    return worldElement;
  } catch (error) {
    console.error('Error getting world element:', error);
    throw new Error('Failed to get world element');
  }
}

/**
 * Update a world element
 */
export async function updateWorldElement(
  worldElementId: string,
  projectId: string,
  data: UpdateWorldElementData
): Promise<WorldElement | null> {
  try {
    // Verify world element belongs to project
    const existingWorldElement = await prisma.worldElement.findFirst({
      where: {
        id: worldElementId,
        projectId,
      },
    });

    if (!existingWorldElement) {
      return null;
    }

    const updatedWorldElement = await prisma.worldElement.update({
      where: { id: worldElementId },
      data: {
        type: data.type,
        name: data.name,
        description: data.description,
        significance: data.significance,
        updatedAt: new Date(),
      },
    });

    // Handle related elements update if specified
    if (data.relatedElementIds !== undefined) {
      // Remove existing relations
      await prisma.worldElementRelation.deleteMany({
        where: { elementId: worldElementId },
      });

      // Create new relations
      if (data.relatedElementIds.length > 0) {
        await Promise.all(
          data.relatedElementIds.map((relatedId) =>
            prisma.worldElementRelation.create({
              data: {
                elementId: worldElementId,
                relatedId,
                relationType: 'related_to',
                description: 'Related element',
              },
            })
          )
        );
      }
    }

    return updatedWorldElement;
  } catch (error) {
    console.error('Error updating world element:', error);
    throw new Error('Failed to update world element');
  }
}

/**
 * Delete a world element
 */
export async function deleteWorldElement(
  worldElementId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Verify world element belongs to project
    const existingWorldElement = await prisma.worldElement.findFirst({
      where: {
        id: worldElementId,
        projectId,
      },
    });

    if (!existingWorldElement) {
      return false;
    }

    await prisma.worldElement.delete({
      where: { id: worldElementId },
    });

    return true;
  } catch (error) {
    console.error('Error deleting world element:', error);
    throw new Error('Failed to delete world element');
  }
}

// Timeline event service functions
export interface CreateTimelineEventData {
  title: string;
  description?: string;
  eventDate: string;
  importance?: number;
}

export interface UpdateTimelineEventData {
  title?: string;
  description?: string;
  eventDate?: string;
  importance?: number;
}

/**
 * Create a new timeline event for a project
 */
export async function createTimelineEvent(
  projectId: string,
  data: CreateTimelineEventData
): Promise<TimelineEvent> {
  try {
    const timelineEvent = await prisma.timelineEvent.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        eventDate: data.eventDate,
        importance: data.importance || 1,
      },
    });

    return timelineEvent;
  } catch (error) {
    console.error('Error creating timeline event:', error);
    throw new Error('Failed to create timeline event');
  }
}

/**
 * Get all timeline events for a project
 */
export async function getProjectTimelineEvents(
  projectId: string
): Promise<TimelineEvent[]> {
  try {
    const timelineEvents = await prisma.timelineEvent.findMany({
      where: { projectId },
      orderBy: { eventDate: 'asc' },
    });

    return timelineEvents;
  } catch (error) {
    console.error('Error getting project timeline events:', error);
    throw new Error('Failed to get project timeline events');
  }
}

/**
 * Update a timeline event
 */
export async function updateTimelineEvent(
  timelineEventId: string,
  projectId: string,
  data: UpdateTimelineEventData
): Promise<TimelineEvent | null> {
  try {
    // Verify timeline event belongs to project
    const existingTimelineEvent = await prisma.timelineEvent.findFirst({
      where: {
        id: timelineEventId,
        projectId,
      },
    });

    if (!existingTimelineEvent) {
      return null;
    }

    const updatedTimelineEvent = await prisma.timelineEvent.update({
      where: { id: timelineEventId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    });

    return updatedTimelineEvent;
  } catch (error) {
    console.error('Error updating timeline event:', error);
    throw new Error('Failed to update timeline event');
  }
}

/**
 * Delete a timeline event
 */
export async function deleteTimelineEvent(
  timelineEventId: string,
  projectId: string
): Promise<boolean> {
  try {
    // Verify timeline event belongs to project
    const existingTimelineEvent = await prisma.timelineEvent.findFirst({
      where: {
        id: timelineEventId,
        projectId,
      },
    });

    if (!existingTimelineEvent) {
      return false;
    }

    await prisma.timelineEvent.delete({
      where: { id: timelineEventId },
    });

    return true;
  } catch (error) {
    console.error('Error deleting timeline event:', error);
    throw new Error('Failed to delete timeline event');
  }
}

// Context consistency and extraction functions
export interface ConsistencyIssue {
  type: 'character' | 'plot' | 'world' | 'timeline';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
  relatedIds: string[];
}

export interface ConsistencyReport {
  issues: ConsistencyIssue[];
  score: number; // 0-100, higher is better
  summary: string;
}

export interface ExtractedContext {
  characters: {
    name: string;
    mentions: number;
    newTraits?: string[];
  }[];
  plotPoints: {
    description: string;
    importance: number;
  }[];
  worldElements: {
    name: string;
    type: WorldElementType;
    description: string;
  }[];
  timelineEvents: {
    title: string;
    eventDate: string;
    description: string;
  }[];
}

/**
 * Check context consistency for a project
 */
export async function checkContextConsistency(
  projectId: string
): Promise<ConsistencyReport> {
  try {
    const issues: ConsistencyIssue[] = [];

    // Get all project context
    const [characters, plotThreads, worldElements, chapters] =
      await Promise.all([
        getProjectCharacters(projectId),
        getProjectPlotThreads(projectId),
        getProjectWorldElements(projectId),
        prisma.chapter.findMany({
          where: { projectId },
          orderBy: { order: 'asc' },
        }),
      ]);

    // Check for character consistency issues
    for (const character of characters) {
      // Check if character appears in chapters
      const mentionCount = chapters.reduce((count, chapter) => {
        const mentions = (
          chapter.content
            .toLowerCase()
            .match(new RegExp(character.name.toLowerCase(), 'g')) || []
        ).length;
        return count + mentions;
      }, 0);

      if (mentionCount === 0 && character.role !== 'MINOR') {
        issues.push({
          type: 'character',
          severity: 'medium',
          description: `Character "${character.name}" is marked as ${character.role} but doesn't appear in any chapters`,
          suggestion: `Consider adding "${character.name}" to your chapters or updating their role`,
          relatedIds: [character.id],
        });
      }

      // Check for incomplete character development
      if (!character.description || character.description.length < 10) {
        issues.push({
          type: 'character',
          severity: 'low',
          description: `Character "${character.name}" has minimal description`,
          suggestion: `Add more details to "${character.name}"'s description`,
          relatedIds: [character.id],
        });
      }
    }

    // Check for plot thread consistency
    for (const plotThread of plotThreads) {
      // Check if plot thread is mentioned in chapters
      const mentionCount = chapters.reduce((count, chapter) => {
        const mentions = (
          chapter.content
            .toLowerCase()
            .match(new RegExp(plotThread.title.toLowerCase(), 'g')) || []
        ).length;
        return count + mentions;
      }, 0);

      if (mentionCount === 0 && plotThread.status !== 'INTRODUCED') {
        issues.push({
          type: 'plot',
          severity: 'medium',
          description: `Plot thread "${plotThread.title}" is marked as ${plotThread.status} but doesn't appear in chapters`,
          suggestion: `Consider referencing "${plotThread.title}" in your chapters or updating its status`,
          relatedIds: [plotThread.id],
        });
      }

      // Check for unresolved plot threads
      if (plotThread.status === 'DEVELOPING' && chapters.length > 5) {
        issues.push({
          type: 'plot',
          severity: 'low',
          description: `Plot thread "${plotThread.title}" has been developing for a while`,
          suggestion: `Consider advancing "${plotThread.title}" to climax or resolution`,
          relatedIds: [plotThread.id],
        });
      }
    }

    // Check for world element consistency
    for (const worldElement of worldElements) {
      const mentionCount = chapters.reduce((count, chapter) => {
        const mentions = (
          chapter.content
            .toLowerCase()
            .match(new RegExp(worldElement.name.toLowerCase(), 'g')) || []
        ).length;
        return count + mentions;
      }, 0);

      if (mentionCount === 0 && worldElement.type === 'LOCATION') {
        issues.push({
          type: 'world',
          severity: 'low',
          description: `Location "${worldElement.name}" is defined but not referenced in chapters`,
          suggestion: `Consider using "${worldElement.name}" in your story or removing it`,
          relatedIds: [worldElement.id],
        });
      }
    }

    // Calculate consistency score
    const totalElements =
      characters.length + plotThreads.length + worldElements.length;
    const issueWeight = issues.reduce((weight, issue) => {
      switch (issue.severity) {
        case 'high':
          return weight + 3;
        case 'medium':
          return weight + 2;
        case 'low':
          return weight + 1;
        default:
          return weight;
      }
    }, 0);

    const score = Math.max(
      0,
      Math.min(100, 100 - (issueWeight / Math.max(totalElements, 1)) * 20)
    );

    // Generate summary
    let summary = 'Your story context is ';
    if (score >= 90) summary += 'excellent with minimal issues.';
    else if (score >= 75) summary += 'good with some minor inconsistencies.';
    else if (score >= 60)
      summary += 'decent but has several areas for improvement.';
    else summary += 'needs attention to improve consistency.';

    return {
      issues,
      score: Math.round(score),
      summary,
    };
  } catch (error) {
    console.error('Error checking context consistency:', error);
    throw new Error('Failed to check context consistency');
  }
}

/**
 * Extract context information from generated content
 */
export async function extractContextFromContent(
  content: string,
  projectId: string
): Promise<ExtractedContext> {
  try {
    // Get existing context for comparison
    const [existingCharacters, existingWorldElements] = await Promise.all([
      getProjectCharacters(projectId),
      getProjectWorldElements(projectId),
    ]);

    const extractedContext: ExtractedContext = {
      characters: [],
      plotPoints: [],
      worldElements: [],
      timelineEvents: [],
    };

    // Extract character mentions and potential new traits
    for (const character of existingCharacters) {
      const mentions = (
        content
          .toLowerCase()
          .match(new RegExp(character.name.toLowerCase(), 'g')) || []
      ).length;
      if (mentions > 0) {
        // Look for potential new character traits in sentences mentioning the character
        const sentences = content.split(/[.!?]+/);
        const characterSentences = sentences.filter((sentence) =>
          sentence.toLowerCase().includes(character.name.toLowerCase())
        );

        const newTraits: string[] = [];
        for (const sentence of characterSentences) {
          // Simple pattern matching for traits (adjectives before character name)
          const traitPattern = new RegExp(`(\\w+)\\s+${character.name}`, 'gi');
          const matches = sentence.match(traitPattern);
          if (matches) {
            matches.forEach((match) => {
              const trait = match
                .replace(new RegExp(character.name, 'gi'), '')
                .trim();
              if (
                trait.length > 2 &&
                !character.description
                  .toLowerCase()
                  .includes(trait.toLowerCase())
              ) {
                newTraits.push(trait);
              }
            });
          }
        }

        extractedContext.characters.push({
          name: character.name,
          mentions,
          newTraits: newTraits.length > 0 ? newTraits : undefined,
        });
      }
    }

    // Extract potential plot points (sentences with action words)
    const actionWords = [
      'decided',
      'discovered',
      'realized',
      'confronted',
      'revealed',
      'escaped',
      'fought',
      'won',
      'lost',
    ];
    const sentences = content.split(/[.!?]+/);

    for (const sentence of sentences) {
      const hasAction = actionWords.some((word) =>
        sentence.toLowerCase().includes(word)
      );
      if (hasAction && sentence.trim().length > 20) {
        extractedContext.plotPoints.push({
          description: sentence.trim(),
          importance: hasAction ? 3 : 1,
        });
      }
    }

    // Extract potential world elements (capitalized nouns that might be locations)
    const capitalizedWords =
      content.match(/\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g) || [];
    const locationWords = [
      'castle',
      'city',
      'town',
      'forest',
      'mountain',
      'river',
      'kingdom',
      'palace',
      'temple',
    ];

    for (const word of capitalizedWords) {
      const isLikelyLocation = locationWords.some(
        (locWord) =>
          word.toLowerCase().includes(locWord) ||
          content.toLowerCase().includes(`in ${word.toLowerCase()}`) ||
          content.toLowerCase().includes(`at ${word.toLowerCase()}`)
      );

      if (
        isLikelyLocation &&
        !existingWorldElements.some(
          (we) => we.name.toLowerCase() === word.toLowerCase()
        )
      ) {
        extractedContext.worldElements.push({
          name: word,
          type: 'LOCATION',
          description: `Mentioned location in the story`,
        });
      }
    }

    // Extract potential timeline events (sentences with time indicators)
    const timeWords = [
      'then',
      'next',
      'later',
      'afterwards',
      'meanwhile',
      'suddenly',
      'finally',
    ];
    for (const sentence of sentences) {
      const hasTimeIndicator = timeWords.some((word) =>
        sentence.toLowerCase().includes(word)
      );
      if (hasTimeIndicator && sentence.trim().length > 15) {
        extractedContext.timelineEvents.push({
          title: sentence.trim().substring(0, 50) + '...',
          eventDate: 'To be determined',
          description: sentence.trim(),
        });
      }
    }

    return extractedContext;
  } catch (error) {
    console.error('Error extracting context from content:', error);
    throw new Error('Failed to extract context from content');
  }
}

/**
 * Get complete project context for AI generation
 */
export async function getProjectContext(projectId: string): Promise<{
  characters: CharacterWithRelationships[];
  plotThreads: PlotThreadWithCharacters[];
  worldElements: WorldElementWithRelations[];
  timelineEvents: TimelineEvent[];
}> {
  try {
    const [characters, plotThreads, worldElements, timelineEvents] =
      await Promise.all([
        getProjectCharacters(projectId),
        getProjectPlotThreads(projectId),
        getProjectWorldElements(projectId),
        getProjectTimelineEvents(projectId),
      ]);

    return {
      characters,
      plotThreads,
      worldElements,
      timelineEvents,
    };
  } catch (error) {
    console.error('Error getting project context:', error);
    throw new Error('Failed to get project context');
  }
}

/**
 * Update project context based on extracted information
 */
export async function updateContextFromExtraction(
  projectId: string,
  extractedContext: ExtractedContext
): Promise<void> {
  try {
    // Update character descriptions with new traits
    for (const extractedChar of extractedContext.characters) {
      if (extractedChar.newTraits && extractedChar.newTraits.length > 0) {
        const character = await prisma.character.findFirst({
          where: {
            projectId,
            name: extractedChar.name,
          },
        });

        if (character) {
          const newDescription =
            character.description +
            (character.description ? ' ' : '') +
            `New traits: ${extractedChar.newTraits.join(', ')}`;

          await prisma.character.update({
            where: { id: character.id },
            data: { description: newDescription },
          });
        }
      }
    }

    // Create new world elements if they don't exist
    for (const worldElement of extractedContext.worldElements) {
      const existing = await prisma.worldElement.findFirst({
        where: {
          projectId,
          name: worldElement.name,
        },
      });

      if (!existing) {
        await createWorldElement(projectId, worldElement);
      }
    }

    // Create timeline events for significant plot points
    for (const plotPoint of extractedContext.plotPoints) {
      if (plotPoint.importance >= 3) {
        await createTimelineEvent(projectId, {
          title: plotPoint.description.substring(0, 50) + '...',
          description: plotPoint.description,
          eventDate: 'Recent',
          importance: plotPoint.importance,
        });
      }
    }
  } catch (error) {
    console.error('Error updating context from extraction:', error);
    throw new Error('Failed to update context from extraction');
  }
}
