/**
 * Test helper functions and utilities
 */

import { NextRequest } from 'next/server';

/**
 * Create a mock NextRequest for testing API routes
 */
export function createMockRequest(
  url: string,
  options: {
    method?: string;
    body?: any;
    headers?: Record<string, string>;
    searchParams?: Record<string, string>;
  } = {}
): NextRequest {
  const {
    method = 'GET',
    body,
    headers = {},
    searchParams = {},
  } = options;

  // Build URL with search params
  const urlObj = new URL(url);
  Object.entries(searchParams).forEach(([key, value]) => {
    urlObj.searchParams.set(key, value);
  });

  const requestInit: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    requestInit.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  return new NextRequest(urlObj.toString(), requestInit);
}

/**
 * Create a mock authenticated request with JWT token
 */
export function createAuthenticatedRequest(
  url: string,
  userId: string,
  options: Parameters<typeof createMockRequest>[1] = {}
): NextRequest {
  const token = `Bearer mock-jwt-token-${userId}`;
  return createMockRequest(url, {
    ...options,
    headers: {
      Authorization: token,
      ...options.headers,
    },
  });
}

/**
 * Extract JSON from a Response object
 */
export async function extractJson(response: Response): Promise<any> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generate random string for testing
 */
export function randomString(length: number = 10): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate random email for testing
 */
export function randomEmail(): string {
  return `test-${randomString(8)}@example.com`;
}

/**
 * Generate random password for testing
 */
export function randomPassword(): string {
  return `Test${randomString(8)}!123`;
}

/**
 * Create test data with consistent structure
 */
export class TestDataFactory {
  private static userCounter = 0;
  private static projectCounter = 0;
  private static chapterCounter = 0;

  static createUser(overrides: Partial<any> = {}) {
    this.userCounter++;
    return {
      id: `test-user-${this.userCounter}`,
      email: `user${this.userCounter}@example.com`,
      passwordHash: 'hashed-password',
      firstName: `User${this.userCounter}`,
      lastName: 'Test',
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

  static createProject(userId?: string, overrides: Partial<any> = {}) {
    this.projectCounter++;
    return {
      id: `test-project-${this.projectCounter}`,
      userId: userId || `test-user-${this.userCounter}`,
      title: `Test Project ${this.projectCounter}`,
      description: `Description for test project ${this.projectCounter}`,
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

  static createChapter(projectId?: string, overrides: Partial<any> = {}) {
    this.chapterCounter++;
    return {
      id: `test-chapter-${this.chapterCounter}`,
      projectId: projectId || `test-project-${this.projectCounter}`,
      title: `Chapter ${this.chapterCounter}`,
      content: `This is the content for chapter ${this.chapterCounter}. `.repeat(50),
      wordCount: 250,
      order: this.chapterCounter,
      status: 'draft',
      generationParams: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  static createCharacter(projectId?: string, overrides: Partial<any> = {}) {
    const characterCounter = Math.floor(Math.random() * 1000);
    return {
      id: `test-character-${characterCounter}`,
      projectId: projectId || `test-project-${this.projectCounter}`,
      name: `Character ${characterCounter}`,
      description: `Description for character ${characterCounter}`,
      role: 'protagonist',
      relationships: [],
      developmentArc: `Development arc for character ${characterCounter}`,
      firstAppearance: null,
      ...overrides,
    };
  }

  static createPlotThread(projectId?: string, overrides: Partial<any> = {}) {
    const plotCounter = Math.floor(Math.random() * 1000);
    return {
      id: `test-plot-${plotCounter}`,
      projectId: projectId || `test-project-${this.projectCounter}`,
      title: `Plot Thread ${plotCounter}`,
      description: `Description for plot thread ${plotCounter}`,
      status: 'developing',
      relatedCharacters: [],
      chapterReferences: [],
      ...overrides,
    };
  }

  static createWorldElement(projectId?: string, overrides: Partial<any> = {}) {
    const worldCounter = Math.floor(Math.random() * 1000);
    return {
      id: `test-world-${worldCounter}`,
      projectId: projectId || `test-project-${this.projectCounter}`,
      type: 'location',
      name: `Location ${worldCounter}`,
      description: `Description for location ${worldCounter}`,
      significance: `Significance of location ${worldCounter}`,
      relatedElements: [],
      ...overrides,
    };
  }

  static reset() {
    this.userCounter = 0;
    this.projectCounter = 0;
    this.chapterCounter = 0;
  }
}

/**
 * Performance measurement utilities
 */
export class PerformanceHelper {
  private static measurements: Map<string, number> = new Map();

  static startMeasurement(name: string): void {
    this.measurements.set(name, Date.now());
  }

  static endMeasurement(name: string): number {
    const startTime = this.measurements.get(name);
    if (!startTime) {
      throw new Error(`No measurement started for: ${name}`);
    }
    const duration = Date.now() - startTime;
    this.measurements.delete(name);
    return duration;
  }

  static async measureAsync<T>(name: string, fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
    this.startMeasurement(name);
    const result = await fn();
    const duration = this.endMeasurement(name);
    return { result, duration };
  }

  static measure<T>(name: string, fn: () => T): { result: T; duration: number } {
    this.startMeasurement(name);
    const result = fn();
    const duration = this.endMeasurement(name);
    return { result, duration };
  }
}

/**
 * Memory usage utilities
 */
export class MemoryHelper {
  static getMemoryUsage(): NodeJS.MemoryUsage {
    return process.memoryUsage();
  }

  static formatMemoryUsage(usage: NodeJS.MemoryUsage): string {
    const formatBytes = (bytes: number) => {
      const mb = bytes / 1024 / 1024;
      return `${mb.toFixed(2)} MB`;
    };

    return `RSS: ${formatBytes(usage.rss)}, Heap Used: ${formatBytes(usage.heapUsed)}, Heap Total: ${formatBytes(usage.heapTotal)}, External: ${formatBytes(usage.external)}`;
  }

  static async measureMemoryUsage<T>(fn: () => Promise<T>): Promise<{ result: T; memoryDelta: number }> {
    const initialMemory = this.getMemoryUsage().heapUsed;
    const result = await fn();
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    const finalMemory = this.getMemoryUsage().heapUsed;
    const memoryDelta = finalMemory - initialMemory;
    
    return { result, memoryDelta };
  }
}

/**
 * Database test utilities
 */
export class DatabaseTestHelper {
  static createMockPrismaError(code: string, message: string = 'Database error') {
    const error = new Error(message) as any;
    error.code = code;
    return error;
  }

  static createUniqueConstraintError(field: string) {
    return this.createMockPrismaError('P2002', `Unique constraint failed on the constraint: ${field}`);
  }

  static createNotFoundError() {
    return this.createMockPrismaError('P2025', 'Record not found');
  }

  static createConnectionError() {
    return this.createMockPrismaError('P1001', 'Can\'t reach database server');
  }
}

/**
 * Async test utilities
 */
export class AsyncTestHelper {
  static async waitForCondition(
    condition: () => boolean | Promise<boolean>,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      if (await condition()) {
        return;
      }
      await wait(interval);
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  static async expectEventually(
    fn: () => Promise<void> | void,
    timeout: number = 5000,
    interval: number = 100
  ): Promise<void> {
    const startTime = Date.now();
    let lastError: Error | null = null;
    
    while (Date.now() - startTime < timeout) {
      try {
        await fn();
        return;
      } catch (error) {
        lastError = error as Error;
        await wait(interval);
      }
    }
    
    throw lastError || new Error(`Expectation not met within ${timeout}ms`);
  }
}