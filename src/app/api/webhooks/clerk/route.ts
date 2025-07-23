import { NextRequest, NextResponse } from 'next/server'
import { verifyWebhook } from '@clerk/nextjs/webhooks'
import { WebhookService } from '@/lib/services/webhook'

/**
 * POST /api/webhooks/clerk
 * Handles incoming Clerk webhook events
 * Verifies webhook signature and processes user events
 */
export async function POST(req: NextRequest) {
  try {
    // Verify the webhook signature
    const evt = await verifyWebhook(req)

    // Log the webhook event for debugging
    console.log(`Received webhook with ID ${evt.data.id} and type ${evt.type}`)

    // Process the webhook event
    await WebhookService.processWebhookEvent(evt)

    return NextResponse.json(
      { message: 'Webhook processed successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error processing webhook:', error)

    // Return appropriate error response
    if (error instanceof Error && error.message.includes('verification')) {
      return NextResponse.json(
        { error: 'Webhook verification failed' },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/webhooks/clerk
 * Health check endpoint for webhook configuration
 */
export async function GET() {
  return NextResponse.json({
    message: 'Clerk webhook endpoint is active',
    timestamp: new Date().toISOString(),
  })
}
