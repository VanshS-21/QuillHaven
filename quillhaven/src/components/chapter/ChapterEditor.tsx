'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Save, FileText, Clock } from 'lucide-react';
import type { ChapterWithVersions } from '@/types/database';

interface ChapterEditorProps {
  chapter: ChapterWithVersions;
  onSave: (
    chapterId: string,
    data: { title?: string; content?: string }
  ) => Promise<void>;
  onAutoSave?: (
    chapterId: string,
    data: { title?: string; content?: string }
  ) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function ChapterEditor({
  chapter,
  onSave,
  onAutoSave,
  isLoading = false,
  className = '',
}: ChapterEditorProps) {
  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [wordCount, setWordCount] = useState(chapter.wordCount);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isAutoSaving, setIsAutoSaving] = useState(false);

  const autoSaveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const editorRef = useRef<any>(null);

  // Count words in content
  const countWords = useCallback((text: string): number => {
    return text
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0).length;
  }, []);

  // Handle content change
  const handleContentChange = useCallback(
    (value: string | undefined) => {
      const newContent = value || '';
      setContent(newContent);
      setWordCount(countWords(newContent));
      setHasUnsavedChanges(true);

      // Clear existing auto-save timeout
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }

      // Set new auto-save timeout (30 seconds)
      if (onAutoSave) {
        autoSaveTimeoutRef.current = setTimeout(async () => {
          try {
            setIsAutoSaving(true);
            await onAutoSave(chapter.id, { content: newContent });
            setHasUnsavedChanges(false);
            setLastSaved(new Date());
          } catch (error) {
            console.error('Auto-save failed:', error);
          } finally {
            setIsAutoSaving(false);
          }
        }, 30000); // 30 seconds
      }
    },
    [chapter.id, countWords, onAutoSave]
  );

  // Handle title change
  const handleTitleChange = useCallback((newTitle: string) => {
    setTitle(newTitle);
    setHasUnsavedChanges(true);
  }, []);

  // Handle manual save
  const handleSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;

    try {
      setIsSaving(true);
      await onSave(chapter.id, { title, content });
      setHasUnsavedChanges(false);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Save failed:', error);
    } finally {
      setIsSaving(false);
    }
  }, [chapter.id, title, content, hasUnsavedChanges, isSaving, onSave]);

  // Handle editor mount
  const handleEditorDidMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;

      // Configure editor options
      editor.updateOptions({
        wordWrap: 'on',
        lineNumbers: 'on',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 14,
        fontFamily: 'Georgia, serif',
        lineHeight: 1.6,
        padding: { top: 20, bottom: 20 },
      });

      // Add keyboard shortcuts
      editor.addCommand(
        editor.KeyMod.CtrlCmd | editor.KeyCode.KeyS,
        handleSave
      );
    },
    [handleSave]
  );

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  // Reset state when chapter changes
  useEffect(() => {
    setTitle(chapter.title);
    setContent(chapter.content);
    setWordCount(chapter.wordCount);
    setHasUnsavedChanges(false);
    setLastSaved(null);
  }, [chapter.id, chapter.title, chapter.content, chapter.wordCount]);

  // Format last saved time
  const formatLastSaved = (date: Date | null) => {
    if (!date) return 'Never';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes === 1) return '1 minute ago';
    if (minutes < 60) return `${minutes} minutes ago`;

    const hours = Math.floor(minutes / 60);
    if (hours === 1) return '1 hour ago';
    if (hours < 24) return `${hours} hours ago`;

    return date.toLocaleDateString();
  };

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Chapter Editor
            </CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              Last saved: {formatLastSaved(lastSaved)}
              {isAutoSaving && (
                <span className="text-blue-600">Auto-saving...</span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title Input */}
          <div className="space-y-2">
            <Label htmlFor="chapter-title">Chapter Title</Label>
            <Input
              id="chapter-title"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Enter chapter title..."
              className="text-lg font-semibold"
              disabled={isLoading}
            />
          </div>

          {/* Stats and Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>Words: {wordCount.toLocaleString()}</span>
              <span>Status: {chapter.status}</span>
              {hasUnsavedChanges && (
                <span className="text-amber-600 font-medium">
                  Unsaved changes
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSave}
                disabled={!hasUnsavedChanges || isSaving || isLoading}
                size="sm"
                className="flex items-center gap-2"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Editor */}
      <Card className="flex-1 flex flex-col">
        <CardContent className="flex-1 p-0">
          <div className="h-full min-h-[500px]">
            <Editor
              height="100%"
              defaultLanguage="markdown"
              value={content}
              onChange={handleContentChange}
              onMount={handleEditorDidMount}
              loading={
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
                    <p className="text-sm text-muted-foreground">
                      Loading editor...
                    </p>
                  </div>
                </div>
              }
              options={{
                wordWrap: 'on',
                lineNumbers: 'on',
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                fontFamily: 'Georgia, serif',
                lineHeight: 1.6,
                padding: { top: 20, bottom: 20 },
                theme: 'vs-light',
                automaticLayout: true,
                contextmenu: true,
                find: {
                  addExtraSpaceOnTop: false,
                  autoFindInSelection: 'never',
                  seedSearchStringFromSelection: 'always',
                },
              }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
