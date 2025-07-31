/**
 * Project Statistics API Route
 *
 * Handles project statistics retrieval
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { projectService, ProjectError } from '@/lib/services/project'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/statistics - Get project statistics
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const statistics = await projectService.getProjectStatistics(id, userId)

    return NextResponse.json({
      success: true,
      data: statistics,
    })
  } catch (error) {
    console.error('Error getting project statistics:', error)

    if (error instanceof ProjectError) {
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
        },
        { status: error.statusCode }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
      },
      { status: 500 }
    )
  }
}
