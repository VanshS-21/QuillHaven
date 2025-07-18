import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createWorldElement,
  getProjectWorldElements,
  type CreateWorldElementData,
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

    // Get project world elements
    const worldElements = await getProjectWorldElements(projectId);

    return NextResponse.json({
      success: true,
      data: worldElements,
    });
  } catch (error) {
    console.error('Error getting project world elements:', error);
    return NextResponse.json(
      { error: 'Failed to get project world elements' },
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
    const worldElementData: CreateWorldElementData = {
      type: body.type,
      name: body.name,
      description: body.description,
      significance: body.significance,
      relatedElementIds: body.relatedElementIds,
    };

    // Validate required fields
    if (!worldElementData.name || worldElementData.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'World element name is required' },
        { status: 400 }
      );
    }

    if (!worldElementData.type) {
      return NextResponse.json(
        { error: 'World element type is required' },
        { status: 400 }
      );
    }

    // Create world element
    const worldElement = await createWorldElement(projectId, worldElementData);

    return NextResponse.json(
      {
        success: true,
        data: worldElement,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating world element:', error);
    return NextResponse.json(
      { error: 'Failed to create world element' },
      { status: 500 }
    );
  }
}
