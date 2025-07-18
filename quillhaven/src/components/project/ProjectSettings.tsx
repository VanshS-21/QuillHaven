'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Settings, Save, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  projectApiService,
  type UpdateProjectRequest,
} from '@/services/api/projectApiService';
import type { Project, ProjectStatus } from '@/types/database';

interface ProjectSettingsProps {
  project: Project;
  open: boolean;
  onClose: () => void;
  onProjectUpdated: (project: Project) => void;
}

interface ProjectFormData {
  title: string;
  description: string;
  genre: string;
  targetLength: number;
  status: ProjectStatus;
}

const GENRES = [
  'Fantasy',
  'Science Fiction',
  'Mystery',
  'Romance',
  'Thriller',
  'Horror',
  'Historical Fiction',
  'Literary Fiction',
  'Young Adult',
  "Children's",
  'Non-Fiction',
  'Biography',
  'Memoir',
  'Self-Help',
  'Other',
];

const STATUS_OPTIONS = [
  {
    value: 'DRAFT',
    label: 'Draft',
    description: 'Project is in early planning stage',
  },
  {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Actively working on the project',
  },
  {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Project is finished',
  },
];

export function ProjectSettings({
  project,
  open,
  onClose,
  onProjectUpdated,
}: ProjectSettingsProps) {
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    defaultValues: {
      title: project.title,
      description: project.description || '',
      genre: project.genre,
      targetLength: project.targetLength,
      status: project.status,
    },
  });

  const watchedValues = watch();

  // Check for changes
  React.useEffect(() => {
    const hasChanged =
      watchedValues.title !== project.title ||
      watchedValues.description !== (project.description || '') ||
      watchedValues.genre !== project.genre ||
      watchedValues.targetLength !== project.targetLength ||
      watchedValues.status !== project.status;

    setHasChanges(hasChanged);
  }, [watchedValues, project]);

  const handleClose = () => {
    if (hasChanges) {
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to close?'
      );
      if (!confirmClose) return;
    }

    reset({
      title: project.title,
      description: project.description || '',
      genre: project.genre,
      targetLength: project.targetLength,
      status: project.status,
    });
    setHasChanges(false);
    onClose();
  };

  const onSubmit = async (data: ProjectFormData) => {
    try {
      setSaving(true);

      const updateData: UpdateProjectRequest = {
        title: data.title,
        description: data.description || undefined,
        genre: data.genre,
        targetLength: data.targetLength,
        status: data.status,
      };

      const response = await projectApiService.updateProject(
        project.id,
        updateData
      );

      if (response.success && response.data) {
        onProjectUpdated(response.data);
        setHasChanges(false);
      } else {
        console.error('Failed to update project:', response.error);
        // You might want to show an error toast here
      }
    } catch (error) {
      console.error('Error updating project:', error);
    } finally {
      setSaving(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage =
    project.targetLength > 0
      ? Math.min((project.currentWordCount / project.targetLength) * 100, 100)
      : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Project Settings
          </DialogTitle>
          <DialogDescription>
            Update your project details and settings
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Project Statistics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Statistics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Current Words
                  </Label>
                  <p className="text-2xl font-bold">
                    {project.currentWordCount.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Target Words
                  </Label>
                  <p className="text-2xl font-bold">
                    {project.targetLength.toLocaleString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Progress
                  </Label>
                  <p className="text-2xl font-bold">
                    {progressPercentage.toFixed(1)}%
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Status
                  </Label>
                  <p className="text-lg font-semibold capitalize">
                    {project.status.toLowerCase().replace('_', ' ')}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Created
                  </Label>
                  <p className="font-medium">
                    {new Date(project.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Last Updated
                  </Label>
                  <p className="font-medium">
                    {new Date(project.updatedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Basic Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Project Title *</Label>
                <Input
                  id="title"
                  placeholder="Enter your project title..."
                  {...register('title', { required: 'Title is required' })}
                />
                {errors.title && (
                  <p className="text-sm text-destructive mt-1">
                    {errors.title.message}
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your project..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="genre">Genre *</Label>
                  <Select
                    value={watchedValues.genre}
                    onValueChange={(value) => setValue('genre', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a genre..." />
                    </SelectTrigger>
                    <SelectContent>
                      {GENRES.map((genre) => (
                        <SelectItem key={genre} value={genre}>
                          {genre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.genre && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.genre.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="targetLength">Target Word Count *</Label>
                  <Input
                    id="targetLength"
                    type="number"
                    min="1000"
                    max="1000000"
                    placeholder="Enter target word count..."
                    {...register('targetLength', {
                      required: 'Target length is required',
                      min: { value: 1000, message: 'Minimum 1,000 words' },
                      max: {
                        value: 1000000,
                        message: 'Maximum 1,000,000 words',
                      },
                    })}
                  />
                  {errors.targetLength && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.targetLength.message}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Project Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {STATUS_OPTIONS.map((status) => (
                  <Card
                    key={status.value}
                    className={`cursor-pointer transition-colors ${
                      watchedValues.status === status.value
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() =>
                      setValue('status', status.value as ProjectStatus)
                    }
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium">{status.label}</h4>
                          <p className="text-sm text-muted-foreground">
                            {status.description}
                          </p>
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            watchedValues.status === status.value
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={saving}
            >
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>

            <Button type="submit" disabled={saving || !hasChanges}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
