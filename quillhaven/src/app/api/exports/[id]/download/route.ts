import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';
import {
  withErrorHandler,
  AuthenticationError,
  ValidationError,
  NotFoundError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import {
  logger,
  PerformanceLogger,
  SecurityLogger,
  BusinessLogger,
} from '@/lib/logger';

async function handleExportDownload(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP =
    request.headers.get('x-forwarded-for') ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';

  // Verify authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError();
  }

  const { id: exportId } = await params;
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');
  const expires = searchParams.get('expires');

  // Validate download token and expiration
  if (!token || !expires) {
    throw new ValidationError('Invalid download link');
  }

  const expirationTime = parseInt(expires);
  if (isNaN(expirationTime) || Date.now() > expirationTime) {
    throw new ValidationError('Download link has expired');
  }

  // Get export status with performance monitoring
  const exportJob = await PerformanceLogger.measureAsync(
    'export_download_validation',
    async () => {
      try {
        return await exportService.getExportStatus(
          exportId,
          authResult.user!.id
        );
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: authResult.user.id, exportId, clientIP }
  );

  if (!exportJob) {
    throw new NotFoundError('Export not found or access denied');
  }

  if (exportJob.status !== 'COMPLETED') {
    throw new ValidationError('Export not ready for download');
  }

  // Construct file path
  const exportDir = path.join(process.cwd(), 'exports');
  const filePath = path.join(
    exportDir,
    `${exportId}.${exportJob.format.toLowerCase()}`
  );

  // Check if file exists and read with performance monitoring
  const fileBuffer = await PerformanceLogger.measureAsync(
    'export_file_read',
    async () => {
      if (!fs.existsSync(filePath)) {
        throw new NotFoundError('Export file not found');
      }
      return fs.readFileSync(filePath);
    },
    { exportId, filePath: filePath.substring(filePath.lastIndexOf('/') + 1) }
  );

  // Log security event for file download
  SecurityLogger.logDataAccess('export', 'download', authResult.user.id, true);

  BusinessLogger.logExport(
    authResult.user.id,
    exportJob.projectId,
    exportJob.format,
    0, // chapterCount not available in ExportJob
    0, // wordCount not available in ExportJob
    true
  );

  logger.info('Export downloaded', {
    userId: authResult.user.id,
    exportId,
    format: exportJob.format,
    filename: exportJob.filename,
    fileSize: fileBuffer.length,
    clientIP,
    userAgent,
  });

  // Set appropriate headers
  const headers = new Headers();
  headers.set('Content-Type', getContentType(exportJob.format));
  headers.set(
    'Content-Disposition',
    `attachment; filename="${exportJob.filename}"`
  );
  headers.set('Content-Length', fileBuffer.length.toString());

  return new NextResponse(fileBuffer, {
    status: 200,
    headers,
  });
}

export const GET = withErrorHandler(handleExportDownload);

function getContentType(format: string): string {
  switch (format) {
    case 'DOCX':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'PDF':
      return 'application/pdf';
    case 'TXT':
      return 'text/plain';
    case 'EPUB':
      return 'application/epub+zip';
    default:
      return 'application/octet-stream';
  }
}
