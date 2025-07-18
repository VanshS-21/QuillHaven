import type { ExportRequest, ExportJob } from '@/types/export';

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

/**
 * Export API client service for frontend interactions
 */
export class ExportApiService {
  private baseUrl = '/api';

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
          ...options.headers,
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: 'Network error occurred',
      };
    }
  }

  private getAuthToken(): string | null {
    // In a real app, this would get the token from localStorage, cookies, or context
    if (typeof window !== 'undefined') {
      return localStorage.getItem('auth_token');
    }
    return null;
  }

  /**
   * Create a new export job
   */
  async createExport(
    projectId: string,
    request: Omit<ExportRequest, 'projectId'>
  ): Promise<ApiResponse<{ exportId: string }>> {
    return this.request<{ exportId: string }>(`/projects/${projectId}/export`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  /**
   * Get export status
   */
  async getExportStatus(exportId: string): Promise<ApiResponse<ExportJob>> {
    return this.request<ExportJob>(`/exports/${exportId}`);
  }

  /**
   * Get user's export history
   */
  async getExportHistory(
    limit: number = 10
  ): Promise<ApiResponse<{ exports: ExportJob[] }>> {
    return this.request<{ exports: ExportJob[] }>(`/exports?limit=${limit}`);
  }

  /**
   * Download export file
   */
  async downloadExport(exportId: string): Promise<void> {
    try {
      const token = this.getAuthToken();

      const response = await fetch(
        `${this.baseUrl}/exports/${exportId}/download`,
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = 'export';
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="(.+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Download failed:', error);
      throw error;
    }
  }
}

// Export a singleton instance
export const exportApiService = new ExportApiService();
