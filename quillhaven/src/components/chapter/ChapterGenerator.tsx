'use client';

import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Wand2, RefreshCw, Settings, Sparkles } from 'lucide-react';
import type { Chapter } from '@/types/database';
import type { ChapterGenerationData } from '@/services/chapterService';

interface ChapterGeneratorProps {
  chapter: Chapter;
  onGenerate: (chapterId: string, data: ChapterGenerationData) => Promise<void>;
  isGenerating?: boolean;
  generationProgress?: number;
  className?: string;
}

interface GenerationParameters {
  prompt: string;
  length: number;
  tone: string;
  style: string;
  focusCharacters: string[];
  plotPoints: string[];
}

const TONE_OPTIONS = [
  { value: 'dramatic', label: 'Dramatic' },
  { value: 'humorous', label: 'Humorous' },
  { value: 'mysterious', label: 'Mysterious' },
  { value: 'romantic', label: 'Romantic' },
  { value: 'suspenseful', label: 'Suspenseful' },
  { value: 'melancholic', label: 'Melancholic' },
  { value: 'uplifting', label: 'Uplifting' },
  { value: 'dark', label: 'Dark' },
  { value: 'lighthearted', label: 'Lighthearted' },
  { value: 'intense', label: 'Intense' },
];

const STYLE_OPTIONS = [
  { value: 'first-person', label: 'First Person' },
  { value: 'third-person-limited', label: 'Third Person Limited' },
  { value: 'third-person-omniscient', label: 'Third Person Omniscient' },
  { value: 'descriptive', label: 'Descriptive' },
  { value: 'dialogue-heavy', label: 'Dialogue Heavy' },
  { value: 'action-packed', label: 'Action Packed' },
  { value: 'introspective', label: 'Introspective' },
  { value: 'fast-paced', label: 'Fast Paced' },
  { value: 'literary', label: 'Literary' },
];

const LENGTH_OPTIONS = [
  { value: 1000, label: '1,000 words (Short)' },
  { value: 2000, label: '2,000 words (Medium)' },
  { value: 3000, label: '3,000 words (Standard)' },
  { value: 4000, label: '4,000 words (Long)' },
  { value: 5000, label: '5,000 words (Extended)' },
];

export function ChapterGenerator({
  chapter,
  onGenerate,
  isGenerating = false,
  generationProgress = 0,
  className = '',
}: ChapterGeneratorProps) {
  const [parameters, setParameters] = useState<GenerationParameters>({
    prompt: '',
    length: 3000,
    tone: 'dramatic',
    style: 'third-person-limited',
    focusCharacters: [],
    plotPoints: [],
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  // Handle parameter changes
  const updateParameter = useCallback(
    <K extends keyof GenerationParameters>(
      key: K,
      value: GenerationParameters[K]
    ) => {
      setParameters((prev) => ({
        ...prev,
        [key]: value,
      }));
    },
    []
  );

  // Handle generation
  const handleGenerate = useCallback(async () => {
    if (!parameters.prompt.trim() || isGenerating) return;

    const generationData: ChapterGenerationData = {
      prompt: parameters.prompt,
      parameters: {
        length: parameters.length,
        tone: parameters.tone,
        style: parameters.style,
        focusCharacters: parameters.focusCharacters,
        plotPoints: parameters.plotPoints,
      },
    };

    try {
      await onGenerate(chapter.id, generationData);
    } catch (error) {
      console.error('Generation failed:', error);
    }
  }, [chapter.id, parameters, isGenerating, onGenerate]);

  // Handle regeneration with same parameters
  const handleRegenerate = useCallback(async () => {
    if (isGenerating) return;
    await handleGenerate();
  }, [handleGenerate, isGenerating]);

  // Load preset prompts
  const loadPresetPrompt = useCallback(
    (preset: string) => {
      const presets: Record<string, string> = {
        'action-scene':
          'Write an action-packed scene where the protagonist faces a significant challenge or confrontation.',
        'character-development':
          'Focus on character development and internal conflict, revealing deeper motivations and growth.',
        'dialogue-heavy':
          'Create a dialogue-driven chapter that advances the plot through character interactions.',
        'world-building':
          'Expand the world-building by exploring new locations, cultures, or aspects of the setting.',
        'plot-advancement':
          'Advance the main plot significantly, introducing new complications or resolving existing ones.',
        'emotional-moment':
          'Write an emotionally charged scene that deepens character relationships or reveals important truths.',
      };

      if (presets[preset]) {
        updateParameter('prompt', presets[preset]);
      }
    },
    [updateParameter]
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5" />
            AI Chapter Generator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generation Progress */}
          {isGenerating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Generating chapter content...</span>
                <span>{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="w-full" />
            </div>
          )}

          {/* Prompt Input */}
          <div className="space-y-2">
            <Label htmlFor="generation-prompt">Generation Prompt</Label>
            <Textarea
              id="generation-prompt"
              value={parameters.prompt}
              onChange={(e) => updateParameter('prompt', e.target.value)}
              placeholder="Describe what you want to happen in this chapter..."
              className="min-h-[100px]"
              disabled={isGenerating}
            />
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">
                Quick presets:
              </span>
              {[
                { key: 'action-scene', label: 'Action Scene' },
                {
                  key: 'character-development',
                  label: 'Character Development',
                },
                { key: 'dialogue-heavy', label: 'Dialogue Heavy' },
                { key: 'world-building', label: 'World Building' },
                { key: 'plot-advancement', label: 'Plot Advancement' },
                { key: 'emotional-moment', label: 'Emotional Moment' },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  variant="outline"
                  size="sm"
                  onClick={() => loadPresetPrompt(preset.key)}
                  disabled={isGenerating}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Basic Parameters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="length-select">Target Length</Label>
              <Select
                value={parameters.length.toString()}
                onValueChange={(value) =>
                  updateParameter('length', parseInt(value))
                }
                disabled={isGenerating}
              >
                <SelectTrigger id="length-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LENGTH_OPTIONS.map((option) => (
                    <SelectItem
                      key={option.value}
                      value={option.value.toString()}
                    >
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tone-select">Tone</Label>
              <Select
                value={parameters.tone}
                onValueChange={(value) => updateParameter('tone', value)}
                disabled={isGenerating}
              >
                <SelectTrigger id="tone-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TONE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="style-select">Writing Style</Label>
              <Select
                value={parameters.style}
                onValueChange={(value) => updateParameter('style', value)}
                disabled={isGenerating}
              >
                <SelectTrigger id="style-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STYLE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Advanced Parameters Toggle */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-2"
              disabled={isGenerating}
            >
              <Settings className="h-4 w-4" />
              Advanced Options
            </Button>
          </div>

          {/* Advanced Parameters */}
          {showAdvanced && (
            <div className="space-y-4 border-t pt-4">
              <div className="space-y-2">
                <Label htmlFor="focus-characters">
                  Focus Characters (comma-separated)
                </Label>
                <Input
                  id="focus-characters"
                  value={parameters.focusCharacters.join(', ')}
                  onChange={(e) =>
                    updateParameter(
                      'focusCharacters',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Character names to focus on in this chapter..."
                  disabled={isGenerating}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="plot-points">
                  Plot Points (comma-separated)
                </Label>
                <Input
                  id="plot-points"
                  value={parameters.plotPoints.join(', ')}
                  onChange={(e) =>
                    updateParameter(
                      'plotPoints',
                      e.target.value
                        .split(',')
                        .map((s) => s.trim())
                        .filter(Boolean)
                    )
                  }
                  placeholder="Plot threads to advance in this chapter..."
                  disabled={isGenerating}
                />
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-4">
            <Button
              onClick={handleGenerate}
              disabled={!parameters.prompt.trim() || isGenerating}
              className="flex items-center gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {isGenerating ? 'Generating...' : 'Generate Chapter'}
            </Button>

            {chapter.content && (
              <Button
                variant="outline"
                onClick={handleRegenerate}
                disabled={!parameters.prompt.trim() || isGenerating}
                className="flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Regenerate
              </Button>
            )}
          </div>

          {/* Generation Tips */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-medium text-sm">💡 Generation Tips:</h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>
                • Be specific about what you want to happen in the chapter
              </li>
              <li>• Mention key characters and their goals or conflicts</li>
              <li>• Include the setting or location if important</li>
              <li>• Specify the emotional tone or pacing you want</li>
              <li>
                • Reference previous events that should influence this chapter
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
