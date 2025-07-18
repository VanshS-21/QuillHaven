import { NextRequest, NextResponse } from 'next/server';
import { validateProjectOwnership } from '@/services/projectService';
import {
  createTimelineEvent,
  getProjectTimelineEvents,
  type CreateTimelineEventData,
} from '@/services/contextService';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { validateString, sanitizeText } from '@/utils/validation/input';
import {
  withErrorHandler,
  ValidationError,
  AuthenticationError,
  NotFoundError,
  handleDatabaseError,
} from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';

async function handleGetTimelineEvents(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Verify project ownership with performance monitoring
  const hasAccess = await PerformanceLogger.measureAsync(
    'project_ownership_validation',
    async () => {
      try {
        return await validateProjectOwnership(projectId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  if (!hasAccess) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Get project timeline events with performance monitoring
  const timelineEvents = await PerformanceLogger.measureAsync(
    'project_timeline_events_retrieval',
    async () => {
      try {
        return await getProjectTimelineEvents(projectId);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  // Log business event
  BusinessLogger.logUserAction('project_timeline_events_viewed', user.id, {
    projectId,
    timelineEventsCount: timelineEvents.length,
    timestamp: new Date().toISOString(),
  });

  logger.info('Project timeline events retrieved', {
    userId: user.id,
    projectId,
    timelineEventsCount: timelineEvents.length,
  });

  return NextResponse.json({
    success: true,
    data: timelineEvents,
  });
}

async function handleCreateTimelineEvent(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (request as AuthenticatedRequest).user;
  const { id: projectId } = await params;

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate project ID format
  if (!projectId || typeof projectId !== 'string') {
    throw new ValidationError('Invalid project ID');
  }

  // Verify project ownership with performance monitoring
  const hasAccess = await PerformanceLogger.measureAsync(
    'project_ownership_validation',
    async () => {
      try {
        return await validateProjectOwnership(projectId, user.id);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId }
  );

  if (!hasAccess) {
    throw new NotFoundError('Project not found or access denied');
  }

  // Parse and validate request body
  let body;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError('Invalid request body');
  }

  // Validate and sanitize input fields
  const titleValidation = validateString(body.title, 'title', {
    required: true,
    minLength: 1,
    maxLength: 200,
  });

  if (!titleValidation.isValid) {
    throw new ValidationError(titleValidation.errors.join(', '));
  }

  const eventDateValidation = validateString(body.eventDate, 'eventDate', {
    required: true,
    minLength: 1,
    maxLength: 100,
  });

  if (!eventDateValidation.isValid) {
    throw new ValidationError(eventDateValidation.errors.join(', '));
  }

  // Validate importance if provided
  const importance = body.importance || 1;
  if (typeof importance !== 'number' || importance < 1 || importance > 5) {
    throw new ValidationError(
      'Timeline event importance must be a number between 1 and 5'
    );
  }

  const timelineEventData: CreateTimelineEventData = {
    title: sanitizeText(titleValidation.sanitizedData as string),
    description: body.description ? sanitizeText(body.description) : undefined,
    eventDate: sanitizeText(eventDateValidation.sanitizedData as string),
    importance: importance,
  };

  // Additional validation for field lengths
  if (
    timelineEventData.description &&
    timelineEventData.description.length > 2000
  ) {
    throw new ValidationError(
      'Timeline event description too long (max 2000 characters)'
    );
  }

  // Create timeline event with performance monitoring
  const timelineEvent = await PerformanceLogger.measureAsync(
    'timeline_event_creation',
    async () => {
      try {
        return await createTimelineEvent(projectId, timelineEventData);
      } catch (error) {
        throw handleDatabaseError(error);
      }
    },
    { userId: user.id, projectId, timelineEventTitle: timelineEventData.title }
  );

  // Log business event
  BusinessLogger.logUserAction('timeline_event_created', user.id, {
    projectId,
    timelineEventId: timelineEvent.id,
    timelineEventTitle: timelineEvent.title,
    importance: timelineEvent.importance,
    timestamp: new Date().toISOString(),
  });

  logger.info('Timeline event created successfully', {
    userId: user.id,
    projectId,
    timelineEventId: timelineEvent.id,
    timelineEventTitle: timelineEvent.title,
    importance: timelineEvent.importance,
  });

  return NextResponse.json(
    {
      success: true,
      data: timelineEvent,
    },
    { status: 201 }
  );
}

// Apply middleware with error handling and export handlers
export const GET = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  })(withAuth(handleGetTimelineEvents))
);

export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30, // 30 creations per minute
  })(withAuth(handleCreateTimelineEvent))
);
