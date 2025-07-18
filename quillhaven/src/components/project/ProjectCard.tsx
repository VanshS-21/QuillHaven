'use client';

import React, { useState } from 'react';
import {
  MoreHorizontal,
  Edit,
  Trash2,
  BookOpen,
  Calendar,
  TrendingUp,
  Download,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ProjectSettings } from './ProjectSettings';
import { ProjectExporter } from './ProjectExporter';
import { projectApiService } from '@/services/api/projectApiService';
import type { Project, ProjectWithDetails } from '@/types/database';

interface ProjectCardProps {
  project: Project;
  onDeleted: (projectId: string) => void;
  onUpdated: (project: Project) => void;
}

export function ProjectCard({
  project,
  onDeleted,
  onUpdated,
}: ProjectCardProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showExporter, setShowExporter] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [projectDetails, setProjectDetails] =
    useState<ProjectWithDetails | null>(null);

  // Calculate progress percentage
  const progressPercentage =
    project.targetLength > 0
      ? Math.min((project.currentWordCount / project.targetLength) * 100, 100)
      : 0;

  // Format dates
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'text-gray-600 bg-gray-100';
      case 'IN_PROGRESS':
        return 'text-blue-600 bg-blue-100';
      case 'COMPLETED':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  // Format status text
  const formatStatus = (status: string) => {
    switch (status) {
      case 'IN_PROGRESS':
        return 'In Progress';
      case 'COMPLETED':
        return 'Completed';
      default:
        return status.charAt(0) + status.slice(1).toLowerCase();
    }
  };

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const response = await projectApiService.deleteProject(project.id);

      if (response.success) {
        onDeleted(project.id);
        setShowDeleteDialog(false);
      } else {
        console.error('Failed to delete project:', response.error);
        // You might want to show a toast notification here
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    } finally {
      setDeleting(false);
    }
  };

  const handleProjectUpdated = (updatedProject: Project) => {
    onUpdated(updatedProject);
    setShowSettings(false);
  };

  const handleExportClick = async () => {
    try {
      // Load full project details for export
      const response = await projectApiService.getProject(project.id);
      if (response.success && response.data) {
        setProjectDetails(response.data);
        setShowExporter(true);
      } else {
        console.error('Failed to load project details:', response.error);
      }
    } catch (error) {
      console.error('Error loading project details:', error);
    }
  };

  return (
    <>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold truncate">
                {project.title}
              </CardTitle>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(project.status)}`}
                >
                  {formatStatus(project.status)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {project.genre}
                </span>
              </div>
            </div>
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                className="opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSettings(true);
                }}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </CardAction>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Description */}
          {project.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {project.description}
            </p>
          )}

          {/* Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {project.currentWordCount.toLocaleString()} /{' '}
                {project.targetLength.toLocaleString()} words
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <div className="text-xs text-muted-foreground text-right">
              {progressPercentage.toFixed(1)}% complete
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 pt-2 border-t">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="text-sm font-medium">
                  {formatDate(project.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">Updated</p>
                <p className="text-sm font-medium">
                  {formatDate(project.updatedAt)}
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                // Navigate to project - you'll implement this based on your routing
                window.location.href = `/project/${project.id}`;
              }}
            >
              <BookOpen className="h-4 w-4 mr-2" />
              Open
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleExportClick();
              }}
              title="Export Project"
            >
              <Download className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(true);
              }}
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowDeleteDialog(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Project Settings Modal */}
      {showSettings && (
        <ProjectSettings
          project={project}
          open={showSettings}
          onClose={() => setShowSettings(false)}
          onProjectUpdated={handleProjectUpdated}
        />
      )}

      {/* Project Exporter Modal */}
      {showExporter && projectDetails && (
        <ProjectExporter
          project={projectDetails}
          open={showExporter}
          onClose={() => {
            setShowExporter(false);
            setProjectDetails(null);
          }}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{project.title}&quot;? This
              action cannot be undone. All chapters, characters, and other
              project data will be permanently removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? 'Deleting...' : 'Delete Project'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
