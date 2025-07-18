import { cacheService } from '@/services/cacheService';

export interface PerformanceMetrics {
  timestamp: number;
  route: string;
  method: string;
  duration: number;
  cacheHit?: boolean;
  userId?: string;
  statusCode: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 1000; // Keep last 1000 metrics in memory

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  /**
   * Start timing a request
   */
  startTiming(route: string, method: string): () => Promise<void> {
    const startTime = performance.now();
    
    return async (statusCode: number = 200, userId?: string, cacheHit?: boolean) => {
      const duration = performance.now() - startTime;
      
      const metric: PerformanceMetrics = {
        timestamp: Date.now(),
        route,
        method,
        duration,
        cacheHit,
        userId,
        statusCode,
      };

      this.recordMetric(metric);
    };
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only the last N metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }

    // Store in cache for persistence
    this.storeMetricInCache(metric);
  }

  /**
   * Store metric in cache for persistence
   */
  private async storeMetricInCache(metric: PerformanceMetrics): Promise<void> {
    try {
      const key = `performance:${Date.now()}:${Math.random()}`;
      await cacheService.set(key, metric, { ttl: 86400 }); // Store for 24 hours
    } catch (error) {
      console.error('Failed to store performance metric:', error);
    }
  }

  /**
   * Get performance statistics
   */
  getStats(timeRangeMs: number = 3600000): {
    totalRequests: number;
    averageResponseTime: number;
    cacheHitRate: number;
    slowestRequests: PerformanceMetrics[];
    errorRate: number;
    requestsByRoute: Record<string, number>;
  } {
    const cutoffTime = Date.now() - timeRangeMs;
    const recentMetrics = this.metrics.filter(m => m.timestamp > cutoffTime);

    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        slowestRequests: [],
        errorRate: 0,
        requestsByRoute: {},
      };
    }

    const totalRequests = recentMetrics.length;
    const averageResponseTime = recentMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    
    const cacheHits = recentMetrics.filter(m => m.cacheHit === true).length;
    const cacheableRequests = recentMetrics.filter(m => m.cacheHit !== undefined).length;
    const cacheHitRate = cacheableRequests > 0 ? (cacheHits / cacheableRequests) * 100 : 0;
    
    const slowestRequests = [...recentMetrics]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);
    
    const errorRequests = recentMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorRequests / totalRequests) * 100;
    
    const requestsByRoute = recentMetrics.reduce((acc, m) => {
      acc[m.route] = (acc[m.route] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalRequests,
      averageResponseTime,
      cacheHitRate,
      slowestRequests,
      errorRate,
      requestsByRoute,
    };
  }

  /**
   * Get metrics for a specific route
   */
  getRouteStats(route: string, timeRangeMs: number = 3600000): {
    totalRequests: number;
    averageResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
    errorRate: number;
  } {
    const cutoffTime = Date.now() - timeRangeMs;
    const routeMetrics = this.metrics.filter(
      m => m.timestamp > cutoffTime && m.route === route
    );

    if (routeMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
      };
    }

    const totalRequests = routeMetrics.length;
    const averageResponseTime = routeMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    
    const sortedDurations = routeMetrics.map(m => m.duration).sort((a, b) => a - b);
    const p95Index = Math.floor(sortedDurations.length * 0.95);
    const p99Index = Math.floor(sortedDurations.length * 0.99);
    const p95ResponseTime = sortedDurations[p95Index] || 0;
    const p99ResponseTime = sortedDurations[p99Index] || 0;
    
    const errorRequests = routeMetrics.filter(m => m.statusCode >= 400).length;
    const errorRate = (errorRequests / totalRequests) * 100;

    return {
      totalRequests,
      averageResponseTime,
      p95ResponseTime,
      p99ResponseTime,
      errorRate,
    };
  }

  /**
   * Clear old metrics
   */
  clearOldMetrics(olderThanMs: number = 86400000): void {
    const cutoffTime = Date.now() - olderThanMs;
    this.metrics = this.metrics.filter(m => m.timestamp > cutoffTime);
  }
}

/**
 * Middleware to automatically track performance
 */
export function withPerformanceTracking(
  handler: (req: Request) => Promise<Response>,
  route: string
) {
  return async (req: Request): Promise<Response> => {
    const monitor = PerformanceMonitor.getInstance();
    const endTiming = monitor.startTiming(route, req.method);
    
    try {
      const response = await handler(req);
      const cacheHit = response.headers.get('X-Cache') === 'HIT';
      const userId = req.headers.get('X-User-ID') || undefined;
      
      await endTiming(response.status, userId, cacheHit);
      
      return response;
    } catch (error) {
      await endTiming(500);
      throw error;
    }
  };
}

export const performanceMonitor = PerformanceMonitor.getInstance();