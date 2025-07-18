import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import { withErrorHandler, AuthenticationError, NotFoundError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, SecurityLogger, BusinessLogger } from '@/lib/logger';

async function handleGetExportStatus(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const clientIP = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown';

  // Verify authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError();
  }

  const { id: exportId } = await params;

  // Get export status with performance monitoring
  const exportJob = await PerformanceLogger.measureAsync(
    'export_status_retrieval',
    async () => {
      try {
        return await exportService.getExportStatus(exportId, authResult.user!.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: authResult.user.id, exportId, clientIP }
  );

  if (!exportJob) {
    throw new NotFoundError('Export not found or access denied');
  }

  // Log security event for export access
  SecurityLogger.logDataAccess('export', 'status_check', authResult.user.id, true);
  
  BusinessLogger.logUserAction('export_status_checked', authResult.user.id, {
    exportId,
    status: exportJob.status,
    format: exportJob.format,
    clientIP,
    timestamp: new Date().toISOString()
  });

  logger.info('Export status retrieved', {
    userId: authResult.user.id,
    exportId,
    status: exportJob.status,
    format: exportJob.format,
    clientIP
  });

  return NextResponse.json(exportJob);
}

export const GET = withErrorHandler(handleGetExportStatus);
