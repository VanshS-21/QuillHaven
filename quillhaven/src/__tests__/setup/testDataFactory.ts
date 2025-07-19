/**
 * Comprehensive test data factory for complex test scenarios
 */

import { ProjectContext } from '@/types/ai';

export interface TestScenario {
  name: string;
  description: string;
  users: any[];
  projects: any[];
  chapters: any[];
  context?: ProjectContext;
}

/**
 * Create test scenarios for different use cases
 */
export class TestScenarioFactory {
  /**
   * Create a simple single-user scenario
   */
  static createSingleUserScenario(): TestScenario {
    const user = {
      id: 'user-1',
      email: 'writer@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Jane',
      lastName: 'Writer',
      isEmailVerified: true,
      subscriptionTier: 'premium',
      writingPreferences: {
        defaultGenre: 'Fantasy',
        preferredChapterLength: 2500,
        writingStyle: 'descriptive',
        aiAssistanceLevel: 'moderate',
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const project = {
      id: 'project-1',
      userId: user.id,
      title: "The Dragon's Quest",
      description: 'An epic fantasy adventure',
      genre: 'Fantasy',
      targetLength: 80000,
      currentWordCount: 15000,
      status: 'in-progress',
      context: {
        characters: [
          {
            id: 'char-1',
            name: 'Aria Stormwind',
            description: 'A brave young mage with the power to control storms',
            role: 'protagonist',
            relationships: [{ characterId: 'char-2', type: 'mentor' }],
            developmentArc: 'From inexperienced apprentice to master mage',
          },
          {
            id: 'char-2',
            name: 'Master Eldric',
            description: "An ancient wizard and Aria's mentor",
            role: 'supporting',
            relationships: [{ characterId: 'char-1', type: 'student' }],
            developmentArc: 'Guides Aria while facing his own past',
          },
        ],
        plotThreads: [
          {
            id: 'plot-1',
            title: 'The Ancient Prophecy',
            description:
              'A prophecy foretells of a chosen one who will save the realm',
            status: 'developing',
            relatedCharacters: ['char-1'],
            chapterReferences: ['chapter-1', 'chapter-3'],
          },
        ],
        worldElements: [
          {
            id: 'world-1',
            type: 'location',
            name: 'The Crystal Tower',
            description: 'A mystical tower where ancient magic is studied',
            significance: 'The center of magical learning in the realm',
            relatedElements: [],
          },
        ],
        timeline: [],
      },
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date(),
    };

    const chapters = [
      {
        id: 'chapter-1',
        projectId: project.id,
        title: 'The Awakening',
        content: 'Aria discovered her powers on a stormy night...',
        wordCount: 2500,
        order: 1,
        status: 'final',
        createdAt: new Date('2024-01-16'),
        updatedAt: new Date('2024-01-16'),
      },
      {
        id: 'chapter-2',
        projectId: project.id,
        title: 'The Mentor',
        content: 'Master Eldric appeared at the tower...',
        wordCount: 2800,
        order: 2,
        status: 'final',
        createdAt: new Date('2024-01-18'),
        updatedAt: new Date('2024-01-18'),
      },
      {
        id: 'chapter-3',
        projectId: project.id,
        title: 'The Prophecy Revealed',
        content: 'The ancient texts spoke of a chosen one...',
        wordCount: 3200,
        order: 3,
        status: 'draft',
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date(),
      },
    ];

    return {
      name: 'Single User Fantasy Novel',
      description: 'A single user working on a fantasy novel with rich context',
      users: [user],
      projects: [project],
      chapters,
      context: project.context,
    };
  }

  /**
   * Create a multi-user collaborative scenario
   */
  static createMultiUserScenario(): TestScenario {
    const users = [
      {
        id: 'user-1',
        email: 'author1@example.com',
        firstName: 'Alice',
        lastName: 'Author',
        subscriptionTier: 'professional',
      },
      {
        id: 'user-2',
        email: 'author2@example.com',
        firstName: 'Bob',
        lastName: 'Writer',
        subscriptionTier: 'premium',
      },
      {
        id: 'user-3',
        email: 'author3@example.com',
        firstName: 'Carol',
        lastName: 'Novelist',
        subscriptionTier: 'free',
      },
    ].map((user) => ({
      ...user,
      passwordHash: 'hashed-password',
      isEmailVerified: true,
      writingPreferences: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    }));

    const projects = users.map((user, index) => ({
      id: `project-${index + 1}`,
      userId: user.id,
      title: `Project ${index + 1}`,
      description: `Description for project ${index + 1}`,
      genre: ['Mystery', 'Romance', 'Sci-Fi'][index],
      targetLength: [60000, 80000, 100000][index],
      currentWordCount: [5000, 12000, 8000][index],
      status: ['draft', 'in-progress', 'draft'][index],
      context: {
        characters: [],
        plotThreads: [],
        worldElements: [],
        timeline: [],
      },
      createdAt: new Date(`2024-01-${10 + index}`),
      updatedAt: new Date(),
    }));

    const chapters = projects.flatMap((project, projectIndex) =>
      Array.from({ length: 3 }, (_, chapterIndex) => ({
        id: `chapter-${projectIndex + 1}-${chapterIndex + 1}`,
        projectId: project.id,
        title: `Chapter ${chapterIndex + 1}`,
        content: `Content for chapter ${chapterIndex + 1} of project ${projectIndex + 1}`,
        wordCount: 2000 + Math.floor(Math.random() * 1000),
        order: chapterIndex + 1,
        status: chapterIndex === 0 ? 'final' : 'draft',
        createdAt: new Date(`2024-01-${15 + projectIndex + chapterIndex}`),
        updatedAt: new Date(),
      }))
    );

    return {
      name: 'Multi-User Collaboration',
      description: 'Multiple users each working on their own projects',
      users,
      projects,
      chapters,
    };
  }

  /**
   * Create a large-scale performance testing scenario
   */
  static createLargeScaleScenario(): TestScenario {
    const users = Array.from({ length: 50 }, (_, i) => ({
      id: `user-${i + 1}`,
      email: `user${i + 1}@example.com`,
      passwordHash: 'hashed-password',
      firstName: `User${i + 1}`,
      lastName: 'Test',
      isEmailVerified: true,
      subscriptionTier: ['free', 'premium', 'professional'][i % 3],
      writingPreferences: {},
      createdAt: new Date(`2024-01-01`),
      updatedAt: new Date(),
    }));

    const projects = users.flatMap((user) =>
      Array.from({ length: Math.floor(Math.random() * 3) + 1 }, (_, i) => ({
        id: `${user.id}-project-${i + 1}`,
        userId: user.id,
        title: `Project ${i + 1} by ${user.firstName}`,
        description: `A test project for performance testing`,
        genre: ['Fiction', 'Non-Fiction', 'Poetry', 'Drama'][
          Math.floor(Math.random() * 4)
        ],
        targetLength: 50000 + Math.floor(Math.random() * 50000),
        currentWordCount: Math.floor(Math.random() * 20000),
        status: ['draft', 'in-progress', 'completed'][
          Math.floor(Math.random() * 3)
        ],
        context: {
          characters: [],
          plotThreads: [],
          worldElements: [],
          timeline: [],
        },
        createdAt: new Date(`2024-01-${Math.floor(Math.random() * 30) + 1}`),
        updatedAt: new Date(),
      }))
    );

    const chapters = projects.flatMap((project) =>
      Array.from({ length: Math.floor(Math.random() * 20) + 5 }, (_, i) => ({
        id: `${project.id}-chapter-${i + 1}`,
        projectId: project.id,
        title: `Chapter ${i + 1}`,
        content: `This is the content for chapter ${i + 1}. `.repeat(
          100 + Math.floor(Math.random() * 200)
        ),
        wordCount: 1000 + Math.floor(Math.random() * 3000),
        order: i + 1,
        status: ['draft', 'final', 'generated'][Math.floor(Math.random() * 3)],
        createdAt: new Date(`2024-01-${Math.floor(Math.random() * 30) + 1}`),
        updatedAt: new Date(),
      }))
    );

    return {
      name: 'Large Scale Performance Test',
      description: 'Large dataset for performance and scalability testing',
      users,
      projects,
      chapters,
    };
  }

  /**
   * Create a complex context scenario for AI testing
   */
  static createComplexContextScenario(): TestScenario {
    const user = {
      id: 'user-complex',
      email: 'complex@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Complex',
      lastName: 'Writer',
      isEmailVerified: true,
      subscriptionTier: 'professional',
      writingPreferences: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const complexContext: ProjectContext = {
      characters: Array.from({ length: 25 }, (_, i) => ({
        id: `char-${i + 1}`,
        name: `Character ${i + 1}`,
        description: `Detailed description for character ${i + 1}. `.repeat(20),
        role: ['protagonist', 'antagonist', 'supporting', 'minor'][i % 4],
        relationships: Array.from(
          { length: Math.floor(Math.random() * 5) },
          (_, j) => ({
            characterId: `char-${((i + j + 1) % 25) + 1}`,
            type: ['friend', 'enemy', 'family', 'mentor', 'rival'][j % 5],
          })
        ),
        developmentArc: `Complex development arc for character ${i + 1}`,
      })),
      plotThreads: Array.from({ length: 15 }, (_, i) => ({
        id: `plot-${i + 1}`,
        title: `Plot Thread ${i + 1}`,
        description: `Complex plot thread description ${i + 1}. `.repeat(30),
        status: ['introduced', 'developing', 'climax', 'resolved'][i % 4],
        relatedCharacters: Array.from(
          { length: Math.floor(Math.random() * 5) + 1 },
          (_, j) => `char-${((i + j) % 25) + 1}`
        ),
        chapterReferences: Array.from(
          { length: Math.floor(Math.random() * 10) + 1 },
          (_, j) => `chapter-${j + 1}`
        ),
      })),
      worldElements: Array.from({ length: 30 }, (_, i) => ({
        id: `world-${i + 1}`,
        type: ['location', 'rule', 'culture', 'history'][i % 4],
        name: `World Element ${i + 1}`,
        description: `Detailed world building element ${i + 1}. `.repeat(25),
        significance: `Critical significance for element ${i + 1}`,
        relatedElements: Array.from(
          { length: Math.floor(Math.random() * 3) },
          (_, j) => `world-${((i + j + 1) % 30) + 1}`
        ),
      })),
      timeline: Array.from({ length: 20 }, (_, i) => ({
        id: `timeline-${i + 1}`,
        event: `Major event ${i + 1}`,
        date: `Year ${1000 + i * 10}`,
        description: `Timeline event description ${i + 1}`,
        relatedCharacters: [`char-${(i % 25) + 1}`],
        relatedPlots: [`plot-${(i % 15) + 1}`],
      })),
    };

    const project = {
      id: 'project-complex',
      userId: user.id,
      title: 'The Epic Saga',
      description: 'A complex multi-layered epic with rich world-building',
      genre: 'Epic Fantasy',
      targetLength: 200000,
      currentWordCount: 75000,
      status: 'in-progress',
      context: complexContext,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const chapters = Array.from({ length: 30 }, (_, i) => ({
      id: `chapter-${i + 1}`,
      projectId: project.id,
      title: `Chapter ${i + 1}: ${['The Beginning', 'Rising Action', 'Complications', 'Climax', 'Resolution'][Math.floor(i / 6)]}`,
      content: `Complex chapter content ${i + 1}. `.repeat(500),
      wordCount: 2000 + Math.floor(Math.random() * 2000),
      order: i + 1,
      status: i < 20 ? 'final' : 'draft',
      generationParams:
        i > 15
          ? {
              prompt: `Generate chapter ${i + 1}`,
              length: 2500,
              tone: 'epic',
              style: 'fantasy',
              contextIds: [`char-${(i % 25) + 1}`, `plot-${(i % 15) + 1}`],
            }
          : null,
      createdAt: new Date(`2024-01-${Math.floor(i / 2) + 1}`),
      updatedAt: new Date(),
    }));

    return {
      name: 'Complex Context Scenario',
      description:
        'Rich, complex project with extensive world-building and character development',
      users: [user],
      projects: [project],
      chapters,
      context: complexContext,
    };
  }

  /**
   * Create an error-prone scenario for testing error handling
   */
  static createErrorScenario(): TestScenario {
    const user = {
      id: 'user-error',
      email: 'error@example.com',
      passwordHash: 'hashed-password',
      firstName: 'Error',
      lastName: 'Tester',
      isEmailVerified: false, // Unverified user
      subscriptionTier: 'free',
      writingPreferences: {},
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const project = {
      id: 'project-error',
      userId: user.id,
      title: '', // Empty title to trigger validation errors
      description: null,
      genre: 'InvalidGenre',
      targetLength: -1000, // Invalid target length
      currentWordCount: 0,
      status: 'invalid-status',
      context: {
        characters: [
          {
            id: 'char-invalid',
            name: '', // Empty name
            description: null,
            role: 'invalid-role',
            relationships: [
              { characterId: 'non-existent-char', type: 'invalid-type' },
            ],
            developmentArc: '',
          },
        ],
        plotThreads: [],
        worldElements: [],
        timeline: [],
      },
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date(),
    };

    const chapters = [
      {
        id: 'chapter-error',
        projectId: project.id,
        title: '', // Empty title
        content: '', // Empty content
        wordCount: -1, // Invalid word count
        order: 0, // Invalid order
        status: 'invalid-status',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date(),
      },
    ];

    return {
      name: 'Error Testing Scenario',
      description: 'Scenario with invalid data to test error handling',
      users: [user],
      projects: [project],
      chapters,
    };
  }

  /**
   * Get all available scenarios
   */
  static getAllScenarios(): TestScenario[] {
    return [
      this.createSingleUserScenario(),
      this.createMultiUserScenario(),
      this.createLargeScaleScenario(),
      this.createComplexContextScenario(),
      this.createErrorScenario(),
    ];
  }

  /**
   * Get scenario by name
   */
  static getScenario(name: string): TestScenario | null {
    const scenarios = this.getAllScenarios();
    return scenarios.find((scenario) => scenario.name === name) || null;
  }
}
