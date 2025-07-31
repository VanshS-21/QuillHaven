/**
 * Projects API Routes
 *
 * Handles project listing and creation operations
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import {
  projectService,
  ProjectError,
  CreateProjectData,
  ProjectFilters,
} from '@/lib/services/project'
import { ProjectStatus, ProjectVisibility } from '@/generated/prisma'

/**
 * GET /api/projects - List user projects with filtering
 */
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url)
    const filters: ProjectFilters = {
      status: (searchParams.get('status') as ProjectStatus) || undefined,
      visibility:
        (searchParams.get('visibility') as ProjectVisibility) || undefined,
      genre: searchParams.get('genre') || undefined,
      tags: searchParams.get('tags')?.split(',').filter(Boolean) || undefined,
      isArchived: searchParams.get('archived') === 'true',
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
      sortBy:
        (searchParams.get('sortBy') as
          | 'title'
          | 'createdAt'
          | 'updatedAt'
          | 'lastAccessedAt') || 'updatedAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    }

    const projects = await projectService.listUserProjects(userId, filters)

    return NextResponse.json({
      success: true,
      data: projects,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: projects.length,
      },
    })
  } catch (error) {
    console.error('Error listing projects:', error)

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
 * POST /api/projects - Create a new project
 */
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth()

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.title) {
      return NextResponse.json(
        {
          success: false,
          error: 'Project title is required',
          code: 'VALIDATION_ERROR',
        },
        { status: 400 }
      )
    }

    const projectData: CreateProjectData = {
      title: body.title,
      description: body.description,
      genre: body.genre,
      targetWordCount: body.targetWordCount,
      isPublic: body.isPublic || false,
      tags: body.tags || [],
      templateId: body.templateId,
    }

    const project = await projectService.createProject(userId, projectData)

    return NextResponse.json(
      {
        success: true,
        data: project,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Error creating project:', error)

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
