/**
 * Project Duplication API Route
 *
 * Handles project duplication operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { projectService, ProjectError } from '@/lib/services/project'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/projects/[id]/duplicate - Duplicate a project
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    if (!body.title) {
      return NextResponse.json(
        {
          success: false,
          error: 'New project title is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const duplicatedProject = await projectService.duplicateProject(
      id,
      userId,
      body.title
    )

    return NextResponse.json(
      {
        success: true,
        data: duplicatedProject,
        message: 'Project duplicated successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error duplicating project:', error)

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
