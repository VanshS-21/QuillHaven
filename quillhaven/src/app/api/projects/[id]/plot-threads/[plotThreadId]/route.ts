import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getPlotThread,
  updatePlotThread,
  deletePlotThread,
  type UpdatePlotThreadData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  try {
    const { id: projectId, plotThreadId } = await params;

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

    // Get plot thread
    const plotThread = await getPlotThread(plotThreadId, projectId);
    if (!plotThread) {
      return NextResponse.json(
        { error: 'Plot thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plotThread,
    });
  } catch (error) {
    console.error('Error getting plot thread:', error);
    return NextResponse.json(
      { error: 'Failed to get plot thread' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  try {
    const { id: projectId, plotThreadId } = await params;

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

    // Parse request body
    const body = await request.json();
    const updateData: UpdatePlotThreadData = {
      title: body.title,
      description: body.description,
      status: body.status,
      relatedCharacterIds: body.relatedCharacterIds,
    };

    // Update plot thread
    const plotThread = await updatePlotThread(
      plotThreadId,
      projectId,
      updateData
    );
    if (!plotThread) {
      return NextResponse.json(
        { error: 'Plot thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: plotThread,
    });
  } catch (error) {
    console.error('Error updating plot thread:', error);
    return NextResponse.json(
      { error: 'Failed to update plot thread' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; plotThreadId: string }> }
) {
  try {
    const { id: projectId, plotThreadId } = await params;

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

    // Delete plot thread
    const success = await deletePlotThread(plotThreadId, projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'Plot thread not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Plot thread deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting plot thread:', error);
    return NextResponse.json(
      { error: 'Failed to delete plot thread' },
      { status: 500 }
    );
  }
}
