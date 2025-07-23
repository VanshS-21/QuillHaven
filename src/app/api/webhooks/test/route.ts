import { NextResponse } from 'next/server'

/**
 * POST /api/webhooks/test
 * Test endpoint for webhook functionality
 */
export async function POST() {
  return NextResponse.json({
    message: 'Test webhook endpoint is working',
    timestamp: new Date().toISOString(),
  })
}

/**
 * GET /api/webhooks/test
 * Health check for test webhook endpoint
 */
export async function GET() {
  return NextResponse.json({
    message: 'Test webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
