'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  History,
  Eye,
  RotateCcw,
  Calendar,
  FileText,
  Diff,
} from 'lucide-react';
import type { ChapterVersion } from '@/types/database';

interface VersionHistoryProps {
  versions: ChapterVersion[];
  currentContent: string;
  onRestoreVersion: (version: number) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

interface DiffViewProps {
  oldText: string;
  newText: string;
  oldLabel: string;
  newLabel: string;
}

// Simple diff component since we couldn't install react-diff-viewer
function DiffView({ oldText, newText, oldLabel, newLabel }: DiffViewProps) {
  const diffLines = useMemo(() => {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const maxLines = Math.max(oldLines.length, newLines.length);

    const result = [];
    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i] || '';
      const newLine = newLines[i] || '';

      if (oldLine === newLine) {
        result.push({ type: 'equal', oldLine, newLine, lineNumber: i + 1 });
      } else if (oldLine && newLine) {
        result.push({ type: 'modified', oldLine, newLine, lineNumber: i + 1 });
      } else if (oldLine) {
        result.push({
          type: 'removed',
          oldLine,
          newLine: '',
          lineNumber: i + 1,
        });
      } else {
        result.push({ type: 'added', oldLine: '', newLine, lineNumber: i + 1 });
      }
    }

    return result;
  }, [oldText, newText]);

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 border-b p-3">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-sm font-medium text-destructive">{oldLabel}</div>
          <div className="text-sm font-medium text-green-600">{newLabel}</div>
        </div>
      </div>

      {/* Diff Content */}
      <ScrollArea className="h-[400px]">
        <div className="grid grid-cols-2 gap-0">
          {/* Old Content */}
          <div className="border-r">
            {diffLines.map((line, index) => (
              <div
                key={`old-${index}`}
                className={`
                  px-3 py-1 text-sm font-mono border-b border-muted/30
                  ${line.type === 'removed' ? 'bg-destructive/10 text-destructive' : ''}
                  ${line.type === 'modified' ? 'bg-yellow-50 text-yellow-800' : ''}
                  ${line.type === 'equal' ? 'text-muted-foreground' : ''}
                `}
              >
                <span className="text-xs text-muted-foreground mr-2 w-8 inline-block">
                  {line.oldLine ? line.lineNumber : ''}
                </span>
                {line.oldLine || ' '}
              </div>
            ))}
          </div>

          {/* New Content */}
          <div>
            {diffLines.map((line, index) => (
              <div
                key={`new-${index}`}
                className={`
                  px-3 py-1 text-sm font-mono border-b border-muted/30
                  ${line.type === 'added' ? 'bg-green-50 text-green-800' : ''}
                  ${line.type === 'modified' ? 'bg-yellow-50 text-yellow-800' : ''}
                  ${line.type === 'equal' ? 'text-muted-foreground' : ''}
                `}
              >
                <span className="text-xs text-muted-foreground mr-2 w-8 inline-block">
                  {line.newLine ? line.lineNumber : ''}
                </span>
                {line.newLine || ' '}
              </div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}

export function VersionHistory({
  versions,
  currentContent,
  onRestoreVersion,
  isLoading = false,
  className = '',
}: VersionHistoryProps) {
  const [selectedVersion, setSelectedVersion] = useState<ChapterVersion | null>(
    null
  );
  const [isRestoring, setIsRestoring] = useState(false);

  // Sort versions by version number (descending)
  const sortedVersions = useMemo(() => {
    return [...versions].sort((a, b) => b.version - a.version);
  }, [versions]);

  // Handle version restoration
  const handleRestore = useCallback(
    async (version: number) => {
      if (isRestoring) return;

      try {
        setIsRestoring(true);
        await onRestoreVersion(version);
        setSelectedVersion(null);
      } catch (error) {
        console.error('Failed to restore version:', error);
      } finally {
        setIsRestoring(false);
      }
    },
    [onRestoreVersion, isRestoring]
  );

  // Format version date
  const formatVersionDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  // Get word count difference
  const getWordCountDiff = (
    version: ChapterVersion,
    previousVersion?: ChapterVersion
  ) => {
    if (!previousVersion) return null;
    const diff = version.wordCount - previousVersion.wordCount;
    return diff;
  };

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
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Version History ({versions.length})
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Version List */}
      {sortedVersions.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No version history</h3>
            <p className="text-sm text-muted-foreground">
              Version history will appear here as you make changes to your
              chapter.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sortedVersions.map((version, index) => {
            const previousVersion = sortedVersions[index + 1];
            const wordCountDiff = getWordCountDiff(version, previousVersion);
            const isLatest = index === 0;

            return (
              <Card
                key={version.id}
                className={`
                  transition-all duration-200 hover:shadow-md
                  ${selectedVersion?.id === version.id ? 'ring-2 ring-primary' : ''}
                `}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={isLatest ? 'default' : 'secondary'}>
                          Version {version.version}
                        </Badge>
                        {isLatest && (
                          <Badge
                            variant="outline"
                            className="text-green-600 border-green-600"
                          >
                            Current
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatVersionDate(version.createdAt)}
                        </div>
                        <div className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          {version.wordCount.toLocaleString()} words
                        </div>
                        {wordCountDiff !== null && (
                          <div
                            className={`
                              flex items-center gap-1
                              ${wordCountDiff > 0 ? 'text-green-600' : wordCountDiff < 0 ? 'text-red-600' : ''}
                            `}
                          >
                            {wordCountDiff > 0 ? '+' : ''}
                            {wordCountDiff.toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Preview Button */}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedVersion(version)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh]">
                          <DialogHeader>
                            <DialogTitle>
                              Version {version.version} Preview
                            </DialogTitle>
                            <DialogDescription>
                              Created on {formatVersionDate(version.createdAt)}{' '}
                              • {version.wordCount.toLocaleString()} words
                            </DialogDescription>
                          </DialogHeader>
                          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
                            <div className="whitespace-pre-wrap text-sm">
                              {version.content}
                            </div>
                          </ScrollArea>
                        </DialogContent>
                      </Dialog>

                      {/* Compare Button */}
                      {!isLatest && (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <Diff className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-6xl max-h-[80vh]">
                            <DialogHeader>
                              <DialogTitle>Compare Versions</DialogTitle>
                              <DialogDescription>
                                Comparing Version {version.version} with current
                                version
                              </DialogDescription>
                            </DialogHeader>
                            <DiffView
                              oldText={version.content}
                              newText={currentContent}
                              oldLabel={`Version ${version.version} (${formatVersionDate(version.createdAt)})`}
                              newLabel="Current Version"
                            />
                          </DialogContent>
                        </Dialog>
                      )}

                      {/* Restore Button */}
                      {!isLatest && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleRestore(version.version)}
                          disabled={isRestoring}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          <RotateCcw className="h-4 w-4" />
                          {isRestoring ? 'Restoring...' : 'Restore'}
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
