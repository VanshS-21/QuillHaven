import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createPlotThread,
  getProjectPlotThreads,
  type CreatePlotThreadData,
} from '@/services/contextService';
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

    // Get project plot threads
    const plotThreads = await getProjectPlotThreads(projectId);

    return NextResponse.json({
      success: true,
      data: plotThreads,
    });
  } catch (error) {
    console.error('Error getting project plot threads:', error);
    return NextResponse.json(
      { error: 'Failed to get project plot threads' },
      { status: 500 }
    );
  }
}

export async function POST(
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

    // Parse request body
    const body = await request.json();
    const plotThreadData: CreatePlotThreadData = {
      title: body.title,
      description: body.description,
      status: body.status,
      relatedCharacterIds: body.relatedCharacterIds,
    };

    // Validate required fields
    if (!plotThreadData.title || plotThreadData.title.trim().length === 0) {
      return NextResponse.json(
        { error: 'Plot thread title is required' },
        { status: 400 }
      );
    }

    // Create plot thread
    const plotThread = await createPlotThread(projectId, plotThreadData);

    return NextResponse.json(
      {
        success: true,
        data: plotThread,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating plot thread:', error);
    return NextResponse.json(
      { error: 'Failed to create plot thread' },
      { status: 500 }
    );
  }
}
