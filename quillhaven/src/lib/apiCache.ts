import { NextRequest, NextResponse } from 'next/server';
import { cacheService, CacheOptions } from '@/services/cacheService';
import crypto from 'crypto';

export interface ApiCacheOptions extends CacheOptions {
  /**
   * Cache key generator function
   */
  keyGenerator?: (req: NextRequest) => string;
  /**
   * Condition to determine if response should be cached
   */
  shouldCache?: (req: NextRequest, res: NextResponse) => boolean;
  /**
   * Custom cache invalidation tags
   */
  tags?: string[];
  /**
   * Whether to vary cache by user
   */
  varyByUser?: boolean;
  /**
   * Whether to vary cache by query parameters
   */
  varyByQuery?: boolean;
}

/**
 * Generate cache key for API request
 */
function generateCacheKey(
  req: NextRequest,
  options: ApiCacheOptions = {}
): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  const url = new URL(req.url);
  let key = `api:${url.pathname}`;

  // Add query parameters if specified
  if (options.varyByQuery && url.search) {
    const sortedParams = new URLSearchParams(url.search);
    sortedParams.sort();
    key += `:${sortedParams.toString()}`;
  }

  // Add user ID if specified
  if (options.varyByUser) {
    const userId = req.headers.get('x-user-id') || 'anonymous';
    key += `:user:${userId}`;
  }

  // Add method
  key += `:${req.method}`;

  return key;
}

/**
 * Generate ETag for response
 */
function generateETag(data: unknown): string {
  const content = JSON.stringify(data);
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Check if request has valid cache headers
 */
function hasValidCacheHeaders(req: NextRequest, etag: string): boolean {
  const ifNoneMatch = req.headers.get('if-none-match');
  return ifNoneMatch === etag;
}

/**
 * API Cache middleware for caching API responses
 */
export function withApiCache(
  handler: (req: NextRequest) => Promise<NextResponse>,
  options: ApiCacheOptions = {}
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Only cache GET requests by default
    if (req.method !== 'GET' && !options.shouldCache) {
      return handler(req);
    }

    const cacheKey = generateCacheKey(req, options);

    try {
      // Try to get cached response
      const cached = await cacheService.get<{
        data: unknown;
        status: number;
        headers: Record<string, string>;
        etag: string;
      }>(cacheKey, options);

      if (cached) {
        // Check ETag for conditional requests
        if (hasValidCacheHeaders(req, cached.etag)) {
          return new NextResponse(null, { status: 304 });
        }

        // Return cached response
        const response = NextResponse.json(cached.data, {
          status: cached.status,
          headers: {
            ...cached.headers,
            'X-Cache': 'HIT',
            ETag: cached.etag,
            'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
          },
        });

        return response;
      }

      // Execute handler
      const response = await handler(req);

      // Check if response should be cached
      const shouldCache = options.shouldCache
        ? options.shouldCache(req, response)
        : response.status === 200;

      if (shouldCache && response.status < 400) {
        // Clone response to read body
        const responseClone = response.clone();
        const data = await responseClone.json().catch(() => null);

        if (data) {
          const etag = generateETag(data);
          const headers: Record<string, string> = {};

          // Copy relevant headers
          response.headers.forEach((value, key) => {
            if (
              key.toLowerCase().startsWith('content-') ||
              key.toLowerCase() === 'vary'
            ) {
              headers[key] = value;
            }
          });

          // Cache the response
          await cacheService.set(
            cacheKey,
            {
              data,
              status: response.status,
              headers,
              etag,
            },
            options
          );

          // Add cache headers to response
          response.headers.set('X-Cache', 'MISS');
          response.headers.set('ETag', etag);
          response.headers.set(
            'Cache-Control',
            'public, max-age=300, stale-while-revalidate=60'
          );
        }
      }

      return response;
    } catch (error) {
      console.error('API Cache error:', error);
      // Fall back to executing handler without cache
      return handler(req);
    }
  };
}

/**
 * Invalidate cache by pattern
 */
export async function invalidateApiCache(pattern: string): Promise<void> {
  await cacheService.delPattern(`api:${pattern}*`);
}

/**
 * Invalidate cache by tags
 */
export async function invalidateCacheByTags(tags: string[]): Promise<void> {
  for (const tag of tags) {
    await cacheService.delPattern(`*:tag:${tag}:*`);
  }
}

/**
 * Cache warming utility
 */
export async function warmCache(
  urls: string[],
  baseUrl: string = ''
): Promise<void> {
  const promises = urls.map(async (url) => {
    try {
      const fullUrl = baseUrl + url;
      await fetch(fullUrl, {
        method: 'GET',
        headers: {
          'X-Cache-Warm': 'true',
        },
      });
    } catch (error) {
      console.error(`Failed to warm cache for ${url}:`, error);
    }
  });

  await Promise.allSettled(promises);
}

/**
 * Rate limiting with cache
 */
export async function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60000
): Promise<{
  allowed: boolean;
  remaining: number;
  resetTime: number;
}> {
  const key = `rate-limit:${identifier}`;
  const now = Date.now();

  try {
    // Get current count
    const current = (await cacheService.get<number>(key)) || 0;

    if (current >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: now + windowMs,
      };
    }

    // Increment counter
    const newCount = await cacheService.increment(key);

    // Set expiration if this is the first request in the window
    if (newCount === 1) {
      await cacheService.expire(key, Math.ceil(windowMs / 1000));
    }

    return {
      allowed: true,
      remaining: Math.max(0, limit - newCount),
      resetTime: now + windowMs,
    };
  } catch (error) {
    console.error('Rate limit check error:', error);
    // Allow request on error
    return {
      allowed: true,
      remaining: limit - 1,
      resetTime: now + windowMs,
    };
  }
}
