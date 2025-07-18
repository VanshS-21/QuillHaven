import { NextRequest, NextResponse } from 'next/server';
import { exportService } from '@/services/exportService';
import { verifyAuth } from '@/lib/auth';

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

    // Get export status
    const exportJob = await exportService.getExportStatus(
      exportId,
      authResult.user.id
    );

    if (!exportJob) {
      return NextResponse.json({ error: 'Export not found' }, { status: 404 });
    }

    return NextResponse.json(exportJob);
  } catch (error) {
    console.error('Export status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
