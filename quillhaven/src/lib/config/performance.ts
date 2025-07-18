/**
 * Performance optimization configuration
 */

export const CACHE_CONFIG = {
  // Default TTL values (in seconds)
  DEFAULT_TTL: 3600, // 1 hour
  SHORT_TTL: 300,    // 5 minutes
  MEDIUM_TTL: 1800,  // 30 minutes
  LONG_TTL: 86400,   // 24 hours

  // Cache keys TTL mapping
  TTL_BY_TYPE: {
    user: 1800,           // 30 minutes
    project: 300,         // 5 minutes
    chapter: 180,         // 3 minutes
    context: 600,         // 10 minutes
    stats: 600,           // 10 minutes
    export: 3600,         // 1 hour
    ai_generation: 7200,  // 2 hours
  },

  // Cache invalidation patterns
  INVALIDATION_PATTERNS: {
    USER_DATA: (userId: string) => [`user:${userId}*`],
    PROJECT_DATA: (projectId: string) => [`*project:${projectId}*`],
    CHAPTER_DATA: (chapterId: string) => [`*chapter:${chapterId}*`],
  },
} as const;

export const PAGINATION_CONFIG = {
  // Default pagination limits
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
  
  // Specific limits by resource type
  LIMITS: {
    projects: { default: 10, max: 50 },
    chapters: { default: 20, max: 100 },
    characters: { default: 25, max: 100 },
    plotThreads: { default: 15, max: 50 },
    worldElements: { default: 20, max: 100 },
    timelineEvents: { default: 30, max: 100 },
  },
} as const;

export const PERFORMANCE_CONFIG = {
  // Database query optimization
  DATABASE: {
    CONNECTION_POOL_SIZE: 20,
    QUERY_TIMEOUT: 10000,      // 10 seconds
    TRANSACTION_TIMEOUT: 5000,  // 5 seconds
    SLOW_QUERY_THRESHOLD: 1000, // 1 second
  },

  // API response optimization
  API: {
    RESPONSE_TIMEOUT: 30000,    // 30 seconds
    CACHE_CONTROL_MAX_AGE: 300, // 5 minutes
    STALE_WHILE_REVALIDATE: 60, // 1 minute
  },

  // Rate limiting
  RATE_LIMITING: {
    WINDOW_MS: 60000,          // 1 minute
    MAX_REQUESTS: 100,         // per window
    SKIP_SUCCESSFUL_REQUESTS: false,
    SKIP_FAILED_REQUESTS: false,
  },

  // Performance monitoring
  MONITORING: {
    METRICS_RETENTION_MS: 86400000, // 24 hours
    MAX_METRICS_IN_MEMORY: 1000,
    SLOW_REQUEST_THRESHOLD: 2000,   // 2 seconds
    ERROR_RATE_THRESHOLD: 5,        // 5%
  },
} as const;

export const LAZY_LOADING_CONFIG = {
  // Intersection Observer thresholds
  INTERSECTION_THRESHOLD: 200, // pixels from bottom
  
  // Loading states
  LOADING_SKELETON_COUNT: 3,
  
  // Batch sizes for different content types
  BATCH_SIZES: {
    chapters: 5,
    characters: 10,
    plotThreads: 8,
    worldElements: 12,
    timelineEvents: 15,
  },
} as const;

export const ASSET_OPTIMIZATION_CONFIG = {
  // Image optimization
  IMAGES: {
    FORMATS: ['image/webp', 'image/avif'],
    DEVICE_SIZES: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    IMAGE_SIZES: [16, 32, 48, 64, 96, 128, 256, 384],
    CACHE_TTL: 2592000, // 30 days
  },

  // Static asset caching
  STATIC_ASSETS: {
    CACHE_TTL: 31536000, // 1 year
    IMMUTABLE_PATTERNS: [
      '/_next/static/',
      '/_next/image',
      '/static/',
    ],
  },
} as const;

/**
 * Get cache TTL for a specific data type
 */
export function getCacheTTL(type: keyof typeof CACHE_CONFIG.TTL_BY_TYPE): number {
  return CACHE_CONFIG.TTL_BY_TYPE[type] || CACHE_CONFIG.DEFAULT_TTL;
}

/**
 * Get pagination limits for a specific resource
 */
export function getPaginationLimits(resource: keyof typeof PAGINATION_CONFIG.LIMITS) {
  return PAGINATION_CONFIG.LIMITS[resource] || {
    default: PAGINATION_CONFIG.DEFAULT_LIMIT,
    max: PAGINATION_CONFIG.MAX_LIMIT,
  };
}

/**
 * Get batch size for lazy loading
 */
export function getBatchSize(contentType: keyof typeof LAZY_LOADING_CONFIG.BATCH_SIZES): number {
  return LAZY_LOADING_CONFIG.BATCH_SIZES[contentType] || 10;
}

/**
 * Check if a request should be cached based on performance rules
 */
export function shouldCacheRequest(
  method: string,
  statusCode: number,
  responseTime: number
): boolean {
  // Only cache GET requests
  if (method !== 'GET') return false;
  
  // Only cache successful responses
  if (statusCode >= 400) return false;
  
  // Don't cache very slow responses (they might be one-off issues)
  if (responseTime > PERFORMANCE_CONFIG.MONITORING.SLOW_REQUEST_THRESHOLD) return false;
  
  return true;
}

/**
 * Get cache headers for static assets
 */
export function getStaticAssetHeaders(path: string): Record<string, string> {
  const isImmutable = ASSET_OPTIMIZATION_CONFIG.STATIC_ASSETS.IMMUTABLE_PATTERNS.some(
    pattern => path.includes(pattern)
  );
  
  if (isImmutable) {
    return {
      'Cache-Control': `public, max-age=${ASSET_OPTIMIZATION_CONFIG.STATIC_ASSETS.CACHE_TTL}, immutable`,
    };
  }
  
  return {
    'Cache-Control': `public, max-age=${PERFORMANCE_CONFIG.API.CACHE_CONTROL_MAX_AGE}, stale-while-revalidate=${PERFORMANCE_CONFIG.API.STALE_WHILE_REVALIDATE}`,
  };
}