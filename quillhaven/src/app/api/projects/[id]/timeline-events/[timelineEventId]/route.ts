import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  updateTimelineEvent,
  deleteTimelineEvent,
  type UpdateTimelineEventData,
} from '@/services/contextService';
import { verifyAuth } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; timelineEventId: string }> }
) {
  try {
    const { id: projectId, timelineEventId } = await params;

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
    const updateData: UpdateTimelineEventData = {
      title: body.title,
      description: body.description,
      eventDate: body.eventDate,
      importance: body.importance,
    };

    // Update timeline event
    const timelineEvent = await updateTimelineEvent(
      timelineEventId,
      projectId,
      updateData
    );
    if (!timelineEvent) {
      return NextResponse.json(
        { error: 'Timeline event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: timelineEvent,
    });
  } catch (error) {
    console.error('Error updating timeline event:', error);
    return NextResponse.json(
      { error: 'Failed to update timeline event' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; timelineEventId: string }> }
) {
  try {
    const { id: projectId, timelineEventId } = await params;

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

    // Delete timeline event
    const success = await deleteTimelineEvent(timelineEventId, projectId);
    if (!success) {
      return NextResponse.json(
        { error: 'Timeline event not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Timeline event deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting timeline event:', error);
    return NextResponse.json(
      { error: 'Failed to delete timeline event' },
      { status: 500 }
    );
  }
}
