/**
 * Project Search API Route
 *
 * Handles project search operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { projectService, ProjectError } from '@/lib/services/project'

/**
 * GET /api/projects/search - Search user projects
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')

    if (!query) {
      return NextResponse.json(
        {
          success: false,
          error: 'Search query is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const results = await projectService.searchProjects(userId, query)

    return NextResponse.json({
      success: true,
      data: results,
      query: query,
    })
  } catch (error) {
    console.error('Error searching projects:', error)

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
