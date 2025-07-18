import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createTimelineEvent,
  getProjectTimelineEvents,
  type CreateTimelineEventData,
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

    // Get project timeline events
    const timelineEvents = await getProjectTimelineEvents(projectId);

    return NextResponse.json({
      success: true,
      data: timelineEvents,
    });
  } catch (error) {
    console.error('Error getting project timeline events:', error);
    return NextResponse.json(
      { error: 'Failed to get project timeline events' },
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
    const timelineEventData: CreateTimelineEventData = {
      title: body.title,
      description: body.description,
      eventDate: body.eventDate,
      importance: body.importance,
    };

    // Validate required fields
    if (
      !timelineEventData.title ||
      timelineEventData.title.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Timeline event title is required' },
        { status: 400 }
      );
    }

    if (
      !timelineEventData.eventDate ||
      timelineEventData.eventDate.trim().length === 0
    ) {
      return NextResponse.json(
        { error: 'Timeline event date is required' },
        { status: 400 }
      );
    }

    // Create timeline event
    const timelineEvent = await createTimelineEvent(
      projectId,
      timelineEventData
    );

    return NextResponse.json(
      {
        success: true,
        data: timelineEvent,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating timeline event:', error);
    return NextResponse.json(
      { error: 'Failed to create timeline event' },
      { status: 500 }
    );
  }
}
