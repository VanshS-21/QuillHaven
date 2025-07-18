'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  BookOpen,
  TrendingUp,
  CheckCircle,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type {
  PlotThreadWithCharacters,
  PlotThreadStatus,
  CharacterWithRelationships,
} from '@/types/database';

interface PlotTrackerProps {
  projectId: string;
}

interface PlotThreadFormData {
  title: string;
  description: string;
  status: PlotThreadStatus;
  relatedCharacterIds: string[];
}

const initialFormData: PlotThreadFormData = {
  title: '',
  description: '',
  status: 'INTRODUCED',
  relatedCharacterIds: [],
};

const statusColors = {
  INTRODUCED: 'bg-blue-100 text-blue-800',
  DEVELOPING: 'bg-yellow-100 text-yellow-800',
  CLIMAX: 'bg-orange-100 text-orange-800',
  RESOLVED: 'bg-green-100 text-green-800',
};

const statusLabels = {
  INTRODUCED: 'Introduced',
  DEVELOPING: 'Developing',
  CLIMAX: 'Climax',
  RESOLVED: 'Resolved',
};

const statusIcons = {
  INTRODUCED: Clock,
  DEVELOPING: TrendingUp,
  CLIMAX: BookOpen,
  RESOLVED: CheckCircle,
};

export function PlotTracker({ projectId }: PlotTrackerProps) {
  const [plotThreads, setPlotThreads] = useState<PlotThreadWithCharacters[]>(
    []
  );
  const [characters, setCharacters] = useState<CharacterWithRelationships[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPlotThread, setEditingPlotThread] =
    useState<PlotThreadWithCharacters | null>(null);
  const [formData, setFormData] = useState<PlotThreadFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [plotThreadsResponse, charactersResponse] = await Promise.all([
        fetch(`/api/projects/${projectId}/plot-threads`),
        fetch(`/api/projects/${projectId}/characters`),
      ]);

      if (!plotThreadsResponse.ok || !charactersResponse.ok) {
        throw new Error('Failed to fetch data');
      }

      const [plotThreadsData, charactersData] = await Promise.all([
        plotThreadsResponse.json(),
        charactersResponse.json(),
      ]);

      setPlotThreads(plotThreadsData.data || []);
      setCharacters(charactersData.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    try {
      setSubmitting(true);
      const url = editingPlotThread
        ? `/api/projects/${projectId}/plot-threads/${editingPlotThread.id}`
        : `/api/projects/${projectId}/plot-threads`;

      const method = editingPlotThread ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingPlotThread ? 'update' : 'create'} plot thread`
        );
      }

      await fetchData();
      handleCloseDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save plot thread'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (plotThreadId: string) => {
    if (!confirm('Are you sure you want to delete this plot thread?')) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/plot-threads/${plotThreadId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete plot thread');
      }

      await fetchData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete plot thread'
      );
    }
  };

  const handleEdit = (plotThread: PlotThreadWithCharacters) => {
    setEditingPlotThread(plotThread);
    setFormData({
      title: plotThread.title,
      description: plotThread.description || '',
      status: plotThread.status,
      relatedCharacterIds: plotThread.relatedCharacters.map((char) => char.id),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingPlotThread(null);
    setFormData(initialFormData);
  };

  const handleCharacterToggle = (characterId: string) => {
    setFormData((prev) => ({
      ...prev,
      relatedCharacterIds: prev.relatedCharacterIds.includes(characterId)
        ? prev.relatedCharacterIds.filter((id) => id !== characterId)
        : [...prev.relatedCharacterIds, characterId],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading plot threads...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Plot Tracker</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Plot Thread
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingPlotThread ? 'Edit Plot Thread' : 'Add New Plot Thread'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="title">Title *</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) =>
                      setFormData({ ...formData, title: e.target.value })
                    }
                    placeholder="Plot thread title"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value: PlotThreadStatus) =>
                      setFormData({ ...formData, status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INTRODUCED">Introduced</SelectItem>
                      <SelectItem value="DEVELOPING">Developing</SelectItem>
                      <SelectItem value="CLIMAX">Climax</SelectItem>
                      <SelectItem value="RESOLVED">Resolved</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Describe this plot thread..."
                  rows={3}
                />
              </div>
              {characters.length > 0 && (
                <div>
                  <Label>Related Characters</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                    {characters.map((character) => (
                      <label
                        key={character.id}
                        className="flex items-center space-x-2 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={formData.relatedCharacterIds.includes(
                            character.id
                          )}
                          onChange={() => handleCharacterToggle(character.id)}
                          className="rounded"
                        />
                        <span className="text-sm">{character.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting
                    ? 'Saving...'
                    : editingPlotThread
                      ? 'Update'
                      : 'Create'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {plotThreads.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No plot threads yet
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Start tracking your story&apos;s plot threads to maintain
              narrative consistency.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Plot Thread
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Status Overview */}
          <div className="grid grid-cols-4 gap-4">
            {Object.entries(statusLabels).map(([status, label]) => {
              const count = plotThreads.filter(
                (pt) => pt.status === status
              ).length;
              const Icon = statusIcons[status as PlotThreadStatus];
              return (
                <Card key={status}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="text-sm font-medium text-gray-600">
                        {label}
                      </p>
                      <p className="text-2xl font-bold">{count}</p>
                    </div>
                    <Icon className="h-8 w-8 text-gray-400" />
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Plot Threads List */}
          <div className="space-y-4">
            {plotThreads.map((plotThread) => {
              const Icon = statusIcons[plotThread.status];
              return (
                <Card
                  key={plotThread.id}
                  className="hover:shadow-md transition-shadow"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <Icon className="h-5 w-5 text-gray-500 mt-1" />
                        <div>
                          <CardTitle className="text-lg">
                            {plotThread.title}
                          </CardTitle>
                          <Badge
                            className={`mt-1 ${statusColors[plotThread.status]}`}
                          >
                            {statusLabels[plotThread.status]}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(plotThread)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(plotThread.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
