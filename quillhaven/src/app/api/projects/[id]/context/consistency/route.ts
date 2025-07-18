import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import { checkContextConsistency } from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;

    // Verify authentication
    const authResult = await verifyAuth(request);
    if (!authResult.success || !authResult.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify project ownership
    const hasAccess = await validateProjectOwnership(
      projectId,
      authResult.user.id
    );
    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Project not found or access denied' },
        { status: 404 }
      );
    }

    // Check context consistency
    const consistencyReport = await checkContextConsistency(projectId);

    return NextResponse.json({
      success: true,
      data: consistencyReport,
    });
  } catch (error) {
    console.error('Error checking context consistency:', error);
    return NextResponse.json(
      { error: 'Failed to check context consistency' },
      { status: 500 }
    );
  }
}
