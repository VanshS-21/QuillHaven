import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/middleware';

interface DetailedHealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  environment: string;
  system: {
    nodeVersion: string;
    platform: string;
    arch: string;
    memory: {
      heapUsed: number;
      heapTotal: number;
      external: number;
      rss: number;
      usagePercent: number;
    };
    cpu: {
      loadAverage: number[];
    };
  };
  database: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    connectionCount?: number;
    statistics?: {
      totalUsers: number;
      totalProjects: number;
      totalChapters: number;
    };
  };
  redis: {
    status: 'healthy' | 'degraded' | 'unhealthy';
    responseTime: number;
    memory?: {
      used: number;
      peak: number;
    };
    keyCount?: number;
  };
  externalServices: {
    geminiAI: {
      status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
      lastCheck?: string;
      responseTime?: number;
    };
  };
}

const startTime = Date.now();

async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Date.now() - startTime;

  try {
    // Perform detailed health checks
    const [databaseResult, redisResult, geminiResult] = await Promise.allSettled([
      checkDatabaseDetailed(),
      checkRedisDetailed(),
      checkGeminiAI(),
    ]);

    const system = getSystemInfo();
    const database = getSettledResult(databaseResult, {
      status: 'unhealthy' as const,
      responseTime: 0,
      error: 'Database connection failed',
    });
    const redisCheck = getSettledResult(redisResult, {
      status: 'unhealthy' as const,
      responseTime: 0,
      error: 'Redis connection failed',
    });
    const geminiAI = getSettledResult(geminiResult, {
      status: 'unhealthy' as const,
      lastCheck: new Date().toISOString(),
      responseTime: 0,
      error: 'Gemini AI service unavailable',
    });

    // Determine overall status
    const overallStatus = determineDetailedStatus(database, redisCheck, geminiAI);

    const healthResult: DetailedHealthCheck = {
      status: overallStatus,
      timestamp,
      service: 'QuillHaven API',
      version: process.env.APP_VERSION || '1.0.0',
      uptime,
      environment: process.env.NODE_ENV || 'development',
      system,
      database,
      redis: redisCheck,
      externalServices: {
        geminiAI,
      },
    };

    logger.info('Detailed health check performed', {
      status: overallStatus,
      uptime,
      databaseStatus: database.status,
      redisStatus: redisCheck.status,
      geminiStatus: geminiAI.status,
    });

    const statusCode = overallStatus === 'healthy' ? 200 : 
                      overallStatus === 'degraded' ? 200 : 503;

    return NextResponse.json(healthResult, { status: statusCode });
  } catch (error) {
    logger.error('Detailed health check failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp,
        service: 'QuillHaven API',
        version: process.env.APP_VERSION || '1.0.0',
        uptime,
        error: 'Detailed health check failed',
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 503 }
    );
  }
}

function getSystemInfo() {
  const memoryUsage = process.memoryUsage();
  const totalMemory = memoryUsage.heapTotal;
  const usedMemory = memoryUsage.heapUsed;
  const memoryUsagePercent = (usedMemory / totalMemory) * 100;

  return {
    nodeVersion: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
      external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
      usagePercent: Math.round(memoryUsagePercent),
    },
    cpu: {
      loadAverage: process.platform !== 'win32' ? require('os').loadavg() : [0, 0, 0],
    },
  };
}

async function checkDatabaseDetailed() {
  const startTime = Date.now();
  
  try {
    // Check basic connectivity
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - startTime;

    // Get database statistics
    const [userCount, projectCount, chapterCount] = await Promise.all([
      prisma.user.count(),
      prisma.project.count(),
      prisma.chapter.count(),
    ]);

    return {
      status: responseTime < 1000 ? 'healthy' as const : 'degraded' as const,
      responseTime,
      statistics: {
        totalUsers: userCount,
        totalProjects: projectCount,
        totalChapters: chapterCount,
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkRedisDetailed() {
  const startTime = Date.now();
  
  try {
    // Test Redis connectivity
    const result = await redis.ping();
    const responseTime = Date.now() - startTime;
    
    if (result !== 'PONG') {
      return {
        status: 'unhealthy' as const,
        responseTime,
        error: 'Redis ping failed',
      };
    }

    // Get Redis info
    const info = await redis.info('memory');
    const keyCount = await redis.dbsize();
    
    // Parse memory info
    const memoryLines = info.split('\r\n');
    const usedMemory = memoryLines
      .find(line => line.startsWith('used_memory:'))
      ?.split(':')[1];
    const peakMemory = memoryLines
      .find(line => line.startsWith('used_memory_peak:'))
      ?.split(':')[1];

    return {
      status: responseTime < 500 ? 'healthy' as const : 'degraded' as const,
      responseTime,
      memory: {
        used: usedMemory ? Math.round(parseInt(usedMemory) / 1024 / 1024) : 0, // MB
        peak: peakMemory ? Math.round(parseInt(peakMemory) / 1024 / 1024) : 0, // MB
      },
      keyCount,
    };
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

async function checkGeminiAI() {
  const startTime = Date.now();
  
  try {
    // Simple test to check if Gemini API is accessible
    // We'll make a minimal request to test connectivity
    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
      method: 'GET',
      headers: {
        'x-goog-api-key': process.env.GEMINI_API_KEY || '',
      },
    });

    const responseTime = Date.now() - startTime;

    if (response.ok) {
      return {
        status: responseTime < 2000 ? 'healthy' as const : 'degraded' as const,
        lastCheck: new Date().toISOString(),
        responseTime,
      };
    } else {
      return {
        status: 'unhealthy' as const,
        lastCheck: new Date().toISOString(),
        responseTime,
        error: `HTTP ${response.status}`,
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy' as const,
      lastCheck: new Date().toISOString(),
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function getSettledResult<T>(
  settledResult: PromiseSettledResult<T>,
  fallback: T
): T {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return fallback;
  }
}

function determineDetailedStatus(
  database: any,
  redis: any,
  gemini: any
): 'healthy' | 'degraded' | 'unhealthy' {
  // Critical services: database and redis
  if (database.status === 'unhealthy' || redis.status === 'unhealthy') {
    return 'unhealthy';
  }

  // If critical services are degraded or external service is unhealthy
  if (database.status === 'degraded' || redis.status === 'degraded' || gemini.status === 'unhealthy') {
    return 'degraded';
  }

  return 'healthy';
}

// Only allow authenticated admin users to access detailed health info
const authenticatedGET = withAuth(GET);
export { authenticatedGET as GET };