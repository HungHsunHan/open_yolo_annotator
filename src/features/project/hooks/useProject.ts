"use client";

import { useState } from "react";
import { YoloProject } from "../types";

export const useProject = () => {
  const [currentProject, setCurrentProject] = useState<YoloProject | null>(null);
  const [projects, setProjects] = useState<YoloProject[]>([]);

  const createProject = (name: string) => {
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
      classNames: []
    };
    setProjects([...projects, newProject]);
    setCurrentProject(newProject);
    return newProject;
  };

  return { currentProject, projects, createProject };
};