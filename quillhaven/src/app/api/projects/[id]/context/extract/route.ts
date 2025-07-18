import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  extractContextFromContent,
  updateContextFromExtraction,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

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
    const { content, autoUpdate = false } = body;

    // Validate required fields
    if (
      !content ||
      typeof content !== 'string' ||
      content.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Content is required for context extraction' },
        { status: 400 }
      );
    }

    // Extract context from content
    const extractedContext = await extractContextFromContent(
      content,
      projectId
    );

    // Optionally update project context with extracted information
    if (autoUpdate) {
      await updateContextFromExtraction(projectId, extractedContext);
    }

    return NextResponse.json({
      success: true,
      data: {
        extractedContext,
        autoUpdated: autoUpdate,
      },
    });
  } catch (error) {
    console.error('Error extracting context from content:', error);
    return NextResponse.json(
      { error: 'Failed to extract context from content' },
      { status: 500 }
    );
  }
}
