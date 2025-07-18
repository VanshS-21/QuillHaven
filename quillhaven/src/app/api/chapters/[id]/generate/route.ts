import { NextRequest, NextResponse } from 'next/server';
import {
  withAuth,
  withRateLimit,
  AuthenticatedRequest,
} from '@/lib/middleware';
import { generateChapter } from '@/services/chapterService';
import { z } from 'zod';

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
  try {
    const user = (req as AuthenticatedRequest).user;
    const { id: chapterId } = await params;
    const body = await req.json();

    // Check if user is authenticated
    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
        },
        { status: 401 }
      );
    }

    // Validate chapter ID format
    if (!chapterId || typeof chapterId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid chapter ID',
        },
        { status: 400 }
      );
    }

    // Validate request body
    const validatedData = generateChapterSchema.parse(body);

    // Generate chapter content
    const updatedChapter = await generateChapter(
      chapterId,
      user.id,
      validatedData
    );

    return NextResponse.json({
      success: true,
      data: updatedChapter,
      message: 'Chapter generated successfully',
    });
  } catch (error) {
    console.error('Error generating chapter:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid generation parameters',
          details: error.issues,
        },
        { status: 400 }
      );
    }

    if (error instanceof Error) {
      // Handle specific AI service errors
      if (error.message.includes('not found')) {
        return NextResponse.json(
          {
            success: false,
            error: 'Chapter not found or access denied',
          },
          { status: 404 }
        );
      }

      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI service rate limit exceeded. Please try again later.',
          },
          { status: 429 }
        );
      }

      if (error.message.includes('quota')) {
        return NextResponse.json(
          {
            success: false,
            error: 'AI service quota exceeded. Please check your subscription.',
          },
          { status: 402 }
        );
      }

      if (error.message.includes('content policy')) {
        return NextResponse.json(
          {
            success: false,
            error:
              'Content was filtered due to safety policies. Please modify your prompt.',
          },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate chapter content',
      },
      { status: 500 }
    );
  }
}

// Apply middleware and export handlers
export const POST = withRateLimit({
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 5, // 5 generations per minute (AI is expensive)
})(withAuth(handlePost));
