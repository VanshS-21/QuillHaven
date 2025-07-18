import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';
import * as fs from 'fs';
import * as path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: exportId } = await params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    const expires = searchParams.get('expires');

    // Validate download token and expiration
    if (!token || !expires) {
      return NextResponse.json(
        { error: 'Invalid download link' },
        { status: 400 }
      );
    }

    const expirationTime = parseInt(expires);
    if (Date.now() > expirationTime) {
      return NextResponse.json(
        { error: 'Download link has expired' },
        { status: 410 }
      );
    }

    // Get export status
    const exportJob = await exportService.getExportStatus(
      exportId,
      authResult.user.id
    );

    if (!exportJob) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    if (exportJob.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Export not ready for download' },
        { status: 400 }
      );
    }

    // Construct file path
    const exportDir = path.join(process.cwd(), 'exports');
    const filePath = path.join(
      exportDir,
      `${exportId}.${exportJob.format.toLowerCase()}`
    );

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Export file not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = fs.readFileSync(filePath);

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
  } catch (error) {
    console.error('Export download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

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
