/**
 * Project Archive API Routes
 *
 * Handles project archiving and restoration operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { projectService, ProjectError } from '@/lib/services/project'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/projects/[id]/archive - Archive a project
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await projectService.archiveProject(id, userId)

    return NextResponse.json({
      success: true,
      message: 'Project archived successfully',
    })
  } catch (error) {
    console.error('Error archiving project:', error)

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
 * DELETE /api/projects/[id]/archive - Restore an archived project
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    await projectService.restoreProject(id, userId)

    return NextResponse.json({
      success: true,
      message: 'Project restored successfully',
    })
  } catch (error) {
    console.error('Error restoring project:', error)

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
