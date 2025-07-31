/**
 * Individual Project API Routes
 *
 * Handles operations on specific projects (GET, PUT, DELETE)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  projectService,
  ProjectError,
  ProjectUpdates,
} from '@/lib/services/project'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id] - Get a specific project
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const project = await projectService.getProject(id, userId)

    return NextResponse.json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error('Error getting project:', error)

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

/**
 * PUT /api/projects/[id] - Update a specific project
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json()

    const updates: ProjectUpdates = {
      title: body.title,
      description: body.description,
      genre: body.genre,
      targetWordCount: body.targetWordCount,
      status: body.status,
      visibility: body.visibility,
      tags: body.tags,
      settings: body.settings,
    }

    // Remove undefined values
    Object.keys(updates).forEach((key) => {
      if (updates[key as keyof ProjectUpdates] === undefined) {
        delete updates[key as keyof ProjectUpdates]
      }
    })

    const project = await projectService.updateProject(id, userId, updates)

    return NextResponse.json({
      success: true,
      data: project,
    })
  } catch (error) {
    console.error('Error updating project:', error)

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

/**
 * DELETE /api/projects/[id] - Delete a specific project (soft delete)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await projectService.deleteProject(id, userId)

    return NextResponse.json({
      success: true,
      message: 'Project deleted successfully',
    })
  } catch (error) {
    console.error('Error deleting project:', error)

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
