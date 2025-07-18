import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import { ExportRequest } from '@/types/export';
import { z } from 'zod';
import { initializeServices } from '@/lib/startup';

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: projectId } = await params;
    const body = await request.json();

    // Validate request body
    const validationResult = exportRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.issues,
        },
        { status: 400 }
      );
    }

    const exportRequest: ExportRequest = {
      projectId,
      ...validationResult.data,
    };

    // Create export
    const result = await exportService.createExport(
      exportRequest,
      authResult.user.id
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      exportId: result.exportId,
    });
  } catch (error) {
    console.error('Export creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
