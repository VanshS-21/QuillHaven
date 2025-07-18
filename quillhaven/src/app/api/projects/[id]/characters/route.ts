import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createCharacter,
  getProjectCharacters,
  type CreateCharacterData,
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

    // Get project characters
    const characters = await getProjectCharacters(projectId);

    return NextResponse.json({
      success: true,
      data: characters,
    });
  } catch (error) {
    console.error('Error getting project characters:', error);
    return NextResponse.json(
      { error: 'Failed to get project characters' },
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
    const characterData: CreateCharacterData = {
      name: body.name,
      description: body.description,
      role: body.role,
      developmentArc: body.developmentArc,
      firstAppearance: body.firstAppearance,
    };

    // Validate required fields
    if (!characterData.name || characterData.name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Character name is required' },
        { status: 400 }
      );
    }

    // Create character
    const character = await createCharacter(projectId, characterData);

    return NextResponse.json(
      {
        success: true,
        data: character,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating character:', error);
    return NextResponse.json(
      { error: 'Failed to create character' },
      { status: 500 }
    );
  }
}
