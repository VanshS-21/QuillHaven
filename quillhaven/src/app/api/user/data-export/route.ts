/**
 * User Data Export API - GDPR Article 20 Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, withRateLimit } from '@/lib/middleware';
import { DataPrivacyService } from '@/services/dataPrivacyService';
import { validateString } from '@/utils/validation/input';

interface ExportRequestData {
  format: 'json' | 'zip';
  includeProjects?: boolean;
  includeChapters?: boolean;
  includeContext?: boolean;
  includeMetadata?: boolean;
}

async function handleDataExport(req: NextRequest) {
  try {
    const user = (req as any).user;
    
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Parse request body
    let requestData: ExportRequestData;
    try {
      requestData = await req.json();
    } catch {
      requestData = { format: 'json' };
    }

    // Validate format
    const formatValidation = validateString(requestData.format, 'format', {
      required: false,
      pattern: /^(json|zip)$/,
    });

    if (!formatValidation.isValid) {
      return NextResponse.json(
        { error: 'Invalid format. Must be "json" or "zip"' },
        { status: 400 }
      );
    }

    const format = (formatValidation.sanitizedData as string) || 'json';

    // Create data privacy service instance
    const dataPrivacyService = new DataPrivacyService(user.id);

    // Export user data
    const exportBuffer = await dataPrivacyService.exportUserData(user.id, {
      format: format as 'json' | 'zip',
      includeProjects: requestData.includeProjects !== false,
      includeChapters: requestData.includeChapters !== false,
      includeContext: requestData.includeContext !== false,
      includeMetadata: requestData.includeMetadata !== false,
    });

    // Set appropriate headers
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `quillhaven-data-export-${timestamp}.${format}`;
    
    const headers = new Headers();
    headers.set('Content-Type', format === 'zip' ? 'application/zip' : 'application/json');
    headers.set('Content-Disposition', `attachment; filename="${filename}"`);
    headers.set('Content-Length', exportBuffer.length.toString());

    return new NextResponse(exportBuffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Data export error:', error);
    return NextResponse.json(
      { error: 'Failed to export data. Please try again later.' },
      { status: 500 }
    );
  }
}

// Apply middleware with stricter rate limiting for data export
const handler = withAuth(
  withRateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3, // Only 3 exports per hour
    message: 'Too many export requests. Please try again later.',
  })(handleDataExport)
);

export { handler as POST };