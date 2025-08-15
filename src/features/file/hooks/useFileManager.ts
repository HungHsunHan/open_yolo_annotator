"use client";

import { useState, useEffect, useCallback } from "react";
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

// Helper function to validate if project exists - now handled by API validation
const validateProjectExists = (projectId: string): boolean => {
  // Projects are now managed by the API, so we just check if projectId is provided
  // The API will handle project existence and access control validation
  return !!projectId;
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
        console.warn(`Invalid project ID: ${projectId}`);
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

  const updateImageAnnotationData = useCallback(async (imageId: string, annotationData: Annotation[]) => {
    console.log(`[useFileManager] Updating annotation data for image ${imageId} with ${annotationData.length} annotations`);
    
    try {
      await apiImageService.updateImageAnnotations(imageId, annotationData);
      
      // Update local state only after successful API call
      setImages(prev => prev.map(img => 
        img.id === imageId ? { 
          ...img, 
          annotations: annotationData.length,
          annotationData,
          status: annotationData.length > 0 ? 'completed' : 'pending' // Update status based on annotations
        } : img
      ));
      
      console.log(`[useFileManager] Successfully updated annotation data for image ${imageId}`);
      
      // Clear any previous errors
      setLastError(null);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save annotations';
      console.error(`[useFileManager] Failed to update image annotations for ${imageId}:`, error);
      setLastError(errorMessage);
      
      // Re-throw error so calling components can handle it
      throw error;
    }
  }, []); // Empty dependency array since all dependencies are stable

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