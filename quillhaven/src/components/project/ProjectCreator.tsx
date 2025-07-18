'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import {
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Target,
  Palette,
  FileText,
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  projectApiService,
  type CreateProjectRequest,
} from '@/services/api/projectApiService';
import type { Project } from '@/types/database';

interface ProjectCreatorProps {
  open: boolean;
  onClose: () => void;
  onProjectCreated: (project: Project) => void;
}

interface ProjectFormData {
  title: string;
  description: string;
  genre: string;
  targetLength: number;
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
  'Children&apos;s',
  'Non-Fiction',
  'Biography',
  'Memoir',
  'Self-Help',
  'Other',
];

const TARGET_LENGTHS = [
  { label: 'Short Story (1,000 - 7,500 words)', value: 5000 },
  { label: 'Novelette (7,500 - 17,500 words)', value: 12500 },
  { label: 'Novella (17,500 - 40,000 words)', value: 30000 },
  { label: 'Novel (40,000 - 100,000 words)', value: 70000 },
  { label: 'Epic Novel (100,000+ words)', value: 120000 },
  { label: 'Custom', value: 0 },
];

export function ProjectCreator({
  open,
  onClose,
  onProjectCreated,
}: ProjectCreatorProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [creating, setCreating] = useState(false);
  const [customLength, setCustomLength] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
    reset,
  } = useForm<ProjectFormData>({
    defaultValues: {
      title: '',
      description: '',
      genre: '',
      targetLength: 70000,
    },
  });

  const watchedValues = watch();
  const totalSteps = 4;
  const progress = (currentStep / totalSteps) * 100;

  const handleClose = () => {
    reset();
    setCurrentStep(1);
    setCustomLength(null);
    onClose();
  };

  const nextStep = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const onSubmit = async (data: ProjectFormData) => {
    try {
      setCreating(true);

      const projectData: CreateProjectRequest = {
        title: data.title,
        description: data.description || undefined,
        genre: data.genre,
        targetLength: customLength || data.targetLength,
      };

      const response = await projectApiService.createProject(projectData);

      if (response.success && response.data) {
        onProjectCreated(response.data);
        handleClose();
      } else {
        console.error('Failed to create project:', response.error);
        // You might want to show an error toast here
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setCreating(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return watchedValues.title?.trim().length > 0;
      case 2:
        return watchedValues.genre?.length > 0;
      case 3:
        return watchedValues.targetLength > 0 || customLength !== null;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <BookOpen className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Project Basics</h3>
              <p className="text-muted-foreground">
                Let&apos;s start with the fundamentals of your project
              </p>
            </div>

            <div className="space-y-4">
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
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  placeholder="Brief description of your project..."
                  rows={3}
                  {...register('description')}
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Palette className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Choose Your Genre</h3>
              <p className="text-muted-foreground">
                This helps us provide better AI assistance
              </p>
            </div>

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
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <Target className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Set Your Target</h3>
              <p className="text-muted-foreground">
                How long do you want your project to be?
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {TARGET_LENGTHS.map((length) => (
                  <Card
                    key={length.value}
                    className={`cursor-pointer transition-colors ${
                      (customLength === null &&
                        watchedValues.targetLength === length.value) ||
                      (length.value === 0 && customLength !== null)
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => {
                      if (length.value === 0) {
                        setCustomLength(50000);
                        setValue('targetLength', 50000);
                      } else {
                        setCustomLength(null);
                        setValue('targetLength', length.value);
                      }
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{length.label}</span>
                        <div
                          className={`w-4 h-4 rounded-full border-2 ${
                            (customLength === null &&
                              watchedValues.targetLength === length.value) ||
                            (length.value === 0 && customLength !== null)
                              ? 'border-primary bg-primary'
                              : 'border-muted-foreground'
                          }`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {customLength !== null && (
                <div>
                  <Label htmlFor="customLength">Custom Word Count</Label>
                  <Input
                    id="customLength"
                    type="number"
                    min="1000"
                    max="1000000"
                    value={customLength}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setCustomLength(value);
                      setValue('targetLength', value);
                    }}
                    placeholder="Enter target word count..."
                  />
                </div>
              )}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <FileText className="h-12 w-12 text-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold">Review & Create</h3>
              <p className="text-muted-foreground">
                Review your project details before creating
              </p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Project Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Title
                  </Label>
                  <p className="font-medium">{watchedValues.title}</p>
                </div>

                {watchedValues.description && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">
                      Description
                    </Label>
                    <p className="text-sm">{watchedValues.description}</p>
                  </div>
                )}

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Genre
                  </Label>
                  <p className="font-medium">{watchedValues.genre}</p>
                </div>

                <div>
                  <Label className="text-sm font-medium text-muted-foreground">
                    Target Length
                  </Label>
                  <p className="font-medium">
                    {(
                      customLength || watchedValues.targetLength
                    ).toLocaleString()}{' '}
                    words
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Step {currentStep} of {totalSteps}
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Basics</span>
            <span>Genre</span>
            <span>Target</span>
            <span>Review</span>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)}>
          {/* Step Content */}
          <div className="py-6">{renderStep()}</div>

          {/* Navigation */}
          <div className="flex justify-between pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={creating}
              >
                Cancel
              </Button>

              {currentStep < totalSteps ? (
                <Button
                  type="button"
                  onClick={nextStep}
                  disabled={!canProceed()}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              ) : (
                <Button type="submit" disabled={creating || !canProceed()}>
                  {creating ? 'Creating...' : 'Create Project'}
                </Button>
              )}
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
