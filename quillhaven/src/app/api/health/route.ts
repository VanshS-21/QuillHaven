import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    const healthStatus = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'not_configured', // Will be updated when Prisma is added
        redis: 'not_configured', // Will be updated when Redis client is added
        ai: 'not_configured', // Will be updated when Gemini is configured
      },
    };

    return NextResponse.json(healthStatus, { status: 200 });
  } catch {
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      },
      { status: 500 }
    );
  }
}
