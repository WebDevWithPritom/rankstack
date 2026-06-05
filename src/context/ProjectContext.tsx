'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Project } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  activeProjectId: string;
  setActiveProjectId: (id: string) => void;
  isLoading: boolean;
  refetchProjects: () => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { data: projects = [], isLoading, refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Failed to load projects');
      return res.json();
    }
  });

  const [activeProjectId, setActiveProjectIdState] = useState<string>('');

  // Initial load from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('rankstack_active_project_id');
      if (saved) {
        setActiveProjectIdState(saved);
      }
    }
  }, []);

  // Update active project if it's not set and projects list becomes available
  useEffect(() => {
    if (projects.length > 0 && !activeProjectId) {
      const firstId = projects[0].id;
      setActiveProjectIdState(firstId);
      localStorage.setItem('rankstack_active_project_id', firstId);
    } else if (projects.length > 0 && activeProjectId) {
      // Verify if the active ID still exists in the project list
      const exists = projects.some(p => p.id === activeProjectId);
      if (!exists) {
        const firstId = projects[0].id;
        setActiveProjectIdState(firstId);
        localStorage.setItem('rankstack_active_project_id', firstId);
      }
    }
  }, [projects, activeProjectId]);

  const setActiveProjectId = (id: string) => {
    setActiveProjectIdState(id);
    localStorage.setItem('rankstack_active_project_id', id);
  };

  const activeProject = projects.find(p => p.id === activeProjectId) || null;

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectId,
        setActiveProjectId,
        isLoading,
        refetchProjects
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
