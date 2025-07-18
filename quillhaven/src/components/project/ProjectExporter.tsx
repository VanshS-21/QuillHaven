'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import {
  Download,
  FileText,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  History,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { exportApiService } from '@/services/api/exportApiService';
import type { ProjectWithDetails } from '@/types/database';
import type { ExportJob } from '@/types/export';

interface ProjectExporterProps {
  project: ProjectWithDetails;
  open: boolean;
  onClose: () => void;
}

interface ExportFormData {
  format: 'DOCX' | 'PDF' | 'TXT' | 'EPUB';
  selectedChapters: string[];
  includeMetadata: boolean;
  metadata: {
    title: string;
    author: string;
    description: string;
    genre: string;
    language: string;
    version: string;
  };
}

const EXPORT_FORMATS = [
  {
    value: 'DOCX',
    label: 'Microsoft Word (.docx)',
    description: 'Compatible with Microsoft Word and Google Docs',
    icon: FileText,
  },
  {
    value: 'PDF',
    label: 'PDF Document (.pdf)',
    description: 'Universal format for sharing and printing',
    icon: FileText,
  },
  {
    value: 'TXT',
    label: 'Plain Text (.txt)',
    description: 'Simple text format without formatting',
    icon: FileText,
  },
  {
    value: 'EPUB',
    label: 'EPUB eBook (.epub)',
    description: 'Standard eBook format for digital readers',
    icon: FileText,
  },
] as const;

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'ru', label: 'Russian' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
  { value: 'zh', label: 'Chinese' },
];

export function ProjectExporter({
  project,
  open,
  onClose,
}: ProjectExporterProps) {
  const [activeTab, setActiveTab] = useState('export');
  const [currentExport, setCurrentExport] = useState<ExportJob | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportJob[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const { register, handleSubmit, watch, setValue } = useForm<ExportFormData>({
    defaultValues: {
      format: 'DOCX',
      selectedChapters: project.chapters?.map((c) => c.id) || [],
      includeMetadata: true,
      metadata: {
        title: project.title,
        author: '',
        description: project.description || '',
        genre: project.genre,
        language: 'en',
        version: '1.0',
      },
    },
  });

  const watchedValues = watch();

  // Load export history when dialog opens
  useEffect(() => {
    if (open) {
      loadExportHistory();
    }
  }, [open]);

  // Poll for export status when exporting
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (currentExport && currentExport.status === 'PROCESSING') {
      interval = setInterval(async () => {
        try {
          const response = await exportApiService.getExportStatus(
            currentExport.id
          );
          if (response.success && response.data) {
            setCurrentExport(response.data);

            // Update progress based on status
            if (response.data.status === 'PROCESSING') {
              setExportProgress((prev) => Math.min(prev + 10, 90));
            } else if (response.data.status === 'COMPLETED') {
              setExportProgress(100);
              setIsExporting(false);
              loadExportHistory(); // Refresh history
            } else if (response.data.status === 'FAILED') {
              setIsExporting(false);
              setExportProgress(0);
            }
          }
        } catch (error) {
          console.error('Failed to check export status:', error);
        }
      }, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [currentExport]);

  const loadExportHistory = async () => {
    try {
      const response = await exportApiService.getExportHistory(20);
      if (response.success && response.data) {
        setExportHistory(response.data.exports);
      }
    } catch (error) {
      console.error('Failed to load export history:', error);
    }
  };

  const onSubmit = async (data: ExportFormData) => {
    try {
      setIsExporting(true);
      setExportProgress(10);

      const exportRequest = {
        format: data.format,
        chapterIds:
          data.selectedChapters.length === project.chapters?.length
            ? undefined
            : data.selectedChapters,
        includeMetadata: data.includeMetadata,
        metadata: data.includeMetadata
          ? {
              ...data.metadata,
              publishDate: new Date(),
            }
          : undefined,
      };

      const response = await exportApiService.createExport(
        project.id,
        exportRequest
      );

      if (response.success && response.data) {
        setExportProgress(30);

        // Get initial export status
        const statusResponse = await exportApiService.getExportStatus(
          response.data.exportId
        );
        if (statusResponse.success && statusResponse.data) {
          setCurrentExport(statusResponse.data);
          setActiveTab('status');
        }
      } else {
        throw new Error(response.error || 'Export failed');
      }
    } catch (error) {
      console.error('Export failed:', error);
      setIsExporting(false);
      setExportProgress(0);
      // You might want to show an error toast here
    }
  };

  const handleDownload = async (exportJob: ExportJob) => {
    try {
      await exportApiService.downloadExport(exportJob.id);
    } catch (error) {
      console.error('Download failed:', error);
      // You might want to show an error toast here
    }
  };

  const handleChapterToggle = (chapterId: string) => {
    const currentSelected = watchedValues.selectedChapters;
    const newSelected = currentSelected.includes(chapterId)
      ? currentSelected.filter((id) => id !== chapterId)
      : [...currentSelected, chapterId];

    setValue('selectedChapters', newSelected);
  };

  const handleSelectAllChapters = () => {
    const allChapterIds = project.chapters?.map((c) => c.id) || [];
    setValue('selectedChapters', allChapterIds);
  };

  const handleDeselectAllChapters = () => {
    setValue('selectedChapters', []);
  };

  const getStatusIcon = (status: ExportJob['status']) => {
    switch (status) {
      case 'PENDING':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'PROCESSING':
        return <AlertCircle className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'COMPLETED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'FAILED':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: ExportJob['status']) => {
    switch (status) {
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'PROCESSING':
        return 'bg-blue-100 text-blue-800';
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const selectedChapterCount = watchedValues.selectedChapters.length;
  const totalChapterCount = project.chapters?.length || 0;
  const selectedWordCount =
    project.chapters
      ?.filter((c) => watchedValues.selectedChapters.includes(c.id))
      .reduce((sum, c) => sum + c.wordCount, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export Project: {project.title}
          </DialogTitle>
          <DialogDescription>
            Export your project in various formats or view export history
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex-1 overflow-hidden"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="export">New Export</TabsTrigger>
            <TabsTrigger value="status">Export Status</TabsTrigger>
            <TabsTrigger value="history">Export History</TabsTrigger>
          </TabsList>

          <div className="mt-4 overflow-y-auto max-h-[calc(90vh-200px)]">
            <TabsContent value="export" className="space-y-6">
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                {/* Format Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Export Format</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {EXPORT_FORMATS.map((format) => {
                        const Icon = format.icon;
                        return (
                          <Card
                            key={format.value}
                            className={`cursor-pointer transition-colors ${
                              watchedValues.format === format.value
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => setValue('format', format.value)}
                          >
                            <CardContent className="p-4">
                              <div className="flex items-start gap-3">
                                <Icon className="h-5 w-5 mt-1 text-primary" />
                                <div className="flex-1">
                                  <h4 className="font-medium">
                                    {format.label}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {format.description}
                                  </p>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded-full border-2 ${
                                    watchedValues.format === format.value
                                      ? 'border-primary bg-primary'
                                      : 'border-muted-foreground'
                                  }`}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>

                {/* Chapter Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center justify-between">
                      Chapter Selection
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleSelectAllChapters}
                        >
                          Select All
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleDeselectAllChapters}
                        >
                          Deselect All
                        </Button>
                      </div>
                    </CardTitle>
                    <div className="text-sm text-muted-foreground">
                      {selectedChapterCount} of {totalChapterCount} chapters
                      selected
                      {selectedWordCount > 0 && (
                        <span>
                          {' '}
                          • {selectedWordCount.toLocaleString()} words
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="h-48">
                      <div className="space-y-2">
                        {project.chapters?.map((chapter) => (
                          <Card
                            key={chapter.id}
                            className={`cursor-pointer transition-colors ${
                              watchedValues.selectedChapters.includes(
                                chapter.id
                              )
                                ? 'border-primary bg-primary/5'
                                : 'hover:border-primary/50'
                            }`}
                            onClick={() => handleChapterToggle(chapter.id)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <h4 className="font-medium">
                                    {chapter.title}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {chapter.wordCount.toLocaleString()} words
                                  </p>
                                </div>
                                <div
                                  className={`w-4 h-4 rounded border-2 ${
                                    watchedValues.selectedChapters.includes(
                                      chapter.id
                                    )
                                      ? 'border-primary bg-primary'
                                      : 'border-muted-foreground'
                                  }`}
                                />
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>

                {/* Metadata Settings */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Settings className="h-5 w-5" />
                      Metadata Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="includeMetadata"
                        {...register('includeMetadata')}
                        className="rounded border-gray-300"
                      />
                      <Label htmlFor="includeMetadata">
                        Include metadata in export
                      </Label>
                    </div>

                    {watchedValues.includeMetadata && (
                      <div className="space-y-4 pl-6 border-l-2 border-primary/20">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <Label htmlFor="metadata.title">Title</Label>
                            <Input
                              id="metadata.title"
                              {...register('metadata.title')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="metadata.author">Author</Label>
                            <Input
                              id="metadata.author"
                              placeholder="Your name"
                              {...register('metadata.author')}
                            />
                          </div>
                        </div>

                        <div>
                          <Label htmlFor="metadata.description">
                            Description
                          </Label>
                          <Textarea
                            id="metadata.description"
                            rows={2}
                            placeholder="Brief description of your work"
                            {...register('metadata.description')}
                          />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <Label htmlFor="metadata.genre">Genre</Label>
                            <Input
                              id="metadata.genre"
                              {...register('metadata.genre')}
                            />
                          </div>
                          <div>
                            <Label htmlFor="metadata.language">Language</Label>
                            <Select
                              value={watchedValues.metadata.language}
                              onValueChange={(value) =>
                                setValue('metadata.language', value)
                              }
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {LANGUAGES.map((lang) => (
                                  <SelectItem
                                    key={lang.value}
                                    value={lang.value}
                                  >
                                    {lang.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label htmlFor="metadata.version">Version</Label>
                            <Input
                              id="metadata.version"
                              {...register('metadata.version')}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action Buttons */}
                <div className="flex justify-between pt-6 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onClose}
                    disabled={isExporting}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isExporting || selectedChapterCount === 0}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Creating Export...' : 'Start Export'}
                  </Button>
                </div>
              </form>
            </TabsContent>

            <TabsContent value="status" className="space-y-6">
              {currentExport ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {getStatusIcon(currentExport.status)}
                      Export Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">
                          {currentExport.filename}
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          {currentExport.format} • Created{' '}
                          {new Date(currentExport.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Badge className={getStatusColor(currentExport.status)}>
                        {currentExport.status}
                      </Badge>
                    </div>

                    {isExporting && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{exportProgress}%</span>
                        </div>
                        <Progress value={exportProgress} />
                      </div>
                    )}

                    {currentExport.status === 'COMPLETED' && (
                      <div className="space-y-4">
                        <Alert>
                          <CheckCircle className="h-4 w-4" />
                          <AlertDescription>
                            Your export is ready for download! The download link
                            will expire in 24 hours.
                          </AlertDescription>
                        </Alert>

                        <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                          <div>
                            <p className="font-medium">
                              File ready for download
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Size:{' '}
                              {currentExport.fileSize
                                ? `${(currentExport.fileSize / 1024 / 1024).toFixed(2)} MB`
                                : 'Unknown'}
                            </p>
                          </div>
                          <Button onClick={() => handleDownload(currentExport)}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}

                    {currentExport.status === 'FAILED' && (
                      <Alert variant="destructive">
                        <XCircle className="h-4 w-4" />
                        <AlertDescription>
                          Export failed. Please try again or contact support if
                          the problem persists.
                        </AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">
                      No Active Export
                    </h3>
                    <p className="text-muted-foreground">
                      Start a new export to see the status here.
                    </p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="h-5 w-5" />
                    Export History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {exportHistory.length > 0 ? (
                    <ScrollArea className="h-96">
                      <div className="space-y-3">
                        {exportHistory.map((exportJob) => (
                          <Card key={exportJob.id} className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {getStatusIcon(exportJob.status)}
                                <div>
                                  <h4 className="font-medium">
                                    {exportJob.filename}
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {exportJob.format} •{' '}
                                    {new Date(
                                      exportJob.createdAt
                                    ).toLocaleString()}
                                    {exportJob.fileSize && (
                                      <span>
                                        {' '}
                                        •{' '}
                                        {(
                                          exportJob.fileSize /
                                          1024 /
                                          1024
                                        ).toFixed(2)}{' '}
                                        MB
                                      </span>
                                    )}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge
                                  className={getStatusColor(exportJob.status)}
                                >
                                  {exportJob.status}
                                </Badge>
                                {exportJob.status === 'COMPLETED' &&
                                  exportJob.downloadUrl && (
                                    <Button
                                      size="sm"
                                      onClick={() => handleDownload(exportJob)}
                                    >
                                      <Download className="h-4 w-4 mr-1" />
                                      Download
                                    </Button>
                                  )}
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <h3 className="text-lg font-medium mb-2">
                        No Export History
                      </h3>
                      <p className="text-muted-foreground">
                        Your export history will appear here once you create
                        your first export.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
