import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { redis } from '@/lib/redis';
import { logger } from '@/lib/logger';

interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  service: string;
  version: string;
  uptime: number;
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    disk?: HealthCheck;
  };
  environment: string;
}

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime?: number;
  message?: string;
  details?: Record<string, unknown>;
}

const startTime = Date.now();

export async function GET() {
  const timestamp = new Date().toISOString();
  const uptime = Date.now() - startTime;

  try {
    // Perform health checks
    const [databaseCheck, redisCheck, memoryCheck] = await Promise.allSettled([
      checkDatabase(),
      checkRedis(),
      checkMemory(),
    ]);

    const checks = {
      database: getCheckResult(databaseCheck),
      redis: getCheckResult(redisCheck),
      memory: getCheckResult(memoryCheck),
    };

    // Determine overall status
    const overallStatus = determineOverallStatus(checks);

    const healthResult: HealthCheckResult = {
      status: overallStatus,
      timestamp,
      service: 'QuillHaven API',
      version: process.env.APP_VERSION || '1.0.0',
      uptime,
      checks,
      environment: process.env.NODE_ENV || 'development',
    };

    // Log health check
    logger.info('Health check performed', {
      status: overallStatus,
      uptime,
      checks: Object.entries(checks).map(([name, check]) => ({
        name,
        status: check.status,
        responseTime: check.responseTime,
      })),
    });

    const statusCode =
      overallStatus === 'healthy'
        ? 200
        : overallStatus === 'degraded'
          ? 200
          : 503;

    return NextResponse.json(healthResult, { status: statusCode });
  } catch (error) {
    logger.error('Health check failed', {
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
        error: 'Health check failed',
        environment: process.env.NODE_ENV || 'development',
      },
      { status: 503 }
    );
  }
}

async function checkDatabase(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Simple query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;

    const responseTime = Date.now() - startTime;

    return {
      status: responseTime < 1000 ? 'healthy' : 'degraded',
      responseTime,
      message:
        responseTime < 1000 ? 'Database is responsive' : 'Database is slow',
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: 'Database connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function checkRedis(): Promise<HealthCheck> {
  const startTime = Date.now();

  try {
    // Test Redis connectivity with a simple ping
    const result = await redis.ping();
    const responseTime = Date.now() - startTime;

    if (result === 'PONG') {
      return {
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        message: responseTime < 500 ? 'Redis is responsive' : 'Redis is slow',
      };
    } else {
      return {
        status: 'unhealthy',
        responseTime,
        message: 'Redis ping failed',
        details: { result },
      };
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      message: 'Redis connection failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

async function checkMemory(): Promise<HealthCheck> {
  try {
    const memoryUsage = process.memoryUsage();
    const totalMemory = memoryUsage.heapTotal;
    const usedMemory = memoryUsage.heapUsed;
    const memoryUsagePercent = (usedMemory / totalMemory) * 100;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    let message: string;

    if (memoryUsagePercent < 70) {
      status = 'healthy';
      message = 'Memory usage is normal';
    } else if (memoryUsagePercent < 90) {
      status = 'degraded';
      message = 'Memory usage is high';
    } else {
      status = 'unhealthy';
      message = 'Memory usage is critical';
    }

    return {
      status,
      message,
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        usagePercent: Math.round(memoryUsagePercent),
      },
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: 'Memory check failed',
      details: {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

function getCheckResult(
  settledResult: PromiseSettledResult<HealthCheck>
): HealthCheck {
  if (settledResult.status === 'fulfilled') {
    return settledResult.value;
  } else {
    return {
      status: 'unhealthy',
      message: 'Health check failed',
      details: {
        error:
          settledResult.reason instanceof Error
            ? settledResult.reason.message
            : 'Unknown error',
      },
    };
  }
}

function determineOverallStatus(
  checks: Record<string, HealthCheck>
): 'healthy' | 'degraded' | 'unhealthy' {
  const statuses = Object.values(checks).map((check) => check.status);

  if (statuses.includes('unhealthy')) {
    return 'unhealthy';
  } else if (statuses.includes('degraded')) {
    return 'degraded';
  } else {
    return 'healthy';
  }
}
