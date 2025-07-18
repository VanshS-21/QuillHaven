'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Eye,
  Users,
  BookOpen,
  Globe,
  Clock,
  Search,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type {
  CharacterWithRelationships,
  PlotThreadWithCharacters,
  WorldElementWithRelations,
  TimelineEvent,
  CharacterRole,
  PlotThreadStatus,
  WorldElementType,
} from '@/types/database';

interface ContextViewerProps {
  projectId: string;
}

interface ProjectContextData {
  characters: CharacterWithRelationships[];
  plotThreads: PlotThreadWithCharacters[];
  worldElements: WorldElementWithRelations[];
  timelineEvents: TimelineEvent[];
}

const roleColors = {
  PROTAGONIST: 'bg-blue-100 text-blue-800',
  ANTAGONIST: 'bg-red-100 text-red-800',
  SUPPORTING: 'bg-green-100 text-green-800',
  MINOR: 'bg-gray-100 text-gray-800',
};

const statusColors = {
  INTRODUCED: 'bg-blue-100 text-blue-800',
  DEVELOPING: 'bg-yellow-100 text-yellow-800',
  CLIMAX: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

const typeColors = {
  LOCATION: 'bg-blue-100 text-blue-800',
  RULE: 'bg-purple-100 text-purple-800',
  CULTURE: 'bg-green-100 text-green-800',
  HISTORY: 'bg-orange-100 text-orange-800',
};

export function ContextViewer({ projectId }: ContextViewerProps) {
  const [contextData, setContextData] = useState<ProjectContextData>({
    characters: [],
    plotThreads: [],
    worldElements: [],
    timelineEvents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [characterFilter, setCharacterFilter] = useState<CharacterRole | 'ALL'>(
    'ALL'
  );
  const [plotFilter, setPlotFilter] = useState<PlotThreadStatus | 'ALL'>('ALL');
  const [worldFilter, setWorldFilter] = useState<WorldElementType | 'ALL'>(
    'ALL'
  );

  const fetchContextData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/context`);
      if (!response.ok) {
        throw new Error('Failed to fetch project context');
      }
      const data = await response.json();
      setContextData(data.data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load project context'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchContextData();
  }, [fetchContextData]);

  const filterCharacters = () => {
    return contextData.characters.filter((character) => {
      const matchesSearch =
        character.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (character.description || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesFilter =
        characterFilter === 'ALL' || character.role === characterFilter;
      return matchesSearch && matchesFilter;
    });
  };

  const filterPlotThreads = () => {
    return contextData.plotThreads.filter((plotThread) => {
      const matchesSearch =
        plotThread.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (plotThread.description || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesFilter =
        plotFilter === 'ALL' || plotThread.status === plotFilter;
      return matchesSearch && matchesFilter;
    });
  };

  const filterWorldElements = () => {
    return contextData.worldElements.filter((element) => {
      const matchesSearch =
        element.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (element.description || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase());
      const matchesFilter =
        worldFilter === 'ALL' || element.type === worldFilter;
      return matchesSearch && matchesFilter;
    });
  };

  const filterTimelineEvents = () => {
    return contextData.timelineEvents.filter((event) => {
      return (
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (event.description || '')
          .toLowerCase()
          .includes(searchTerm.toLowerCase())
      );
    });
  };

  const getContextStats = () => {
    return {
      totalCharacters: contextData.characters.length,
      totalPlotThreads: contextData.plotThreads.length,
      totalWorldElements: contextData.worldElements.length,
      totalTimelineEvents: contextData.timelineEvents.length,
      activePlotThreads: contextData.plotThreads.filter(
        (pt) => pt.status === 'DEVELOPING' || pt.status === 'CLIMAX'
      ).length,
      majorCharacters: contextData.characters.filter(
        (c) => c.role === 'PROTAGONIST' || c.role === 'ANTAGONIST'
      ).length,
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading project context...</p>
        </div>
      </div>
    );
  }

  const stats = getContextStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Context Viewer</h2>
        </div>
        <Button onClick={fetchContextData} variant="outline">
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Context Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Characters</p>
              <p className="text-2xl font-bold">{stats.totalCharacters}</p>
              <p className="text-xs text-gray-500">
                {stats.majorCharacters} major
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">Plot Threads</p>
              <p className="text-2xl font-bold">{stats.totalPlotThreads}</p>
              <p className="text-xs text-gray-500">
                {stats.activePlotThreads} active
              </p>
            </div>
            <BookOpen className="h-8 w-8 text-green-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">
                World Elements
              </p>
              <p className="text-2xl font-bold">{stats.totalWorldElements}</p>
            </div>
            <Globe className="h-8 w-8 text-purple-500" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center justify-between p-4">
            <div>
              <p className="text-sm font-medium text-gray-600">
                Timeline Events
              </p>
              <p className="text-2xl font-bold">{stats.totalTimelineEvents}</p>
            </div>
            <Clock className="h-8 w-8 text-orange-500" />
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search across all context..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Filter className="h-5 w-5 text-gray-400 mt-2" />
          <span className="text-sm text-gray-600 mt-2">Filters:</span>
        </div>
      </div>

      {/* Context Tabs */}
      <Tabs defaultValue="characters" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="characters" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Characters ({filterCharacters().length})
          </TabsTrigger>
          <TabsTrigger value="plot-threads" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Plot Threads ({filterPlotThreads().length})
          </TabsTrigger>
          <TabsTrigger
            value="world-elements"
            className="flex items-center gap-2"
          >
            <Globe className="h-4 w-4" />
            World ({filterWorldElements().length})
          </TabsTrigger>
          <TabsTrigger value="timeline" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Timeline ({filterTimelineEvents().length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="characters" className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={characterFilter}
              onValueChange={(value: CharacterRole | 'ALL') =>
                setCharacterFilter(value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Roles</SelectItem>
                <SelectItem value="PROTAGONIST">Protagonist</SelectItem>
                <SelectItem value="ANTAGONIST">Antagonist</SelectItem>
                <SelectItem value="SUPPORTING">Supporting</SelectItem>
                <SelectItem value="MINOR">Minor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filterCharacters().map((character) => (
              <Card
                key={character.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{character.name}</CardTitle>
                    <Badge className={roleColors[character.role]}>
                      {character.role}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {character.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {character.description}
                    </p>
                  )}
                  <div className="space-y-1 text-xs text-gray-500">
                    {character.firstAppearance && (
                      <p>
                        <strong>First appears:</strong>{' '}
                        {character.firstAppearance}
                      </p>
                    )}
                    {character.relationships.length > 0 && (
                      <p>
                        <strong>Relationships:</strong>{' '}
                        {character.relationships.length}
                      </p>
                    )}
                    {character.plotThreads.length > 0 && (
                      <p>
                        <strong>Plot threads:</strong>{' '}
                        {character.plotThreads.length}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="plot-threads" className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={plotFilter}
              onValueChange={(value: PlotThreadStatus | 'ALL') =>
                setPlotFilter(value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Status</SelectItem>
                <SelectItem value="INTRODUCED">Introduced</SelectItem>
                <SelectItem value="DEVELOPING">Developing</SelectItem>
                <SelectItem value="CLIMAX">Climax</SelectItem>
                <SelectItem value="RESOLVED">Resolved</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-4">
            {filterPlotThreads().map((plotThread) => (
              <Card
                key={plotThread.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">
                      {plotThread.title}
                    </CardTitle>
                    <Badge className={statusColors[plotThread.status]}>
                      {plotThread.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {plotThread.description && (
                    <p className="text-sm text-gray-600 mb-3">
                      {plotThread.description}
                    </p>
                  )}
                  {plotThread.relatedCharacters.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      <span className="text-xs text-gray-500 mr-2">
                        Characters:
                      </span>
                      {plotThread.relatedCharacters.map((character) => (
                        <Badge
                          key={character.id}
                          variant="outline"
                          className="text-xs"
                        >
                          {character.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="world-elements" className="space-y-4">
          <div className="flex gap-2">
            <Select
              value={worldFilter}
              onValueChange={(value: WorldElementType | 'ALL') =>
                setWorldFilter(value)
              }
            >
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="LOCATION">Location</SelectItem>
                <SelectItem value="RULE">Rule</SelectItem>
                <SelectItem value="CULTURE">Culture</SelectItem>
                <SelectItem value="HISTORY">History</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {filterWorldElements().map((element) => (
              <Card
                key={element.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{element.name}</CardTitle>
                    <Badge className={typeColors[element.type]}>
                      {element.type}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {element.description && (
                    <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                      {element.description}
                    </p>
                  )}
                  {element.significance && (
                    <div className="mb-2 p-2 bg-blue-50 rounded">
                      <p className="text-xs font-medium text-blue-800 mb-1">
                        Significance:
                      </p>
                      <p className="text-xs text-blue-700 line-clamp-1">
                        {element.significance}
                      </p>
                    </div>
                  )}
                  {element.relatedElements.length > 0 && (
                    <p className="text-xs text-gray-500">
                      <strong>Related elements:</strong>{' '}
                      {element.relatedElements.length}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <div className="space-y-4">
            {filterTimelineEvents().length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-8">
                  <Clock className="h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-gray-600">No timeline events found</p>
                </CardContent>
              </Card>
            ) : (
              filterTimelineEvents().map((event) => (
                <Card
                  key={event.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg">{event.title}</CardTitle>
                      <Badge variant="outline">{event.eventDate}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {event.description && (
                      <p className="text-sm text-gray-600">
                        {event.description}
                      </p>
                    )}
                    {event.importance && event.importance > 1 && (
                      <div className="mt-2">
                        <Badge variant="secondary">
                          Importance: {event.importance}/5
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
