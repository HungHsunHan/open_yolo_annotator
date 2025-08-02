"use client";

import { useState, useEffect } from "react";
import { YoloProject } from "../types";

export const useProject = () => {
  const [currentProject, setCurrentProject] = useState<YoloProject | null>(null);
  const [projects, setProjects] = useState<YoloProject[]>([]);

  // Load projects from localStorage on mount
  useEffect(() => {
    const savedProjects = localStorage.getItem('yolo-projects');
    if (savedProjects) {
      const parsedProjects = JSON.parse(savedProjects).map((p: any) => ({
        ...p,
        createdAt: new Date(p.createdAt),
        updatedAt: new Date(p.updatedAt)
      }));
      setProjects(parsedProjects);
      
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
    if (projects.length > 0) {
      localStorage.setItem('yolo-projects', JSON.stringify(projects));
    }
  }, [projects]);

  // Save current project to localStorage
  useEffect(() => {
    if (currentProject) {
      localStorage.setItem('yolo-current-project', currentProject.id);
    } else {
      localStorage.removeItem('yolo-current-project');
    }
  }, [currentProject]);

  const createProject = (name: string, classes: string[] = ["object"]) => {
    const newProject: YoloProject = {
      id: crypto.randomUUID(),
      name,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: "current-user",
      directoryStructure: {
        images: `/projects/${name}/images`,
        labels: `/projects/${name}/labels`, 
        classes: `/projects/${name}/classes.txt`
      },
      classNames: classes
    };
    
    const updatedProjects = [...projects, newProject];
    setProjects(updatedProjects);
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
    const updatedProjects = projects.map(p => 
      p.id === projectId 
        ? { ...p, ...updates, updatedAt: new Date() }
        : p
    );
    setProjects(updatedProjects);
    
    if (currentProject?.id === projectId) {
      setCurrentProject({ ...currentProject, ...updates, updatedAt: new Date() });
    }
    
    localStorage.setItem('yolo-projects', JSON.stringify(updatedProjects));
  };

  const deleteProject = (projectId: string) => {
    const updatedProjects = projects.filter(p => p.id !== projectId);
    setProjects(updatedProjects);
    
    if (currentProject?.id === projectId) {
      setCurrentProject(null);
      localStorage.removeItem('yolo-current-project');
    }
    
    localStorage.setItem('yolo-projects', JSON.stringify(updatedProjects));
  };

  return { 
    currentProject, 
    projects, 
    createProject, 
    setProject, 
    updateProject, 
    deleteProject 
  };
};