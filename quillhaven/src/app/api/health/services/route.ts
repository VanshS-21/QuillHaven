import { NextResponse } from 'next/server';
import { gracefulDegradation } from '@/lib/gracefulDegradation';
import { logger } from '@/lib/logger';
import { withAuth } from '@/lib/middleware';

async function GET() {
  try {
    const serviceStatuses = gracefulDegradation.getAllServiceStatuses();

    logger.info('Service status check requested', {
      services: Object.keys(serviceStatuses),
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      services: serviceStatuses,
    });
  } catch (error) {
    logger.error('Failed to get service statuses', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to retrieve service statuses' },
      { status: 500 }
    );
  }
}

async function POST(req: Request) {
  try {
    const { serviceName, action } = await req.json();

    if (!serviceName || !action) {
      return NextResponse.json(
        { error: 'Missing serviceName or action' },
        { status: 400 }
      );
    }

    if (action === 'force-available') {
      gracefulDegradation.forceServiceAvailable(serviceName);

      logger.info('Service manually marked as available', {
        serviceName,
        action: 'force-available',
      });

      return NextResponse.json({
        success: true,
        message: `Service ${serviceName} marked as available`,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    logger.error('Failed to update service status', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    return NextResponse.json(
      { error: 'Failed to update service status' },
      { status: 500 }
    );
  }
}

// Protect these endpoints with authentication
const authenticatedGET = withAuth(GET);
const authenticatedPOST = withAuth(POST);
export { authenticatedGET as GET, authenticatedPOST as POST };
