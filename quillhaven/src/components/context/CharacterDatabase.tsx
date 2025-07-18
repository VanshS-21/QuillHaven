'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Edit, Trash2, Users, User } from 'lucide-react';
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
  CharacterWithRelationships,
  CharacterRole,
} from '@/types/database';

interface CharacterDatabaseProps {
  projectId: string;
}

interface CharacterFormData {
  name: string;
  description: string;
  role: CharacterRole;
  developmentArc: string;
  firstAppearance: string;
}

const initialFormData: CharacterFormData = {
  name: '',
  description: '',
  role: 'MINOR',
  developmentArc: '',
  firstAppearance: '',
};

const roleColors = {
  PROTAGONIST: 'bg-blue-100 text-blue-800',
  ANTAGONIST: 'bg-red-100 text-red-800',
  SUPPORTING: 'bg-green-100 text-green-800',
  MINOR: 'bg-gray-100 text-gray-800',
};

const roleLabels = {
  PROTAGONIST: 'Protagonist',
  ANTAGONIST: 'Antagonist',
  SUPPORTING: 'Supporting',
  MINOR: 'Minor',
};

export function CharacterDatabase({ projectId }: CharacterDatabaseProps) {
  const [characters, setCharacters] = useState<CharacterWithRelationships[]>(
    []
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] =
    useState<CharacterWithRelationships | null>(null);
  const [formData, setFormData] = useState<CharacterFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  const fetchCharacters = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${projectId}/characters`);
      if (!response.ok) {
        throw new Error('Failed to fetch characters');
      }
      const data = await response.json();
      setCharacters(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load characters'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchCharacters();
  }, [fetchCharacters]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    try {
      setSubmitting(true);
      const url = editingCharacter
        ? `/api/projects/${projectId}/characters/${editingCharacter.id}`
        : `/api/projects/${projectId}/characters`;

      const method = editingCharacter ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(
          `Failed to ${editingCharacter ? 'update' : 'create'} character`
        );
      }

      await fetchCharacters();
      handleCloseDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save character');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (characterId: string) => {
    if (!confirm('Are you sure you want to delete this character?')) return;

    try {
      const response = await fetch(
        `/api/projects/${projectId}/characters/${characterId}`,
        {
          method: 'DELETE',
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete character');
      }

      await fetchCharacters();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to delete character'
      );
    }
  };

  const handleEdit = (character: CharacterWithRelationships) => {
    setEditingCharacter(character);
    setFormData({
      name: character.name,
      description: character.description || '',
      role: character.role,
      developmentArc: character.developmentArc || '',
      firstAppearance: character.firstAppearance || '',
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingCharacter(null);
    setFormData(initialFormData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading characters...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Character Database</h2>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setFormData(initialFormData)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Character
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingCharacter ? 'Edit Character' : 'Add New Character'}
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
                    placeholder="Character name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value: CharacterRole) =>
                      setFormData({ ...formData, role: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PROTAGONIST">Protagonist</SelectItem>
                      <SelectItem value="ANTAGONIST">Antagonist</SelectItem>
                      <SelectItem value="SUPPORTING">Supporting</SelectItem>
                      <SelectItem value="MINOR">Minor</SelectItem>
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
                  placeholder="Character description, personality, appearance..."
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="developmentArc">Development Arc</Label>
                <Textarea
                  id="developmentArc"
                  value={formData.developmentArc}
                  onChange={(e) =>
                    setFormData({ ...formData, developmentArc: e.target.value })
                  }
                  placeholder="How does this character change throughout the story?"
                  rows={2}
                />
              </div>
              <div>
                <Label htmlFor="firstAppearance">First Appearance</Label>
                <Input
                  id="firstAppearance"
                  value={formData.firstAppearance}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      firstAppearance: e.target.value,
                    })
                  }
                  placeholder="Chapter or scene where character first appears"
                />
              </div>
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
                    : editingCharacter
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

      {characters.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <User className="h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No characters yet
            </h3>
            <p className="text-gray-600 text-center mb-4">
              Start building your character database by adding your first
              character.
            </p>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add First Character
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {characters.map((character) => (
            <Card
              key={character.id}
              className="hover:shadow-md transition-shadow"
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{character.name}</CardTitle>
                    <Badge className={`mt-1 ${roleColors[character.role]}`}>
                      {roleLabels[character.role]}
                    </Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(character)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(character.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {character.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                    {character.description}
                  </p>
                )}
                {character.firstAppearance && (
                  <div className="text-xs text-gray-500 mb-2">
                    <strong>First appears:</strong> {character.firstAppearance}
                  </div>
                )}
                {character.relationships.length > 0 && (
                  <div className="text-xs text-gray-500">
                    <strong>Relationships:</strong>{' '}
                    {character.relationships.length}
                  </div>
                )}
                {character.developmentArc && (
                  <div className="mt-2 pt-2 border-t border-gray-100">
                    <p className="text-xs text-gray-600 line-clamp-2">
                      <strong>Arc:</strong> {character.developmentArc}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
