import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { generateChapter } from '@/services/chapterService';
import { z } from 'zod';
import { withErrorHandler, ValidationError, NotFoundError, AuthenticationError, ExternalServiceError, handleDatabaseError } from '@/lib/errorHandler';
import { logger, PerformanceLogger, BusinessLogger } from '@/lib/logger';
import { withGeminiDegradation } from '@/lib/gracefulDegradation';

// Validation schema for chapter generation
const generateChapterSchema = z.object({
  prompt: z
    .string()
    .min(10, 'Prompt must be at least 10 characters')
    .max(2000, 'Prompt too long'),
  parameters: z.object({
    length: z
      .number()
      .min(500, 'Minimum chapter length is 500 words')
      .max(10000, 'Maximum chapter length is 10,000 words'),
    tone: z
      .string()
      .min(1, 'Tone is required')
      .max(50, 'Tone description too long'),
    style: z
      .string()
      .min(1, 'Style is required')
      .max(50, 'Style description too long'),
    focusCharacters: z.array(z.string()).optional(),
    plotPoints: z.array(z.string()).optional(),
  }),
});

/**
 * POST /api/chapters/[id]/generate - Generate chapter content using AI
 */
async function handlePost(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = (req as AuthenticatedRequest).user;
  const { id: chapterId } = await params;
  const body = await req.json();

  // Check if user is authenticated
  if (!user) {
    throw new AuthenticationError();
  }

  // Validate chapter ID format
  if (!chapterId || typeof chapterId !== 'string') {
    throw new ValidationError('Invalid chapter ID');
  }

  // Validate request body
  let validatedData;
  try {
    validatedData = generateChapterSchema.parse(body);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ValidationError('Invalid generation parameters', error.issues);
    }
    throw error;
  }

  logger.info('Chapter generation requested', {
    userId: user.id,
    chapterId,
    promptLength: validatedData.prompt.length,
    targetLength: validatedData.parameters.length,
    tone: validatedData.parameters.tone,
    style: validatedData.parameters.style,
  });

  // Generate chapter content with AI service degradation
  const updatedChapter = await withGeminiDegradation(
    async () => {
      return await PerformanceLogger.measureAsync(
        'ai_chapter_generation',
        async () => {
          try {
            return await generateChapter(chapterId, user.id, validatedData);
          } catch (error) {
            // Handle specific AI service errors
            if (error instanceof Error) {
              if (error.message.includes('not found')) {
                throw new NotFoundError('Chapter not found or access denied');
              }
              if (error.message.includes('rate limit')) {
                throw new ExternalServiceError('Gemini AI', 'Rate limit exceeded. Please try again later.');
              }
              if (error.message.includes('quota')) {
                throw new ExternalServiceError('Gemini AI', 'Quota exceeded. Please check your subscription.');
              }
              if (error.message.includes('content policy')) {
                throw new ValidationError('Content was filtered due to safety policies. Please modify your prompt.');
              }
            }
            throw handleDatabaseError(error);
          }
        },
        {
          userId: user.id,
          chapterId,
          promptLength: validatedData.prompt.length,
          targetLength: validatedData.parameters.length,
        }
      );
    },
    async () => {
      // Fallback: Return a message indicating AI is unavailable
      throw new ExternalServiceError('Gemini AI', 'AI generation service is temporarily unavailable. Please try again later.');
    }
  );

  // Log business event
  BusinessLogger.logAIGeneration(
    user.id,
    updatedChapter.projectId,
    chapterId,
    updatedChapter.content?.length || 0,
    Date.now() - Date.now(), // This would be calculated in the actual implementation
    true
  );

  logger.info('Chapter generated successfully', {
    userId: user.id,
    chapterId,
    projectId: updatedChapter.projectId,
    generatedLength: updatedChapter.content?.length || 0,
  });

  return NextResponse.json({
    success: true,
    data: updatedChapter,
    message: 'Chapter generated successfully',
  });
}

// Apply middleware with error handling and export handlers
export const POST = withErrorHandler(
  withRateLimit({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5, // 5 generations per minute (AI is expensive)
  })(withAuth(handlePost))
);
