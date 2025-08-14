"use client";

import { useState, useEffect, useMemo } from "react";
import { YoloProject, ClassDefinition } from "../types";
import { useAuth } from "@/auth/AuthProvider";

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

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('yolo-projects');
    if (savedProjects) {
      const parsedProjects = JSON.parse(savedProjects).map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt),
        // For backward compatibility, add assignedUsers if missing
        assignedUsers: p.assignedUsers || [],
        // For backward compatibility, only generate classDefinitions if missing and classNames exist
        classDefinitions: p.classDefinitions || (p.classNames ? p.classNames.map((name: string, index: number) => ({
          id: index,
          name: name,
          color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#84cc16"][index % 8],
          key: (index + 1).toString()
        })) : [])
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
    }
  }, []);

  // Save projects to localStorage whenever they change
  useEffect(() => {
    if (allProjects.length > 0) {
      localStorage.setItem('yolo-projects', JSON.stringify(allProjects));
    }
  }, [allProjects]);

  // Save current project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('yolo-current-project', currentProject.id);
    } else {
      localStorage.removeItem('yolo-current-project');
    }
  }, [currentProject]);

  const createProject = (name: string, classes: string[] = ["object"], classDefinitions?: ClassDefinition[]) => {
    if (!user) return null;
    
    const newProject: YoloProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: user.id,
      assignedUsers: [user.id], // Creator is automatically assigned
      directoryStructure: {
        images: `/projects/${name}/images`,
        labels: `/projects/${name}/labels`, 
        classes: `/projects/${name}/classes.txt`
      },
      classNames: classes,
      classDefinitions: classDefinitions
    };
    
    const updatedProjects = [...allProjects, newProject];
    setAllProjects(updatedProjects);
    setCurrentProject(newProject);
    
    // Save immediately
    localStorage.setItem('yolo-projects', JSON.stringify(updatedProjects));
    localStorage.setItem('yolo-current-project', newProject.id);
    
    return newProject;
  };

  const setProject = (project: YoloProject | null) => {
    setCurrentProject(project);
  };

  const updateProject = (projectId: string, updates: Partial<YoloProject>) => {
    const updatedProjects = allProjects.map(p => 
      p.id === projectId 
        ? { ...p, ...updates, updatedAt: new Date() }
        : p
    );
    setAllProjects(updatedProjects);
    
    if (currentProject?.id === projectId) {
      setCurrentProject({ ...currentProject, ...updates, updatedAt: new Date() });
    }
    
    localStorage.setItem('yolo-projects', JSON.stringify(updatedProjects));
  };

  const deleteProject = (projectId: string) => {
    // Remove project from projects list
    const updatedProjects = allProjects.filter(p => p.id !== projectId);
    setAllProjects(updatedProjects);
    
    // Clear current project if it's the one being deleted
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
      localStorage.removeItem('yolo-current-project');
    }
    
    // Update projects in localStorage
    if (updatedProjects.length > 0) {
      localStorage.setItem('yolo-projects', JSON.stringify(updatedProjects));
    } else {
      localStorage.removeItem('yolo-projects');
    }
    
    // Clean up all project-related data (images, annotations, etc.)
    localStorage.removeItem(`project-${projectId}-images`);
    
    // Clean up any other project-specific data that might exist
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith(`project-${projectId}-`)) {
        localStorage.removeItem(key);
      }
    });
  };

  // User assignment functions
  const assignUserToProject = (projectId: string, userId: string): boolean => {
    if (!isAdmin) return false;
    
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return false;
    
    if (!project.assignedUsers.includes(userId)) {
      const updatedAssignedUsers = [...project.assignedUsers, userId];
      updateProject(projectId, { assignedUsers: updatedAssignedUsers });
      return true;
    }
    
    return false;
  };

  const unassignUserFromProject = (projectId: string, userId: string): boolean => {
    if (!isAdmin) return false;
    
    const project = allProjects.find(p => p.id === projectId);
    if (!project) return false;
    
    // Prevent removing the creator
    if (project.createdBy === userId) return false;
    
    const updatedAssignedUsers = project.assignedUsers.filter(id => id !== userId);
    updateProject(projectId, { assignedUsers: updatedAssignedUsers });
    return true;
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