import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { ExportRequest } from '@/types/export';
import { z } from 'zod';
import { initializeServices } from '@/lib/startup';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  handleDatabaseError,
} from '@/lib/errorHandler';
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
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

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
    userId: user.id,
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
        return await exportService.createExport(exportRequest, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    {
      userId: user.id,
      projectId,
      format: exportRequest.format,
    }
  );

  if (!result.success) {
    throw new ValidationError(result.error || 'Export creation failed');
  }

  // Log business event
  BusinessLogger.logExport(
    user.id,
    projectId,
    exportRequest.format,
    exportRequest.chapterIds?.length || 0,
    0, // Word count would be calculated in the service
    true
  );

  logger.info('Export created successfully', {
    userId: user.id,
    projectId,
    exportId: result.exportId,
    format: exportRequest.format,
  });

  return NextResponse.json({
    success: true,
    exportId: result.exportId,
  });
}

// Apply middleware with error handling and rate limiting
export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 export requests per minute (exports are resource intensive)
  })(withAuth(handleExportCreation))
);
