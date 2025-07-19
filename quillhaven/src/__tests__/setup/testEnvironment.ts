/**
 * Test environment setup and cleanup utilities
 */

// Re-export all helper functions
export * from './testHelpers';
export * from './testDataFactory';

// Global test cleanup handlers
const cleanupHandlers: Array<() => Promise<void> | void> = [];

/**
 * Register a cleanup handler to be called after all tests
 */
export function registerCleanupHandler(handler: () => Promise<void> | void) {
  cleanupHandlers.push(handler);
}

/**
 * Run all registered cleanup handlers
 */
export async function runCleanupHandlers() {
  for (const handler of cleanupHandlers) {
    try {
      await handler();
    } catch (error) {
      console.warn('Cleanup handler failed:', error);
    }
  }
  cleanupHandlers.length = 0;
}

/**
 * Setup test environment with proper cleanup
 */
export function setupTestEnvironment() {
  // Handle process cleanup
  const cleanup = async () => {
    await runCleanupHandlers();

    // Force close any remaining handles
    if (process.env.NODE_ENV === 'test') {
      // Give a small delay for cleanup
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  };

  // Register cleanup on process exit
  process.on('beforeExit', cleanup);
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  return cleanup;
}

/**
 * Mock email service for tests
 */
export function createMockEmailService() {
  const mockSendVerificationEmail = jest.fn().mockResolvedValue({
    success: true,
    message: 'Verification email sent successfully',
  });

  const mockSendPasswordResetEmail = jest.fn().mockResolvedValue({
    success: true,
    message: 'Password reset email sent successfully',
  });

  const mockTestEmailConnection = jest.fn().mockResolvedValue({
    success: true,
    message: 'Email configuration is valid',
  });

  return {
    sendVerificationEmail: mockSendVerificationEmail,
    sendPasswordResetEmail: mockSendPasswordResetEmail,
    testEmailConnection: mockTestEmailConnection,
  };
}

/**
 * Create mock user for tests
 */
export function createMockUser(overrides: Partial<any> = {}) {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    passwordHash: 'hashed-password',
    firstName: 'Test',
    lastName: 'User',
    isEmailVerified: true,
    emailVerificationToken: null,
    subscriptionTier: 'free',
    writingPreferences: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    passwordResetToken: null,
    passwordResetExpires: null,
    ...overrides,
  };
}

/**
 * Create mock project for tests
 */
export function createMockProject(overrides: Partial<any> = {}) {
  return {
    id: 'test-project-id',
    userId: 'test-user-id',
    title: 'Test Project',
    description: 'A test project',
    genre: 'Fiction',
    targetLength: 50000,
    currentWordCount: 0,
    status: 'draft',
    context: {
      characters: [],
      plotThreads: [],
      worldElements: [],
      timeline: [],
    },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock chapter for tests
 */
export function createMockChapter(overrides: Partial<any> = {}) {
  return {
    id: 'test-chapter-id',
    projectId: 'test-project-id',
    title: 'Test Chapter',
    content: 'This is test chapter content.',
    wordCount: 100,
    order: 1,
    status: 'draft',
    generationParams: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock project context for AI tests
 */
export function createMockProjectContext(
  size: 'small' | 'medium' | 'large' = 'medium'
) {
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
    worldElements: Array.from({ length: config.worldBuilding }, (_, i) => ({
      id: `world-${i}`,
      type: 'location',
      name: `Location ${i}`,
      description: `Description for location ${i}`.repeat(20),
      significance: `Significance of location ${i}`,
      relatedElements: [],
    })),
    timeline: [],
  };
}
