"use client";

import { useState, useEffect, useMemo } from "react";
import { YoloProject, ClassDefinition } from "../types";
import { useAuth } from "@/auth/AuthProvider";
import { apiClient } from "@/lib/api";

export const useProject = () => {
  const { user, isAdmin } = useAuth();
  const [currentProject, setCurrentProject] = useState<YoloProject | null>(null);
  const [allProjects, setAllProjects] = useState<YoloProject[]>([]);
  
  // Computed property: filter projects based on user access (memoized to prevent infinite re-renders)
  const projects = useMemo(() => {
    return allProjects.filter(project => {
      if (isAdmin) return true; // Admins see all projects
      return project.assignedUsers.includes(user?.id || ''); // Annotators see only assigned projects
    });
  }, [allProjects, isAdmin, user?.id]);

  // Load projects from API on mount
  useEffect(() => {
    const loadProjects = async () => {
      if (!user) return;
      
      try {
        const projectsData = await apiClient.getProjects();
        const parsedProjects = projectsData.map((p: any) => ({
          ...p,
          createdAt: new Date(p.created_at),
          updatedAt: new Date(p.updated_at),
          assignedUsers: p.assigned_users || [],
          classDefinitions: p.class_definitions || []
        }));
        setAllProjects(parsedProjects);
        
        // Set current project if exists
        const savedCurrent = localStorage.getItem('yolo-current-project');
        if (savedCurrent) {
          const current = parsedProjects.find((p: YoloProject) => p.id === savedCurrent);
          if (current) {
            setCurrentProject(current);
          }
        }
      } catch (error) {
        console.error('Failed to load projects:', error);
        setAllProjects([]);
      }
    };

    loadProjects();
  }, [user]);

  // Projects are now saved on the server, no need for localStorage sync

  // Save current project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('yolo-current-project', currentProject.id);
    } else {
      localStorage.removeItem('yolo-current-project');
    }
  }, [currentProject]);

  const createProject = async (name: string, classes: string[] = ["object"], classDefinitions?: ClassDefinition[]) => {
    if (!user) return null;
    
    try {
      const projectData = {
        name,
        class_names: classes,
        class_definitions: classDefinitions || []
      };
      
      const newProject = await apiClient.createProject(projectData);
      
      // Convert API response to match frontend interface
      const formattedProject: YoloProject = {
        ...newProject,
        createdAt: new Date(newProject.created_at),
        updatedAt: new Date(newProject.updated_at),
        classNames: newProject.class_names,
        classDefinitions: newProject.class_definitions,
        assignedUsers: newProject.assigned_users,
        directoryStructure: newProject.directory_structure
      };
      
      const updatedProjects = [...allProjects, formattedProject];
      setAllProjects(updatedProjects);
      setCurrentProject(formattedProject);
      
      // Save current project reference locally
      localStorage.setItem('yolo-current-project', formattedProject.id);
      
      return formattedProject;
    } catch (error) {
      console.error('Failed to create project:', error);
      return null;
    }
  };

  const setProject = (project: YoloProject | null) => {
    setCurrentProject(project);
  };

  const updateProject = async (projectId: string, updates: Partial<YoloProject>) => {
    try {
      // Convert frontend format to API format
      const apiUpdates = {
        name: updates.name,
        class_names: updates.classNames,
        class_definitions: updates.classDefinitions
      };
      
      const updatedProject = await apiClient.updateProject(projectId, apiUpdates);
      
      // Convert API response back to frontend format
      const formattedProject: YoloProject = {
        ...updatedProject,
        createdAt: new Date(updatedProject.created_at),
        updatedAt: new Date(updatedProject.updated_at),
        classNames: updatedProject.class_names,
        classDefinitions: updatedProject.class_definitions,
        assignedUsers: updatedProject.assigned_users,
        directoryStructure: updatedProject.directory_structure
      };
      
      const updatedProjects = allProjects.map(p => 
        p.id === projectId ? formattedProject : p
      );
      setAllProjects(updatedProjects);
      
      if (currentProject?.id === projectId) {
        setCurrentProject(formattedProject);
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    }
  };

  const deleteProject = async (projectId: string) => {
    try {
      await apiClient.deleteProject(projectId);
      
      // Remove project from local state
      const updatedProjects = allProjects.filter(p => p.id !== projectId);
      setAllProjects(updatedProjects);
      
      // Clear current project if it's the one being deleted
      if (currentProject?.id === projectId) {
        setCurrentProject(null);
        localStorage.removeItem('yolo-current-project');
      }
      
      // Clean up any local project-specific data that might exist
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`project-${projectId}-`)) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to delete project:', error);
    }
  };

  // User assignment functions
  const assignUserToProject = async (projectId: string, userId: string): Promise<boolean> => {
    if (!isAdmin) return false;
    
    try {
      await apiClient.assignUserToProject(projectId, userId);
      
      // Update local state
      const project = allProjects.find(p => p.id === projectId);
      if (project && !project.assignedUsers.includes(userId)) {
        const updatedProject = {
          ...project,
          assignedUsers: [...project.assignedUsers, userId]
        };
        const updatedProjects = allProjects.map(p => p.id === projectId ? updatedProject : p);
        setAllProjects(updatedProjects);
        
        if (currentProject?.id === projectId) {
          setCurrentProject(updatedProject);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to assign user to project:', error);
      return false;
    }
  };

  const unassignUserFromProject = async (projectId: string, userId: string): Promise<boolean> => {
    if (!isAdmin) return false;
    
    try {
      await apiClient.unassignUserFromProject(projectId, userId);
      
      // Update local state
      const project = allProjects.find(p => p.id === projectId);
      if (project) {
        const updatedProject = {
          ...project,
          assignedUsers: project.assignedUsers.filter(id => id !== userId)
        };
        const updatedProjects = allProjects.map(p => p.id === projectId ? updatedProject : p);
        setAllProjects(updatedProjects);
        
        if (currentProject?.id === projectId) {
          setCurrentProject(updatedProject);
        }
      }
      
      return true;
    } catch (error) {
      console.error('Failed to unassign user from project:', error);
      return false;
    }
  };

  const getProjectAssignments = (projectId: string): string[] => {
    const project = allProjects.find(p => p.id === projectId);
    return project ? project.assignedUsers : [];
  };

  const isUserAssignedToProject = (projectId: string, userId: string): boolean => {
    const project = allProjects.find(p => p.id === projectId);
    return project ? project.assignedUsers.includes(userId) : false;
  };

  return { 
    currentProject, 
    projects, 
    allProjects, // For admin use - to see all projects regardless of assignment
    createProject, 
    setProject, 
    updateProject, 
    deleteProject,
    assignUserToProject,
    unassignUserFromProject,
    getProjectAssignments,
    isUserAssignedToProject
  };
};