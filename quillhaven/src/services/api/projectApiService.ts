import type {
  Project,
  ProjectWithDetails,
  ProjectStatus,
} from '@/types/database';

export interface CreateProjectRequest {
  title: string;
  description?: string;
  genre: string;
  targetLength: number;
}

export interface UpdateProjectRequest {
  title?: string;
  description?: string;
  genre?: string;
  targetLength?: number;
  status?: ProjectStatus;
}

export interface ListProjectsRequest {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
  genre?: string;
  search?: string;
  sortBy?: 'title' | 'createdAt' | 'updatedAt' | 'currentWordCount';
  sortOrder?: 'asc' | 'desc';
}

export interface ListProjectsResponse {
  projects: Project[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ProjectStatsResponse {
  totalProjects: number;
  totalWordCount: number;
  projectsByStatus: Record<ProjectStatus, number>;
  recentActivity: Project[];
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  details?: unknown;
}

/**
 * Project API client service for frontend interactions
 */
export class ProjectApiService {
  private baseUrl = '/api/projects';

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
   * Create a new project
   */
  async createProject(
    data: CreateProjectRequest
  ): Promise<ApiResponse<Project>> {
    return this.request<Project>('', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get a specific project by ID
   */
  async getProject(id: string): Promise<ApiResponse<ProjectWithDetails>> {
    return this.request<ProjectWithDetails>(`/${id}`);
  }

  /**
   * Update a project
   */
  async updateProject(
    id: string,
    data: UpdateProjectRequest
  ): Promise<ApiResponse<Project>> {
    return this.request<Project>(`/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  /**
   * Delete a project
   */
  async deleteProject(id: string): Promise<ApiResponse<void>> {
    return this.request<void>(`/${id}`, {
      method: 'DELETE',
    });
  }

  /**
   * List projects with optional filtering and pagination
   */
  async listProjects(
    params: ListProjectsRequest = {}
  ): Promise<ApiResponse<ListProjectsResponse>> {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value.toString());
      }
    });

    const queryString = searchParams.toString();
    const endpoint = queryString ? `?${queryString}` : '';

    return this.request<ListProjectsResponse>(endpoint);
  }

  /**
   * Get project statistics for dashboard
   */
  async getProjectStats(): Promise<ApiResponse<ProjectStatsResponse>> {
    return this.request<ProjectStatsResponse>('/stats');
  }
}

// Export a singleton instance
export const projectApiService = new ProjectApiService();
