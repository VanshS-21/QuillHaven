import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createCharacterRelationship,
  type CreateRelationshipData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function POST(
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
    const relationshipData: CreateRelationshipData = {
      relatedId: body.relatedId,
      type: body.type,
      description: body.description,
    };

    // Validate required fields
    if (!relationshipData.relatedId || !relationshipData.type) {
      return NextResponse.json(
        { error: 'Related character ID and relationship type are required' },
        { status: 400 }
      );
    }

    // Create relationship
    const success = await createCharacterRelationship(
      characterId,
      projectId,
      relationshipData
    );
    if (!success) {
      return NextResponse.json(
        {
          error:
            'Failed to create relationship. Check that both characters exist in the project.',
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Character relationship created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating character relationship:', error);
    return NextResponse.json(
      { error: 'Failed to create character relationship' },
      { status: 500 }
    );
  }
}
