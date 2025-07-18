'use client';

import React, { useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  List,
  Plus,
  Edit,
  Trash2,
  GripVertical,
  FileText,
  Clock,
} from 'lucide-react';
import type { Chapter } from '@/types/database';

interface ChapterListProps {
  chapters: Chapter[];
  selectedChapterId?: string;
  onChapterSelect: (chapterId: string) => void;
  onChapterReorder: (
    chapterOrders: { id: string; order: number }[]
  ) => Promise<void>;
  onChapterCreate: () => void;
  onChapterEdit: (chapterId: string) => void;
  onChapterDelete: (chapterId: string) => void;
  isLoading?: boolean;
  className?: string;
}

interface SortableChapterItemProps {
  chapter: Chapter;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function SortableChapterItem({
  chapter,
  isSelected,
  onSelect,
  onEdit,
  onDelete,
}: SortableChapterItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: chapter.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Format chapter status
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'GENERATED':
        return 'bg-blue-100 text-blue-800';
      case 'EDITED':
        return 'bg-yellow-100 text-yellow-800';
      case 'FINAL':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Format last updated time
  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 min ago';
    if (minutes < 60) return `${minutes} min ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return date.toLocaleDateString();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative
        ${isDragging ? 'opacity-50' : ''}
        ${isSelected ? 'ring-2 ring-primary' : ''}
      `}
    >
      <Card
        className={`
          cursor-pointer transition-all duration-200
          hover:shadow-md
          ${isSelected ? 'border-primary bg-primary/5' : ''}
          ${isDragging ? 'shadow-lg' : ''}
        `}
        onClick={onSelect}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Drag Handle */}
            <button
              {...attributes}
              {...listeners}
              className="
                flex-shrink-0 p-1 rounded hover:bg-muted
                opacity-0 group-hover:opacity-100 transition-opacity
                cursor-grab active:cursor-grabbing
              "
              onClick={(e) => e.stopPropagation()}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>

            {/* Chapter Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-sm truncate">
                    {chapter.order}. {chapter.title}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${getStatusColor(chapter.status)}`}
                    >
                      {chapter.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {chapter.wordCount.toLocaleString()} words
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete();
                    }}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Chapter Preview */}
              {chapter.content && (
                <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                  {chapter.content.substring(0, 120)}...
                </p>
              )}

              {/* Last Updated */}
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {formatLastUpdated(new Date(chapter.updatedAt))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function ChapterList({
  chapters,
  selectedChapterId,
  onChapterSelect,
  onChapterReorder,
  onChapterCreate,
  onChapterEdit,
  onChapterDelete,
  isLoading = false,
  className = '',
}: ChapterListProps) {
  const [sortedChapters, setSortedChapters] = useState(chapters);
  const [isReordering, setIsReordering] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Update sorted chapters when chapters prop changes
  React.useEffect(() => {
    setSortedChapters([...chapters].sort((a, b) => a.order - b.order));
  }, [chapters]);

  // Handle drag end
  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;

      if (!over || active.id === over.id) {
        return;
      }

      const oldIndex = sortedChapters.findIndex(
        (chapter) => chapter.id === active.id
      );
      const newIndex = sortedChapters.findIndex(
        (chapter) => chapter.id === over.id
      );

      if (oldIndex === -1 || newIndex === -1) {
        return;
      }

      const newSortedChapters = arrayMove(sortedChapters, oldIndex, newIndex);
      setSortedChapters(newSortedChapters);

      // Create reorder data
      const chapterOrders = newSortedChapters.map((chapter, index) => ({
        id: chapter.id,
        order: index + 1,
      }));

      try {
        setIsReordering(true);
        await onChapterReorder(chapterOrders);
      } catch (error) {
        console.error('Failed to reorder chapters:', error);
        // Revert on error
        setSortedChapters([...chapters].sort((a, b) => a.order - b.order));
      } finally {
        setIsReordering(false);
      }
    },
    [sortedChapters, chapters, onChapterReorder]
  );

  // Calculate total word count
  const totalWordCount = chapters.reduce(
    (sum, chapter) => sum + chapter.wordCount,
    0
  );

  if (isLoading) {
    return (
      <div className={`space-y-4 ${className}`}>
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <List className="h-5 w-5" />
              Chapters ({chapters.length})
            </CardTitle>
            <Button
              onClick={onChapterCreate}
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Chapter
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total: {totalWordCount.toLocaleString()} words</span>
            {isReordering && (
              <span className="text-blue-600">Reordering...</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Chapter List */}
      {sortedChapters.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No chapters yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create your first chapter to get started with your story.
            </p>
            <Button
              onClick={onChapterCreate}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Create First Chapter
            </Button>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={sortedChapters.map((chapter) => chapter.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {sortedChapters.map((chapter) => (
                <SortableChapterItem
                  key={chapter.id}
                  chapter={chapter}
                  isSelected={selectedChapterId === chapter.id}
                  onSelect={() => onChapterSelect(chapter.id)}
                  onEdit={() => onChapterEdit(chapter.id)}
                  onDelete={() => onChapterDelete(chapter.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
