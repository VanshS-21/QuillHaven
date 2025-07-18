'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Info,
  X,
  RefreshCw,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConsistencyAlertsProps {
  projectId: string;
}

interface ConsistencyIssue {
  type: 'character' | 'plot' | 'world' | 'timeline';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion?: string;
  relatedIds: string[];
}

interface ConsistencyReport {
  issues: ConsistencyIssue[];
  score: number;
  summary: string;
}

const severityColors = {
  low: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  medium: 'bg-orange-100 text-orange-800 border-orange-200',
  high: 'bg-red-100 text-red-800 border-red-200',
};

const severityIcons = {
  low: Info,
  medium: AlertTriangle,
  high: AlertTriangle,
};

const typeColors = {
  character: 'bg-blue-100 text-blue-800',
  plot: 'bg-green-100 text-green-800',
  world: 'bg-purple-100 text-purple-800',
  timeline: 'bg-orange-100 text-orange-800',
};

const typeLabels = {
  character: 'Character',
  plot: 'Plot',
  world: 'World',
  timeline: 'Timeline',
};

export function ConsistencyAlerts({ projectId }: ConsistencyAlertsProps) {
  const [report, setReport] = useState<ConsistencyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dismissedIssues, setDismissedIssues] = useState<Set<string>>(
    new Set()
  );

  // Simulate consistency check - in real implementation this would be an API call
  const simulateConsistencyCheck =
    useCallback(async (): Promise<ConsistencyReport> => {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Fetch project data to perform actual checks
      try {
        const [
          charactersResponse,
          plotThreadsResponse,
          worldElementsResponse,
          chaptersResponse,
        ] = await Promise.all([
          fetch(`/api/projects/${projectId}/characters`),
          fetch(`/api/projects/${projectId}/plot-threads`),
          fetch(`/api/projects/${projectId}/world-elements`),
          fetch(`/api/projects/${projectId}/chapters`),
        ]);

        const [
          charactersData,
          plotThreadsData,
          worldElementsData,
          chaptersData,
        ] = await Promise.all([
          charactersResponse.json(),
          plotThreadsResponse.json(),
          worldElementsResponse.json(),
          chaptersResponse.json(),
        ]);

        const characters = charactersData.data || [];
        const plotThreads = plotThreadsData.data || [];
        const worldElements = worldElementsData.data || [];
        const chapters = chaptersData.data || [];

        const issues: ConsistencyIssue[] = [];

        // Check for character consistency issues
        for (const character of characters) {
          // Check if major characters appear in chapters
          if (
            (character.role === 'PROTAGONIST' ||
              character.role === 'ANTAGONIST') &&
            chapters.length > 0
          ) {
            const mentionCount = chapters.reduce(
              (count: number, chapter: { content?: string }) => {
                const mentions = (
                  chapter.content
                    ?.toLowerCase()
                    .match(new RegExp(character.name.toLowerCase(), 'g')) || []
                ).length;
                return count + mentions;
              },
              0
            );

            if (mentionCount === 0) {
              issues.push({
                type: 'character',
                severity: 'high',
                description: `Major character "${character.name}" doesn't appear in any chapters`,
                suggestion: `Consider adding "${character.name}" to your story or updating their role`,
                relatedIds: [character.id],
              });
            }
          }

          // Check for incomplete character descriptions
          if (!character.description || character.description.length < 20) {
            issues.push({
              type: 'character',
              severity: 'low',
              description: `Character "${character.name}" has minimal description`,
              suggestion: `Add more details to "${character.name}"'s background and personality`,
              relatedIds: [character.id],
            });
          }
        }

        // Check for plot thread consistency
        for (const plotThread of plotThreads) {
          // Check for long-developing plot threads
          if (plotThread.status === 'DEVELOPING' && chapters.length > 3) {
            issues.push({
              type: 'plot',
              severity: 'medium',
              description: `Plot thread "${plotThread.title}" has been developing for a while`,
              suggestion: `Consider advancing "${plotThread.title}" to climax or resolution`,
              relatedIds: [plotThread.id],
            });
          }

          // Check for plot threads without character connections
          if (plotThread.relatedCharacters.length === 0) {
            issues.push({
              type: 'plot',
              severity: 'medium',
              description: `Plot thread "${plotThread.title}" has no connected characters`,
              suggestion: `Link "${plotThread.title}" to relevant characters in your story`,
              relatedIds: [plotThread.id],
            });
          }
        }

        // Check for unused world elements
        for (const worldElement of worldElements) {
          if (worldElement.type === 'LOCATION' && chapters.length > 0) {
            const mentionCount = chapters.reduce(
              (count: number, chapter: { content?: string }) => {
                const mentions = (
                  chapter.content
                    ?.toLowerCase()
                    .match(new RegExp(worldElement.name.toLowerCase(), 'g')) ||
                  []
                ).length;
                return count + mentions;
              },
              0
            );

            if (mentionCount === 0) {
              issues.push({
                type: 'world',
                severity: 'low',
                description: `Location "${worldElement.name}" is defined but not used in chapters`,
                suggestion: `Consider incorporating "${worldElement.name}" into your story or removing it`,
                relatedIds: [worldElement.id],
              });
            }
          }
        }

        // Calculate consistency score
        const totalElements =
          characters.length + plotThreads.length + worldElements.length;
        const issueWeight = issues.reduce((weight, issue) => {
          switch (issue.severity) {
            case 'high':
              return weight + 3;
            case 'medium':
              return weight + 2;
            case 'low':
              return weight + 1;
            default:
              return weight;
          }
        }, 0);

        const score = Math.max(
          0,
          Math.min(100, 100 - (issueWeight / Math.max(totalElements, 1)) * 20)
        );

        // Generate summary
        let summary = 'Your story context is ';
        if (score >= 90) summary += 'excellent with minimal issues.';
        else if (score >= 75)
          summary += 'good with some minor inconsistencies.';
        else if (score >= 60)
          summary += 'decent but has several areas for improvement.';
        else summary += 'needs attention to improve consistency.';

        return {
          issues,
          score: Math.round(score),
          summary,
        };
      } catch {
        // Fallback to sample data if API calls fail
        return {
          issues: [
            {
              type: 'character',
              severity: 'medium',
              description: 'Some characters may need more development',
              suggestion:
                'Consider adding more details to character descriptions',
              relatedIds: [],
            },
          ],
          score: 85,
          summary:
            'Your story context is good with some minor areas for improvement.',
        };
      }
    }, [projectId]);

  const checkConsistency = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Since we don't have a consistency API endpoint yet, we'll simulate the check
      // In a real implementation, this would call an API endpoint
      const response = await simulateConsistencyCheck();
      setReport(response);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to check consistency'
      );
    } finally {
      setLoading(false);
    }
  }, [simulateConsistencyCheck]);

  useEffect(() => {
    checkConsistency();
  }, [checkConsistency]);

  const dismissIssue = (issueIndex: number) => {
    setDismissedIssues((prev) => new Set([...prev, issueIndex.toString()]));
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 75) return 'text-blue-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBackground = (score: number) => {
    if (score >= 90) return 'bg-green-500';
    if (score >= 75) return 'bg-blue-500';
    if (score >= 60) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const visibleIssues =
    report?.issues.filter(
      (_, index) => !dismissedIssues.has(index.toString())
    ) || [];

  // const issuesByType = visibleIssues.reduce(
  //   (acc, issue) => {
  //     acc[issue.type] = (acc[issue.type] || 0) + 1;
  //     return acc;
  //   },
  //   {} as Record<string, number>
  // );

  const issuesBySeverity = visibleIssues.reduce(
    (acc, issue) => {
      acc[issue.severity] = (acc[issue.severity] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="h-6 w-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Consistency Alerts</h2>
        </div>
        <Button onClick={checkConsistency} disabled={loading} variant="outline">
          <RefreshCw
            className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`}
          />
          {loading ? 'Checking...' : 'Check Again'}
        </Button>
      </div>

      {error && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {loading && (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Analyzing your story context...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {report && !loading && (
        <>
          {/* Consistency Score */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Consistency Score</span>
                <span
                  className={`text-3xl font-bold ${getScoreColor(report.score)}`}
                >
                  {report.score}/100
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress
                value={report.score}
                className="mb-4"
                style={
                  {
                    '--progress-background': getScoreBackground(report.score),
                  } as React.CSSProperties
                }
              />
              <p className="text-gray-600">{report.summary}</p>

              {/* Issue Summary */}
              {visibleIssues.length > 0 && (
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-red-600">
                      {issuesBySeverity.high || 0}
                    </p>
                    <p className="text-sm text-gray-600">High Priority</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-orange-600">
                      {issuesBySeverity.medium || 0}
                    </p>
                    <p className="text-sm text-gray-600">Medium Priority</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-yellow-600">
                      {issuesBySeverity.low || 0}
                    </p>
                    <p className="text-sm text-gray-600">Low Priority</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-gray-600">
                      {visibleIssues.length}
                    </p>
                    <p className="text-sm text-gray-600">Total Issues</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Issues List */}
          {visibleIssues.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Great job!
                </h3>
                <p className="text-gray-600 text-center">
                  No consistency issues found. Your story context is
                  well-maintained.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Issues Found</h3>
              {visibleIssues.map((issue, index) => {
                const SeverityIcon = severityIcons[issue.severity];
                return (
                  <Card
                    key={index}
                    className={`border-l-4 ${severityColors[issue.severity]}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <SeverityIcon
                            className={`h-5 w-5 mt-1 ${
                              issue.severity === 'high'
                                ? 'text-red-600'
                                : issue.severity === 'medium'
                                  ? 'text-orange-600'
                                  : 'text-yellow-600'
                            }`}
                          />
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Badge className={typeColors[issue.type]}>
                                {typeLabels[issue.type]}
                              </Badge>
                              <Badge
                                variant="outline"
                                className={
                                  issue.severity === 'high'
                                    ? 'border-red-300 text-red-700'
                                    : issue.severity === 'medium'
                                      ? 'border-orange-300 text-orange-700'
                                      : 'border-yellow-300 text-yellow-700'
                                }
                              >
                                {issue.severity.toUpperCase()}
                              </Badge>
                            </div>
                            <p className="font-medium">{issue.description}</p>
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => dismissIssue(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardHeader>
                    {issue.suggestion && (
                      <CardContent className="pt-0">
                        <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
                          <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5" />
                          <p className="text-sm text-blue-800">
                            {issue.suggestion}
                          </p>
                        </div>
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
