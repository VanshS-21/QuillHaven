import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  getCharacter,
  updateCharacter,
  deleteCharacter,
  type UpdateCharacterData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id: projectId, characterId } = await params;

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

    // Get character
    const character = await getCharacter(characterId, projectId);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: character,
    });
  } catch (error) {
    console.error('Error getting character:', error);
    return NextResponse.json(
      { error: 'Failed to get character' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id: projectId, characterId } = await params;

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
    const updateData: UpdateCharacterData = {
      name: body.name,
      description: body.description,
      role: body.role,
      developmentArc: body.developmentArc,
      firstAppearance: body.firstAppearance,
    };

    // Update character
    const character = await updateCharacter(characterId, projectId, updateData);
    if (!character) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: character,
    });
  } catch (error) {
    console.error('Error updating character:', error);
    return NextResponse.json(
      { error: 'Failed to update character' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; characterId: string }> }
) {
  try {
    const { id: projectId, characterId } = await params;

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

    // Delete character
    const success = await deleteCharacter(characterId, projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'Character not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Character deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting character:', error);
    return NextResponse.json(
      { error: 'Failed to delete character' },
      { status: 500 }
    );
  }
}
