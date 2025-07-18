/**
 * User Data Export API - GDPR Article 20 Compliance
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { DataPrivacyService } from '@/services/dataPrivacyService';
import { validateString } from '@/utils/validation/input';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, SecurityLogger } from '@/lib/logger';

interface ExportRequestData {
  format: 'json' | 'zip';
  includeProjects?: boolean;
  includeChapters?: boolean;
  includeContext?: boolean;
  includeMetadata?: boolean;
}

async function handleDataExport(req: NextRequest) {
  const user = (req as AuthenticatedRequest).user;
  const clientIP =
    req.headers.get('x-forwarded-for') ||
    req.headers.get('x-real-ip') ||
    'unknown';

  if (!user) {
    throw new AuthenticationError();
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
    throw new ValidationError('Invalid format. Must be "json" or "zip"');
  }

  const format = (formatValidation.sanitizedData as string) || 'json';

  // Log security event for data export request
  SecurityLogger.logDataAccess('user_data_export', 'export', user.id, true);

  logger.info('Data export requested', {
    userId: user.id,
    format,
    clientIP,
    includeProjects: requestData.includeProjects !== false,
    includeChapters: requestData.includeChapters !== false,
    includeContext: requestData.includeContext !== false,
    includeMetadata: requestData.includeMetadata !== false,
  });

  // Create data privacy service instance
  const dataPrivacyService = new DataPrivacyService(user.id);

  // Export user data with performance monitoring
  const exportBuffer = await PerformanceLogger.measureAsync(
    'user_data_export',
    async () => {
      try {
        return await dataPrivacyService.exportUserData(user.id, {
          format: format as 'json' | 'zip',
          includeProjects: requestData.includeProjects !== false,
          includeChapters: requestData.includeChapters !== false,
          includeContext: requestData.includeContext !== false,
          includeMetadata: requestData.includeMetadata !== false,
        });
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, format }
  );

  // Set appropriate headers
  const timestamp = new Date().toISOString().split('T')[0];
  const filename = `quillhaven-data-export-${timestamp}.${format}`;

  const headers = new Headers();
  headers.set(
    'Content-Type',
    format === 'zip' ? 'application/zip' : 'application/json'
  );
  headers.set('Content-Disposition', `attachment; filename="${filename}"`);
  headers.set('Content-Length', exportBuffer.length.toString());

  logger.info('Data export completed successfully', {
    userId: user.id,
    format,
    exportSize: exportBuffer.length,
    filename,
  });

  return new NextResponse(exportBuffer, {
    status: 200,
    headers,
  });
}

// Apply middleware with error handling and stricter rate limiting for data export
const handler = withErrorHandler(
  withAuth(
    withRateLimit({
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3, // Only 3 exports per hour
      message: 'Too many export requests. Please try again later.',
    })(handleDataExport)
  )
);

export { handler as POST };
