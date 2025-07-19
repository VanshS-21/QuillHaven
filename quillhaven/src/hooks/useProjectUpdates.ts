import { useState, useEffect, useCallback } from 'react';
import { projectApiService, type UpdateProjectRequest } from '@/services/api/projectApiService';
import type { Project } from '@/types/database';

interface UseProjectUpdatesOptions {
  refreshInterval?: number; // in milliseconds
  enableRealTime?: boolean;
}

export function useProjectUpdates(options: UseProjectUpdatesOptions = {}) {
  const { refreshInterval = 30000, enableRealTime = true } = options;
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Trigger a manual refresh
  const triggerRefresh = useCallback(() => {
    setLastUpdate(new Date());
  }, []);

  // Set up periodic refresh
  useEffect(() => {
    if (!enableRealTime) return;

    const interval = setInterval(() => {
      setLastUpdate(new Date());
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval, enableRealTime]);

  return {
    lastUpdate,
    triggerRefresh,
  };
}

interface UseOptimisticProjectsOptions {
  initialProjects?: Project[];
}

export function useOptimisticProjects(options: UseOptimisticProjectsOptions = {}) {
  const [projects, setProjects] = useState<Project[]>(options.initialProjects || []);
  const [optimisticUpdates, setOptimisticUpdates] = useState<Map<string, Partial<Project>>>(new Map());

  // Apply optimistic update
  const applyOptimisticUpdate = useCallback((projectId: string, updates: Partial<Project>) => {
    setOptimisticUpdates(prev => new Map(prev).set(projectId, updates));
    
    // Remove optimistic update after a timeout (in case the real update fails)
    setTimeout(() => {
      setOptimisticUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(projectId);
        return newMap;
      });
    }, 10000); // 10 seconds timeout
  }, []);

  // Clear optimistic update
  const clearOptimisticUpdate = useCallback((projectId: string) => {
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newMap.delete(projectId);
      return newMap;
    });
  }, []);

  // Get projects with optimistic updates applied
  const getOptimisticProjects = useCallback(() => {
    return projects.map(project => {
      const optimisticUpdate = optimisticUpdates.get(project.id);
      return optimisticUpdate ? { ...project, ...optimisticUpdate } : project;
    });
  }, [projects, optimisticUpdates]);

  // Update projects
  const updateProjects = useCallback((newProjects: Project[]) => {
    setProjects(newProjects);
    // Clear any optimistic updates for projects that have been updated
    setOptimisticUpdates(prev => {
      const newMap = new Map(prev);
      newProjects.forEach(project => {
        newMap.delete(project.id);
      });
      return newMap;
    });
  }, []);

  // Optimistic project creation
  const optimisticCreateProject = useCallback(async (projectData: any) => {
    // Create temporary project with optimistic ID
    const tempProject: Project = {
      id: `temp-${Date.now()}`,
      userId: 'current-user', // This would come from auth context
      title: projectData.title,
      description: projectData.description,
      genre: projectData.genre,
      targetLength: projectData.targetLength,
      currentWordCount: 0,
      status: 'DRAFT',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Add to projects list optimistically
    setProjects(prev => [tempProject, ...prev]);

    try {
      // Make actual API call
      const response = await projectApiService.createProject(projectData);
      
      if (response.success && response.data) {
        // Replace temp project with real project
        setProjects(prev => 
          prev.map(p => p.id === tempProject.id ? response.data! : p)
        );
        return response.data;
      } else {
        // Remove temp project on failure
        setProjects(prev => prev.filter(p => p.id !== tempProject.id));
        throw new Error(response.error || 'Failed to create project');
      }
    } catch (error) {
      // Remove temp project on error
      setProjects(prev => prev.filter(p => p.id !== tempProject.id));
      throw error;
    }
  }, []);

  // Optimistic project update
  const optimisticUpdateProject = useCallback(async (projectId: string, updates: Partial<Project>) => {
    // Apply optimistic update immediately
    applyOptimisticUpdate(projectId, updates);

    try {
      // Make actual API call - convert Prisma types to API types
      const sanitizedUpdates: UpdateProjectRequest = {};
      if (updates.title !== undefined) sanitizedUpdates.title = updates.title;
      if (updates.description !== undefined) sanitizedUpdates.description = updates.description || undefined;
      if (updates.genre !== undefined) sanitizedUpdates.genre = updates.genre;
      if (updates.targetLength !== undefined) sanitizedUpdates.targetLength = updates.targetLength;
      if (updates.status !== undefined) sanitizedUpdates.status = updates.status;
      
      const response = await projectApiService.updateProject(projectId, sanitizedUpdates);
      
      if (response.success && response.data) {
        // Update the actual project
        setProjects(prev => 
          prev.map(p => p.id === projectId ? response.data! : p)
        );
        clearOptimisticUpdate(projectId);
        return response.data;
      } else {
        clearOptimisticUpdate(projectId);
        throw new Error(response.error || 'Failed to update project');
      }
    } catch (error) {
      clearOptimisticUpdate(projectId);
      throw error;
    }
  }, [applyOptimisticUpdate, clearOptimisticUpdate]);

  // Optimistic project deletion
  const optimisticDeleteProject = useCallback(async (projectId: string) => {
    // Store the project in case we need to restore it
    const projectToDelete = projects.find(p => p.id === projectId);
    
    // Remove from list optimistically
    setProjects(prev => prev.filter(p => p.id !== projectId));

    try {
      // Make actual API call
      const response = await projectApiService.deleteProject(projectId);
      
      if (!response.success) {
        // Restore project on failure
        if (projectToDelete) {
          setProjects(prev => [projectToDelete, ...prev]);
        }
        throw new Error(response.error || 'Failed to delete project');
      }
    } catch (error) {
      // Restore project on error
      if (projectToDelete) {
        setProjects(prev => [projectToDelete, ...prev]);
      }
      throw error;
    }
  }, [projects]);

  return {
    projects: getOptimisticProjects(),
    updateProjects,
    optimisticCreateProject,
    optimisticUpdateProject,
    optimisticDeleteProject,
    applyOptimisticUpdate,
    clearOptimisticUpdate,
  };
}