import { NextResponse } from 'next/server'

export async function GET() {
  try {
    // Check environment variables
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'DATABASE_URL',
    ]

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar]
    )

    if (missingEnvVars.length > 0) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Missing required environment variables',
          details: {
            missingEnvVars,
          },
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      )
    }

    // Check database connectivity (only in runtime, not during build)
    let databaseStatus = 'unknown'
    if (
      process.env.NODE_ENV !== 'production' ||
      process.env.RUNTIME_CHECK === 'true'
    ) {
      try {
        const { prisma } = await import('@/lib/prisma')
        await prisma.$queryRaw`SELECT 1`
        databaseStatus = 'connected'
      } catch (dbError) {
        databaseStatus = 'disconnected'
        console.warn('Database health check failed:', dbError)
      }
    } else {
      databaseStatus = 'skipped-during-build'
    }

    // All checks passed
    return NextResponse.json({
      status: databaseStatus === 'disconnected' ? 'degraded' : 'healthy',
      message:
        databaseStatus === 'disconnected'
          ? 'Database connectivity issues'
          : 'All systems operational',
      details: {
        database: databaseStatus,
        environment: process.env.ENVIRONMENT || 'development',
        timestamp: new Date().toISOString(),
        version: process.env.npm_package_version || '0.1.0',
      },
    })
  } catch (error) {
    console.error('Health check failed:', error)

    return NextResponse.json(
      {
        status: 'unhealthy',
        message: 'Health check failed',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      },
      { status: 500 }
    )
  }
}
