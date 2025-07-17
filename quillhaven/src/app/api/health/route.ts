import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Test database connectivity
    let databaseStatus = 'healthy';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      console.error('Database health check failed:', error);
      databaseStatus = 'unhealthy';
    }

    // Basic health check
    const healthStatus = {
      status: databaseStatus === 'healthy' ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: databaseStatus,
        redis: 'not_configured', // Will be updated when Redis client is added
        ai: 'not_configured', // Will be updated when Gemini is configured
      },
    };

    return NextResponse.json(healthStatus, { 
      status: databaseStatus === 'healthy' ? 200 : 503 
    });
  } catch (error) {
    console.error('Health check error:', error);
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
