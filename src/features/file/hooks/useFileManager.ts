"use client";

import { useState, useEffect } from "react";
import { ClassDefinition } from "@/features/project/types";
import { apiImageService } from "@/services/apiImageService";
import type { ImageFile } from "@/services/apiImageService";

export interface Annotation {
  id: string;
  classId: number;
  className: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export type { ImageFile };

// Helper function to validate if project exists
const validateProjectExists = (projectId: string): boolean => {
  if (!projectId) return false;
  
  const savedProjects = localStorage.getItem('yolo-projects');
  if (!savedProjects) return false;
  
  try {
    const projects = JSON.parse(savedProjects);
    return projects.some((p: { id: string }) => p.id === projectId);
  } catch (e) {
    console.error("Failed to validate project existence:", e);
    return false;
  }
};

export const useFileManager = (projectId: string) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  // Load images from IndexedDB when project changes
  useEffect(() => {
    setLastError(null);
    
    if (projectId) {
      // Validate project exists before loading images
      if (!validateProjectExists(projectId)) {
        const error = `Project ${projectId} does not exist or cannot be found`;
        console.warn(error);
        setLastError(error);
        setImages([]);
        return;
      }

      const loadImages = async () => {
        try {
          setIsLoading(true);
          
          // Load images from API
          const loadedImages = await apiImageService.getProjectImages(projectId);
          setImages(loadedImages);
          
        } catch (error) {
          const errorMsg = `Failed to load images for project ${projectId}: ${error}`;
          console.error(errorMsg);
          setLastError(errorMsg);
          setImages([]);
        } finally {
          setIsLoading(false);
        }
      };

      loadImages();
    } else {
      setImages([]);
    }
  }, [projectId]);

  const uploadFiles = async (files: FileList) => {
    if (!projectId) {
      setLastError('No project selected');
      return;
    }

    setIsLoading(true);
    setLastError(null);
    
    try {
      const uploadedImages = await apiImageService.uploadFiles(files, projectId);
      setImages(prev => [...prev, ...uploadedImages]);
    } catch (error) {
      console.error('Error uploading files:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to upload files');
    } finally {
      setIsLoading(false);
    }
  };

  const updateImageStatus = async (imageId: string, status: ImageFile['status']) => {
    try {
      await apiImageService.updateImageStatus(imageId, status);
      setImages(prev => prev.map(img => 
        img.id === imageId ? { ...img, status } : img
      ));
    } catch (error) {
      console.error('Failed to update image status:', error);
      setLastError('Failed to update image status');
    }
  };

  const updateImageAnnotations = (imageId: string, annotations: number) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, annotations } : img
    ));
  };

  const updateImageAnnotationData = async (imageId: string, annotationData: Annotation[]) => {
    try {
      await apiImageService.updateImageAnnotations(imageId, annotationData);
      setImages(prev => prev.map(img => 
        img.id === imageId ? { 
          ...img, 
          annotations: annotationData.length,
          annotationData,
          status: 'completed' // Update status based on annotations
        } : img
      ));
    } catch (error) {
      console.error('Failed to update image annotations:', error);
      setLastError('Failed to save annotations');
    }
  };

  const deleteImage = async (imageId: string) => {
    try {
      await apiImageService.deleteImage(imageId);
      setImages(prev => prev.filter(img => img.id !== imageId));
    } catch (error) {
      console.error('Failed to delete image:', error);
      setLastError('Failed to delete image');
    }
  };

  const clearAllImages = async () => {
    if (!projectId) return;
    
    try {
      await apiImageService.clearProjectImages(projectId);
      setImages([]);
    } catch (error) {
      console.error('Failed to clear all images:', error);
      setLastError('Failed to clear images');
    }
  };

  const uploadDirectory = async (files: FileList, classDefinitions: ClassDefinition[]) => {
    if (!projectId) {
      setLastError('No project selected');
      return;
    }

    setIsLoading(true);
    setLastError(null);
    
    try {
      const uploadedImages = await apiImageService.uploadDirectory(files, projectId, classDefinitions);
      setImages(prev => [...prev, ...uploadedImages]);
    } catch (error) {
      console.error('Error uploading directory:', error);
      setLastError(error instanceof Error ? error.message : 'Failed to upload directory');
    } finally {
      setIsLoading(false);
    }
  };

  const getStorageStats = async () => {
    try {
      return await apiImageService.getStorageInfo();
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { used: 0, total: 0, available: 0 };
    }
  };

  const cleanupOrphanedData = () => {
    // This function is now handled by the database automatically
    // Keep for backward compatibility
    return { cleaned: 0, errors: [] };
  };

  return { 
    images,
    files: images, // Alias for backward compatibility
    uploadFiles, 
    uploadDirectory,
    updateImageStatus, 
    updateImageAnnotations, 
    updateImageAnnotationData,
    deleteImage, 
    clearAllImages,
    isLoading,
    lastError,
    clearError: () => setLastError(null),
    // Storage management functions
    getStorageStats,
    cleanupOrphanedData
  };
};