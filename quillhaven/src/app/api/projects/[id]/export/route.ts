import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import { ExportRequest } from '@/types/export';
import { z } from 'zod';
import { initializeServices } from '@/lib/startup';
import { withErrorHandler, ValidationError, AuthenticationError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

// Initialize services on first API call
initializeServices();

const exportRequestSchema = z.object({
  format: z.enum(['DOCX', 'PDF', 'TXT', 'EPUB']),
  chapterIds: z.array(z.string()).optional(),
  includeMetadata: z.boolean().optional().default(true),
  metadata: z
    .object({
      title: z.string().optional(),
      author: z.string().optional(),
      description: z.string().optional(),
      genre: z.string().optional(),
      language: z.string().optional(),
      publishDate: z
        .string()
        .transform((str) => new Date(str))
        .optional(),
      version: z.string().optional(),
    })
    .optional(),
});

async function handleExportCreation(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Verify authentication
  const authResult = await verifyAuth(request);
  if (!authResult.success || !authResult.user) {
    throw new AuthenticationError();
  }

  const { id: projectId } = await params;
  const body = await request.json();

  // Validate request body
  let validationResult;
  try {
    validationResult = exportRequestSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid export request data', error.issues);
    }
    throw error;
  }

  const exportRequest: ExportRequest = {
    projectId,
    ...validationResult,
  };

  logger.info('Export requested', {
    userId: authResult.user.id,
    projectId,
    format: exportRequest.format,
    chapterCount: exportRequest.chapterIds?.length || 'all',
    includeMetadata: exportRequest.includeMetadata,
  });

  // Create export with performance monitoring
  const result = await PerformanceLogger.measureAsync(
    'create_export',
    async () => {
      try {
        return await exportService.createExport(exportRequest, authResult.user!.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    {
      userId: authResult.user.id,
      projectId,
      format: exportRequest.format,
    }
  );

  if (!result.success) {
    throw new ValidationError(result.error || 'Export creation failed');
  }

  // Log business event
  BusinessLogger.logExport(
    authResult.user.id,
    projectId,
    exportRequest.format,
    exportRequest.chapterIds?.length || 0,
    0, // Word count would be calculated in the service
    true
  );

  logger.info('Export created successfully', {
    userId: authResult.user.id,
    projectId,
    exportId: result.exportId,
    format: exportRequest.format,
  });

  return NextResponse.json({
    success: true,
    exportId: result.exportId,
  });
}

export const POST = withErrorHandler(handleExportCreation);
