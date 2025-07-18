'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  CharacterDatabase,
  PlotTracker,
  WorldBuilder,
  ContextViewer,
  ConsistencyAlerts,
} from '@/components/context';
import { Users, BookOpen, Globe, Eye, CheckCircle } from 'lucide-react';

export default function ProjectPage() {
  const params = useParams();
  const projectId = params.id as string;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Project Context Management</h1>
        <p className="text-gray-600">
          Manage your story&apos;s characters, plot threads, world-building
          elements, and maintain consistency.
        </p>
      </div>

      <Tabs defaultValue="characters" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="characters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Characters
          </TabsTrigger>
          <TabsTrigger value="plot-threads" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Plot Threads
          </TabsTrigger>
          <TabsTrigger
            value="world-builder"
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            World Builder
          </TabsTrigger>
          <TabsTrigger
            value="context-viewer"
            className="flex items-center gap-2"
          >
            <Eye className="h-4 w-4" />
            Context Viewer
          </TabsTrigger>
          <TabsTrigger value="consistency" className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            Consistency
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters">
          <CharacterDatabase projectId={projectId} />
        </TabsContent>

        <TabsContent value="plot-threads">
          <PlotTracker projectId={projectId} />
        </TabsContent>

        <TabsContent value="world-builder">
          <WorldBuilder projectId={projectId} />
        </TabsContent>

        <TabsContent value="context-viewer">
          <ContextViewer projectId={projectId} />
        </TabsContent>

        <TabsContent value="consistency">
          <ConsistencyAlerts projectId={projectId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
