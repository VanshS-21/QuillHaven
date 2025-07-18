'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AuthGuard } from '@/components/auth';
import {
  ChapterEditor,
  ChapterGenerator,
  ChapterList,
  VersionHistory,
} from '@/components/chapter';
import { useAuth } from '@/components/auth/AuthContext';
import {
  createChapter,
  updateChapter,
  deleteChapter,
  listChapters,
  getChapter,
  generateChapter,
  reorderChapters,
  restoreChapterVersion,
} from '@/services/chapterService';
import type {
  Chapter,
  ChapterWithVersions,
  ChapterVersion,
} from '@/types/database';
import type { ChapterGenerationData } from '@/services/chapterService';
import { ArrowLeft, Plus, Save, Wand2, History, List } from 'lucide-react';

export default function ChaptersPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params.id as string;

  // State
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] =
    useState<ChapterWithVersions | null>(null);
  const [chapterVersions, setChapterVersions] = useState<ChapterVersion[]>([]);
  const [activeTab, setActiveTab] = useState<
    'list' | 'editor' | 'generator' | 'history'
  >('list');
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState(0);

  // Load chapters
  const loadChapters = useCallback(async () => {
    if (!user || !projectId) return;

    try {
      setIsLoading(true);
      const result = await listChapters(projectId, user.id);
      setChapters(result.chapters);
    } catch (error) {
      console.error('Failed to load chapters:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, projectId]);

  // Load selected chapter
  const loadSelectedChapter = useCallback(
    async (chapterId: string) => {
      if (!user) return;

      try {
        const chapter = await getChapter(chapterId, user.id);
        if (chapter) {
          setSelectedChapter(chapter);
          setChapterVersions(chapter.versions);
        }
      } catch (error) {
        console.error('Failed to load chapter:', error);
      }
    },
    [user]
  );

  // Load chapter versions (currently unused but may be needed for future features)
  // const loadChapterVersions = useCallback(
  //   async (chapterId: string) => {
  //     if (!user) return;

  //     try {
  //       const versions = await getChapterVersions(chapterId, user.id);
  //       setChapterVersions(versions);
  //     } catch (error) {
  //       console.error('Failed to load chapter versions:', error);
  //     }
  //   },
  //   [user]
  // );

  // Handle chapter selection
  const handleChapterSelect = useCallback(
    async (chapterId: string) => {
      await loadSelectedChapter(chapterId);
      setActiveTab('editor');
    },
    [loadSelectedChapter]
  );

  // Handle chapter creation
  const handleChapterCreate = useCallback(async () => {
    if (!user || !projectId) return;

    try {
      const newChapter = await createChapter(projectId, user.id, {
        title: `Chapter ${chapters.length + 1}`,
        content: '',
      });

      await loadChapters();
      await loadSelectedChapter(newChapter.id);
      setActiveTab('editor');
    } catch (error) {
      console.error('Failed to create chapter:', error);
    }
  }, [user, projectId, chapters.length, loadChapters, loadSelectedChapter]);

  // Handle chapter save
  const handleChapterSave = useCallback(
    async (chapterId: string, data: { title?: string; content?: string }) => {
      if (!user) return;

      try {
        const updatedChapter = await updateChapter(chapterId, user.id, data);
        if (updatedChapter) {
          // Reload chapters list and selected chapter
          await loadChapters();
          await loadSelectedChapter(chapterId);
        }
      } catch (error) {
        console.error('Failed to save chapter:', error);
        throw error;
      }
    },
    [user, loadChapters, loadSelectedChapter]
  );

  // Handle chapter auto-save
  const handleChapterAutoSave = useCallback(
    async (chapterId: string, data: { title?: string; content?: string }) => {
      if (!user) return;

      try {
        await updateChapter(chapterId, user.id, data);
        // Silently update without reloading everything
      } catch (error) {
        console.error('Auto-save failed:', error);
        throw error;
      }
    },
    [user]
  );

  // Handle chapter deletion
  const handleChapterDelete = useCallback(
    async (chapterId: string) => {
      if (!user) return;

      if (
        !confirm(
          'Are you sure you want to delete this chapter? This action cannot be undone.'
        )
      ) {
        return;
      }

      try {
        const success = await deleteChapter(chapterId, user.id);
        if (success) {
          await loadChapters();
          if (selectedChapter?.id === chapterId) {
            setSelectedChapter(null);
            setActiveTab('list');
          }
        }
      } catch (error) {
        console.error('Failed to delete chapter:', error);
      }
    },
    [user, loadChapters, selectedChapter]
  );

  // Handle chapter reordering
  const handleChapterReorder = useCallback(
    async (chapterOrders: { id: string; order: number }[]) => {
      if (!user || !projectId) return;

      try {
        await reorderChapters(projectId, user.id, chapterOrders);
        await loadChapters();
      } catch (error) {
        console.error('Failed to reorder chapters:', error);
        throw error;
      }
    },
    [user, projectId, loadChapters]
  );

  // Handle chapter generation
  const handleChapterGenerate = useCallback(
    async (chapterId: string, data: ChapterGenerationData) => {
      if (!user) return;

      try {
        setIsGenerating(true);
        setGenerationProgress(0);

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setGenerationProgress((prev) => Math.min(prev + 10, 90));
        }, 2000);

        await generateChapter(chapterId, user.id, data);

        clearInterval(progressInterval);
        setGenerationProgress(100);

        // Reload chapters and selected chapter
        await loadChapters();
        await loadSelectedChapter(chapterId);

        // Switch to editor tab to show generated content
        setActiveTab('editor');
      } catch (error) {
        console.error('Failed to generate chapter:', error);
        throw error;
      } finally {
        setIsGenerating(false);
        setGenerationProgress(0);
      }
    },
    [user, loadChapters, loadSelectedChapter]
  );

  // Handle version restoration
  const handleVersionRestore = useCallback(
    async (version: number) => {
      if (!user || !selectedChapter) return;

      try {
        await restoreChapterVersion(selectedChapter.id, user.id, version);

        // Reload selected chapter and versions
        await loadSelectedChapter(selectedChapter.id);
        await loadChapters();
      } catch (error) {
        console.error('Failed to restore version:', error);
        throw error;
      }
    },
    [user, selectedChapter, loadSelectedChapter, loadChapters]
  );

  // Load chapters on mount
  useEffect(() => {
    loadChapters();
  }, [loadChapters]);

  return (
    <AuthGuard>
      <div className="container mx-auto py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => router.push(`/project/${projectId}`)}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Project
            </Button>
            <h1 className="text-2xl font-bold">Chapters</h1>
          </div>

          <Button
            onClick={handleChapterCreate}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            New Chapter
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Chapter List Sidebar */}
          <div className="lg:col-span-1">
            <ChapterList
              chapters={chapters}
              selectedChapterId={selectedChapter?.id}
              onChapterSelect={handleChapterSelect}
              onChapterReorder={handleChapterReorder}
              onChapterCreate={handleChapterCreate}
              onChapterEdit={handleChapterSelect}
              onChapterDelete={handleChapterDelete}
              isLoading={isLoading}
            />
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            {selectedChapter ? (
              <Tabs
                value={activeTab}
                onValueChange={(value) =>
                  setActiveTab(
                    value as 'list' | 'editor' | 'generator' | 'history'
                  )
                }
              >
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger
                    value="editor"
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    Editor
                  </TabsTrigger>
                  <TabsTrigger
                    value="generator"
                    className="flex items-center gap-2"
                  >
                    <Wand2 className="h-4 w-4" />
                    Generator
                  </TabsTrigger>
                  <TabsTrigger
                    value="history"
                    className="flex items-center gap-2"
                  >
                    <History className="h-4 w-4" />
                    History
                  </TabsTrigger>
                  <TabsTrigger
                    value="list"
                    className="flex items-center gap-2 lg:hidden"
                  >
                    <List className="h-4 w-4" />
                    List
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="editor" className="mt-6">
                  <ChapterEditor
                    chapter={selectedChapter}
                    onSave={handleChapterSave}
                    onAutoSave={handleChapterAutoSave}
                    isLoading={isLoading}
                  />
                </TabsContent>

                <TabsContent value="generator" className="mt-6">
                  <ChapterGenerator
                    chapter={selectedChapter}
                    onGenerate={handleChapterGenerate}
                    isGenerating={isGenerating}
                    generationProgress={generationProgress}
                  />
                </TabsContent>

                <TabsContent value="history" className="mt-6">
                  <VersionHistory
                    versions={chapterVersions}
                    currentContent={selectedChapter.content}
                    onRestoreVersion={handleVersionRestore}
                    isLoading={isLoading}
                  />
                </TabsContent>

                <TabsContent value="list" className="mt-6 lg:hidden">
                  <ChapterList
                    chapters={chapters}
                    selectedChapterId={selectedChapter?.id}
                    onChapterSelect={handleChapterSelect}
                    onChapterReorder={handleChapterReorder}
                    onChapterCreate={handleChapterCreate}
                    onChapterEdit={handleChapterSelect}
                    onChapterDelete={handleChapterDelete}
                    isLoading={isLoading}
                  />
                </TabsContent>
              </Tabs>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-4">
                    <div className="text-muted-foreground">
                      {chapters.length === 0 ? (
                        <>
                          <h3 className="font-medium mb-2">No chapters yet</h3>
                          <p className="text-sm">
                            Create your first chapter to get started.
                          </p>
                        </>
                      ) : (
                        <>
                          <h3 className="font-medium mb-2">Select a chapter</h3>
                          <p className="text-sm">
                            Choose a chapter from the list to edit or generate
                            content.
                          </p>
                        </>
                      )}
                    </div>
                    <Button
                      onClick={handleChapterCreate}
                      className="flex items-center gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      Create Chapter
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
