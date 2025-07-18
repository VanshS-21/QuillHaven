import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { withErrorHandler } from '@/lib/errorHandler';

interface ClientErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  errorId?: string;
  timestamp: string;
  userAgent: string;
  url: string;
  userId?: string;
  additionalContext?: Record<string, unknown>;
}

async function POST(req: NextRequest) {
  try {
    const errorReport: ClientErrorReport = await req.json();

    // Validate required fields
    if (!errorReport.message || !errorReport.timestamp) {
      return NextResponse.json(
        { error: 'Missing required fields: message, timestamp' },
        { status: 400 }
      );
    }

    // Get client information
    const clientIP =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';

    // Log the client-side error
    logger.error('Client-side error reported', {
      errorId: errorReport.errorId,
      message: errorReport.message,
      stack: errorReport.stack,
      componentStack: errorReport.componentStack,
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      userId: errorReport.userId,
      clientIP,
      timestamp: errorReport.timestamp,
      additionalContext: errorReport.additionalContext,
      source: 'client',
    });

    // In production, you might want to:
    // 1. Send to external error tracking service (Sentry, Bugsnag, etc.)
    // 2. Store in database for analysis
    // 3. Alert on critical errors
    // 4. Rate limit error reports per client

    return NextResponse.json(
      {
        success: true,
        message: 'Error report received',
        errorId: errorReport.errorId,
      },
      { status: 200 }
    );
  } catch (error) {
    logger.error('Failed to process error report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return NextResponse.json(
      { error: 'Failed to process error report' },
      { status: 500 }
    );
  }
}

const wrappedPOST = withErrorHandler(POST);
export { wrappedPOST as POST };
