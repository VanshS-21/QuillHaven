import redis from '@/lib/redis';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
}

export class CacheService {
  private static instance: CacheService;
  private defaultTTL = 3600; // 1 hour default
  private keyPrefix = 'quillhaven:';

  static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Generate cache key with prefix
   */
  private getKey(key: string, prefix?: string): string {
    const finalPrefix = prefix || this.keyPrefix;
    return `${finalPrefix}${key}`;
  }

  /**
   * Set cache value
   */
  async set(
    key: string,
    value: unknown,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      const ttl = options.ttl || this.defaultTTL;
      const serializedValue = JSON.stringify(value);
      
      await redis.setex(cacheKey, ttl, serializedValue);
    } catch (error) {
      console.error('Cache set error:', error);
      // Fail silently to not break the application
    }
  }

  /**
   * Get cache value
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      const value = await redis.get(cacheKey);
      
      if (!value) return null;
      
      return JSON.parse(value) as T;
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Delete cache value
   */
  async del(key: string, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      await redis.del(cacheKey);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Delete multiple cache values by pattern
   */
  async delPattern(pattern: string, options: CacheOptions = {}): Promise<void> {
    try {
      const searchPattern = this.getKey(pattern, options.prefix);
      const keys = await redis.keys(searchPattern);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache delete pattern error:', error);
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      const result = await redis.exists(cacheKey);
      return result === 1;
    } catch (error) {
      console.error('Cache exists error:', error);
      return false;
    }
  }

  /**
   * Get or set pattern - fetch from cache or execute function and cache result
   */
  async getOrSet<T>(
    key: string,
    fetchFunction: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);
    if (cached !== null) {
      return cached;
    }

    // If not in cache, execute function and cache result
    const result = await fetchFunction();
    await this.set(key, result, options);
    return result;
  }

  /**
   * Increment counter
   */
  async increment(key: string, options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      return await redis.incr(cacheKey);
    } catch (error) {
      console.error('Cache increment error:', error);
      return 0;
    }
  }

  /**
   * Set expiration for existing key
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<void> {
    try {
      const cacheKey = this.getKey(key, options.prefix);
      await redis.expire(cacheKey, ttl);
    } catch (error) {
      console.error('Cache expire error:', error);
    }
  }

  /**
   * Get multiple keys at once
   */
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.getKey(key, options.prefix));
      const values = await redis.mget(...cacheKeys);
      
      return values.map(value => {
        if (!value) return null;
        try {
          return JSON.parse(value) as T;
        } catch {
          return null;
        }
      });
    } catch (error) {
      console.error('Cache mget error:', error);
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple keys at once
   */
  async mset(keyValuePairs: Record<string, unknown>, options: CacheOptions = {}): Promise<void> {
    try {
      const pipeline = redis.pipeline();
      const ttl = options.ttl || this.defaultTTL;
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const cacheKey = this.getKey(key, options.prefix);
        const serializedValue = JSON.stringify(value);
        pipeline.setex(cacheKey, ttl, serializedValue);
      });
      
      await pipeline.exec();
    } catch (error) {
      console.error('Cache mset error:', error);
    }
  }

  /**
   * Clear all cache with specific prefix
   */
  async clear(prefix?: string): Promise<void> {
    try {
      const searchPrefix = prefix || this.keyPrefix;
      const keys = await redis.keys(`${searchPrefix}*`);
      
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    hitRate?: number;
  }> {
    try {
      const info = await redis.info('memory');
      const keyCount = await redis.dbsize();
      
      // Extract memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsage = memoryMatch ? memoryMatch[1] : 'Unknown';
      
      return {
        totalKeys: keyCount,
        memoryUsage,
      };
    } catch (error) {
      console.error('Cache stats error:', error);
      return {
        totalKeys: 0,
        memoryUsage: 'Unknown',
      };
    }
  }
}

// Cache key generators for different data types
export const CacheKeys = {
  user: (userId: string) => `user:${userId}`,
  userProjects: (userId: string) => `user:${userId}:projects`,
  project: (projectId: string) => `project:${projectId}`,
  projectChapters: (projectId: string) => `project:${projectId}:chapters`,
  chapter: (chapterId: string) => `chapter:${chapterId}`,
  chapterVersions: (chapterId: string) => `chapter:${chapterId}:versions`,
  projectContext: (projectId: string) => `project:${projectId}:context`,
  characters: (projectId: string) => `project:${projectId}:characters`,
  plotThreads: (projectId: string) => `project:${projectId}:plot-threads`,
  worldElements: (projectId: string) => `project:${projectId}:world-elements`,
  exportJob: (exportId: string) => `export:${exportId}`,
  aiGeneration: (hash: string) => `ai:generation:${hash}`,
  userSession: (sessionId: string) => `session:${sessionId}`,
  rateLimiting: (identifier: string) => `rate-limit:${identifier}`,
};

export const cacheService = CacheService.getInstance();