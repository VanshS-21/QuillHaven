'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Globe,
  MapPin,
  Scroll,
  Users,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  WorldElementWithRelations,
  WorldElementType,
} from '@/types/database';

interface WorldBuilderProps {
  projectId: string;
}

interface WorldElementFormData {
  type: WorldElementType;
  name: string;
  description: string;
  significance: string;
  relatedElementIds: string[];
}

const initialFormData: WorldElementFormData = {
  type: 'LOCATION',
  name: '',
  description: '',
  significance: '',
  relatedElementIds: [],
};

const typeColors = {
  LOCATION: 'bg-blue-100 text-blue-800',
  RULE: 'bg-purple-100 text-purple-800',
  CULTURE: 'bg-green-100 text-green-800',
  HISTORY: 'bg-orange-100 text-orange-800',
};

const typeLabels = {
  LOCATION: 'Location',
  RULE: 'Rule',
  CULTURE: 'Culture',
  HISTORY: 'History',
};

const typeIcons = {
  LOCATION: MapPin,
  RULE: Scroll,
  CULTURE: Users,
  HISTORY: Clock,
};

export function WorldBuilder({ projectId }: WorldBuilderProps) {
  const [worldElements, setWorldElements] = useState<
    WorldElementWithRelations[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingElement, setEditingElement] =
    useState<WorldElementWithRelations | null>(null);
  const [formData, setFormData] =
    useState<WorldElementFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<WorldElementType>('LOCATION');

  const fetchWorldElements = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/world-elements`);
      if (!response.ok) {
        throw new Error('Failed to fetch world elements');
      }
      const data = await response.json();
      setWorldElements(data.data || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load world elements'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchWorldElements();
  }, [fetchWorldElements]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      const url = editingElement
        ? `/api/projects/${projectId}/world-elements/${editingElement.id}`
        : `/api/projects/${projectId}/world-elements`;

      const method = editingElement ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingElement ? 'update' : 'create'} world element`
        );
      }

      await fetchWorldElements();
      handleCloseDialog();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save world element'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (elementId: string) => {
    if (!confirm('Are you sure you want to delete this world element?')) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/world-elements/${elementId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete world element');
      }

      await fetchWorldElements();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete world element'
      );
    }
  };

  const handleEdit = (element: WorldElementWithRelations) => {
    setEditingElement(element);
    setFormData({
      type: element.type,
      name: element.name,
      description: element.description || '',
      significance: element.significance || '',
      relatedElementIds: element.relatedElements.map(
        (rel) => rel.relatedElement.id
      ),
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingElement(null);
    setFormData(initialFormData);
  };

  const handleRelatedElementToggle = (elementId: string) => {
    setFormData((prev) => ({
      ...prev,
      relatedElementIds: prev.relatedElementIds.includes(elementId)
        ? prev.relatedElementIds.filter((id) => id !== elementId)
        : [...prev.relatedElementIds, elementId],
    }));
  };

  const getElementsByType = (type: WorldElementType) => {
    return worldElements.filter((element) => element.type === type);
  };

  const getAvailableRelatedElements = () => {
    return worldElements.filter(
      (element) =>
        element.id !== editingElement?.id &&
        !formData.relatedElementIds.includes(element.id)
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading world elements...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Globe className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">World Builder</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() =>
                setFormData({ ...initialFormData, type: activeTab })
              }
            >
              <Plus className="h-4 w-4 mr-2" />
              Add {typeLabels[activeTab]}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingElement
                  ? 'Edit World Element'
                  : 'Add New World Element'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    placeholder="Element name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="type">Type</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value: WorldElementType) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOCATION">Location</SelectItem>
                      <SelectItem value="RULE">Rule</SelectItem>
                      <SelectItem value="CULTURE">Culture</SelectItem>
                      <SelectItem value="HISTORY">History</SelectItem>
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
                  placeholder="Detailed description of this world element..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="significance">Significance</Label>
                <Textarea
                  id="significance"
                  value={formData.significance}
                  onChange={(e) =>
                    setFormData({ ...formData, significance: e.target.value })
                  }
                  placeholder="Why is this element important to your story?"
                  rows={2}
                />
              </div>
              {worldElements.length > 0 && (
                <div>
                  <Label>Related Elements</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2 max-h-32 overflow-y-auto">
                    {getAvailableRelatedElements().map((element) => {
                      const Icon = typeIcons[element.type];
                      return (
                        <label
                          key={element.id}
                          className="flex items-center space-x-2 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={formData.relatedElementIds.includes(
                              element.id
                            )}
                            onChange={() =>
                              handleRelatedElementToggle(element.id)
                            }
                            className="rounded"
                          />
                          <Icon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{element.name}</span>
                        </label>
                      );
                    })}
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
                    : editingElement
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

      {worldElements.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Globe className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No world elements yet
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Start building your story world by adding locations, rules,
              cultures, and history.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Element
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as WorldElementType)}
        >
          <TabsList className="grid w-full grid-cols-4">
            {Object.entries(typeLabels).map(([type, label]) => {
              const count = getElementsByType(type as WorldElementType).length;
              const Icon = typeIcons[type as WorldElementType];
              return (
                <TabsTrigger
                  key={type}
                  value={type}
                  className="flex items-center gap-2"
                >
                  <Icon className="h-4 w-4" />
                  {label} ({count})
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.keys(typeLabels).map((type) => {
            const elements = getElementsByType(type as WorldElementType);
            const Icon = typeIcons[type as WorldElementType];

            return (
              <TabsContent key={type} value={type} className="space-y-4">
                {elements.length === 0 ? (
                  <Card>
                    <CardContent className="flex flex-col items-center justify-center py-8">
                      <Icon className="h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-gray-600 mb-4">
                        No {typeLabels[type as WorldElementType].toLowerCase()}s
                        yet
                      </p>
                      <Button
                        onClick={() => {
                          setFormData({
                            ...initialFormData,
                            type: type as WorldElementType,
                          });
                          setIsDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add {typeLabels[type as WorldElementType]}
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    {elements.map((element) => (
                      <Card
                        key={element.id}
                        className="hover:shadow-md transition-shadow"
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-2">
                              <Icon className="h-5 w-5 text-gray-500 mt-1" />
                              <div>
                                <CardTitle className="text-lg">
                                  {element.name}
                                </CardTitle>
                                <Badge
                                  className={`mt-1 ${typeColors[element.type]}`}
                                >
                                  {typeLabels[element.type]}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(element)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(element.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {element.description && (
                            <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                              {element.description}
                            </p>
                          )}
                          {element.significance && (
                            <div className="mb-3 p-2 bg-blue-50 rounded-lg">
                              <p className="text-xs font-medium text-blue-800 mb-1">
                                Significance:
                              </p>
                              <p className="text-xs text-blue-700 line-clamp-2">
                                {element.significance}
                              </p>
                            </div>
                          )}
                          {element.relatedElements.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              <span className="text-xs text-gray-500 mr-2">
                                Related:
                              </span>
                              {element.relatedElements
                                .slice(0, 3)
                                .map((relation) => {
                                  const RelatedIcon =
                                    typeIcons[relation.relatedElement.type];
                                  return (
                                    <Badge
                                      key={relation.relatedElement.id}
                                      variant="outline"
                                      className="text-xs flex items-center gap-1"
                                    >
                                      <RelatedIcon className="h-3 w-3" />
                                      {relation.relatedElement.name}
                                    </Badge>
                                  );
                                })}
                              {element.relatedElements.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{element.relatedElements.length - 3} more
                                </Badge>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}
    </div>
  );
}
