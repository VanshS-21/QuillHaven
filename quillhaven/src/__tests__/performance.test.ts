import { cacheService, CacheKeys } from '@/services/cacheService';
import { performanceMonitor } from '@/lib/performance';
import { 
  parsePaginationParams, 
  createPaginationResponse,
  createCursorPaginationResponse 
} from '@/utils/pagination';
import { CACHE_CONFIG, PERFORMANCE_CONFIG } from '@/lib/config/performance';

// Mock Redis for testing
jest.mock('@/lib/redis', () => ({
  __esModule: true,
  default: {
    setex: jest.fn().mockResolvedValue('OK'),
    get: jest.fn().mockResolvedValue(null),
    del: jest.fn().mockResolvedValue(1),
    keys: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(0),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    mget: jest.fn().mockResolvedValue([]),
    pipeline: jest.fn().mockReturnValue({
      setex: jest.fn(),
      exec: jest.fn().mockResolvedValue([]),
    }),
    info: jest.fn().mockResolvedValue('used_memory_human:1.5M'),
    dbsize: jest.fn().mockResolvedValue(100),
  },
}));

describe('Performance Optimization', () => {
  describe('Cache Service', () => {
    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should set and get cache values', async () => {
      const testData = { id: '1', name: 'Test Project' };
      const key = 'test:project:1';

      await cacheService.set(key, testData, { ttl: 300 });
      
      // Mock successful get
      const redis = require('@/lib/redis').default;
      redis.get.mockResolvedValueOnce(JSON.stringify(testData));
      
      const result = await cacheService.get(key);
      expect(result).toEqual(testData);
    });

    it('should handle cache misses gracefully', async () => {
      const result = await cacheService.get('nonexistent:key');
      expect(result).toBeNull();
    });

    it('should generate correct cache keys', () => {
      const userId = 'user123';
      const projectId = 'project456';
      
      expect(CacheKeys.user(userId)).toBe('user:user123');
      expect(CacheKeys.project(projectId)).toBe('project:project456');
      expect(CacheKeys.userProjects(userId)).toBe('user:user123:projects');
    });

    it('should implement getOrSet pattern', async () => {
      const key = 'test:getOrSet';
      const fetchFunction = jest.fn().mockResolvedValue({ data: 'fetched' });
      
      // First call should execute fetch function
      const result1 = await cacheService.getOrSet(key, fetchFunction);
      expect(fetchFunction).toHaveBeenCalledTimes(1);
      expect(result1).toEqual({ data: 'fetched' });
      
      // Mock cache hit for second call
      const redis = require('@/lib/redis').default;
      redis.get.mockResolvedValueOnce(JSON.stringify({ data: 'cached' }));
      
      const result2 = await cacheService.getOrSet(key, fetchFunction);
      expect(fetchFunction).toHaveBeenCalledTimes(1); // Should not be called again
      expect(result2).toEqual({ data: 'cached' });
    });
  });

  describe('Performance Monitor', () => {
    it('should track request timing', async () => {
      const route = '/api/test';
      const method = 'GET';
      
      const endTiming = performanceMonitor.startTiming(route, method);
      
      // Simulate some work
      await new Promise(resolve => setTimeout(resolve, 10));
      
      await endTiming(200, 'user123', false);
      
      const stats = performanceMonitor.getStats(60000); // Last minute
      expect(stats.totalRequests).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeGreaterThan(0);
    });

    it('should calculate performance statistics correctly', () => {
      const stats = performanceMonitor.getStats();
      
      expect(stats).toHaveProperty('totalRequests');
      expect(stats).toHaveProperty('averageResponseTime');
      expect(stats).toHaveProperty('cacheHitRate');
      expect(stats).toHaveProperty('slowestRequests');
      expect(stats).toHaveProperty('errorRate');
      expect(stats).toHaveProperty('requestsByRoute');
    });

    it('should track route-specific statistics', () => {
      const routeStats = performanceMonitor.getRouteStats('/api/projects');
      
      expect(routeStats).toHaveProperty('totalRequests');
      expect(routeStats).toHaveProperty('averageResponseTime');
      expect(routeStats).toHaveProperty('p95ResponseTime');
      expect(routeStats).toHaveProperty('p99ResponseTime');
      expect(routeStats).toHaveProperty('errorRate');
    });
  });

  describe('Pagination Utils', () => {
    it('should parse pagination parameters correctly', () => {
      const searchParams = new URLSearchParams({
        page: '2',
        limit: '20',
        sortBy: 'createdAt',
        sortOrder: 'asc',
      });

      const params = parsePaginationParams(searchParams, {
        limit: 10,
        maxLimit: 50,
      });

      expect(params.page).toBe(2);
      expect(params.limit).toBe(20);
      expect(params.sortBy).toBe('createdAt');
      expect(params.sortOrder).toBe('asc');
    });

    it('should enforce maximum limits', () => {
      const searchParams = new URLSearchParams({
        limit: '200', // Exceeds max
      });

      const params = parsePaginationParams(searchParams, {
        limit: 10,
        maxLimit: 50,
      });

      expect(params.limit).toBe(50); // Should be capped at maxLimit
    });

    it('should create pagination response correctly', () => {
      const data = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const response = createPaginationResponse(data, 1, 10, 25);

      expect(response.data).toEqual(data);
      expect(response.pagination.page).toBe(1);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.total).toBe(25);
      expect(response.pagination.totalPages).toBe(3);
      expect(response.pagination.hasNextPage).toBe(true);
      expect(response.pagination.hasPreviousPage).toBe(false);
    });

    it('should create cursor pagination response correctly', () => {
      const data = [
        { id: 1, createdAt: '2023-01-01' },
        { id: 2, createdAt: '2023-01-02' },
      ];
      
      const response = createCursorPaginationResponse(data, 10, 'createdAt', true);

      expect(response.data).toEqual(data);
      expect(response.pagination.limit).toBe(10);
      expect(response.pagination.hasNextPage).toBe(false); // Less than limit
      expect(response.pagination.nextCursor).toBeUndefined();
    });
  });

  describe('Configuration', () => {
    it('should have valid cache configuration', () => {
      expect(CACHE_CONFIG.DEFAULT_TTL).toBeGreaterThan(0);
      expect(CACHE_CONFIG.TTL_BY_TYPE.user).toBeGreaterThan(0);
      expect(CACHE_CONFIG.TTL_BY_TYPE.project).toBeGreaterThan(0);
    });

    it('should have valid performance configuration', () => {
      expect(PERFORMANCE_CONFIG.DATABASE.CONNECTION_POOL_SIZE).toBeGreaterThan(0);
      expect(PERFORMANCE_CONFIG.API.RESPONSE_TIMEOUT).toBeGreaterThan(0);
      expect(PERFORMANCE_CONFIG.RATE_LIMITING.MAX_REQUESTS).toBeGreaterThan(0);
    });

    it('should validate cache TTL values', () => {
      Object.values(CACHE_CONFIG.TTL_BY_TYPE).forEach(ttl => {
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(86400); // Max 24 hours
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle cache errors gracefully', async () => {
      const redis = require('@/lib/redis').default;
      redis.get.mockRejectedValueOnce(new Error('Redis connection failed'));

      const result = await cacheService.get('test:key');
      expect(result).toBeNull(); // Should return null on error
    });

    it('should handle cache set errors gracefully', async () => {
      const redis = require('@/lib/redis').default;
      redis.setex.mockRejectedValueOnce(new Error('Redis connection failed'));

      // Should not throw error
      await expect(cacheService.set('test:key', { data: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should complete cache operations within acceptable time', async () => {
      const startTime = performance.now();
      
      await cacheService.set('benchmark:key', { large: 'data'.repeat(1000) });
      await cacheService.get('benchmark:key');
      
      const duration = performance.now() - startTime;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
    });

    it('should handle concurrent cache operations', async () => {
      const operations = Array.from({ length: 10 }, (_, i) => 
        cacheService.set(`concurrent:${i}`, { data: i })
      );

      const startTime = performance.now();
      await Promise.all(operations);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete within 500ms
    });
  });
});