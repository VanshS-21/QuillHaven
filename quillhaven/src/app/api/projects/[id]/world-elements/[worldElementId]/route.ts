import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getWorldElement,
  updateWorldElement,
  deleteWorldElement,
  type UpdateWorldElementData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  try {
    const { id: projectId, worldElementId } = await params;

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

    // Get world element
    const worldElement = await getWorldElement(worldElementId, projectId);
    if (!worldElement) {
      return NextResponse.json(
        { error: 'World element not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: worldElement,
    });
  } catch (error) {
    console.error('Error getting world element:', error);
    return NextResponse.json(
      { error: 'Failed to get world element' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  try {
    const { id: projectId, worldElementId } = await params;

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
    const updateData: UpdateWorldElementData = {
      type: body.type,
      name: body.name,
      description: body.description,
      significance: body.significance,
      relatedElementIds: body.relatedElementIds,
    };

    // Update world element
    const worldElement = await updateWorldElement(
      worldElementId,
      projectId,
      updateData
    );
    if (!worldElement) {
      return NextResponse.json(
        { error: 'World element not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: worldElement,
    });
  } catch (error) {
    console.error('Error updating world element:', error);
    return NextResponse.json(
      { error: 'Failed to update world element' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; worldElementId: string }> }
) {
  try {
    const { id: projectId, worldElementId } = await params;

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

    // Delete world element
    const success = await deleteWorldElement(worldElementId, projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'World element not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'World element deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting world element:', error);
    return NextResponse.json(
      { error: 'Failed to delete world element' },
      { status: 500 }
    );
  }
}
