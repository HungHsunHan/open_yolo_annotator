"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { ClassDefinition } from "@/features/project/types";
import { apiImageService } from "@/services/apiImageService";
import type { ImageFile, Annotation } from "@/features/file/hooks/useFileManager";

interface PaginatedFileManagerConfig {
  pageSize?: number;
  preloadPages?: number;
}

interface PaginatedFileManagerState {
  images: ImageFile[];
  totalCount: number;
  currentPage: number;
  isLoading: boolean;
  hasNextPage: boolean;
  lastError: string | null;
  searchQuery: string;
}

// Helper function to validate if project exists
const validateProjectExists = (projectId: string): boolean => {
  return !!projectId;
};

export const usePaginatedFileManager = (
  projectId: string,
  config: PaginatedFileManagerConfig = {}
) => {
  const { pageSize = 20, preloadPages = 1 } = config;
  
  const [state, setState] = useState<PaginatedFileManagerState>({
    images: [],
    totalCount: 0,
    currentPage: 1,
    isLoading: false,
    hasNextPage: false,
    lastError: null,
    searchQuery: ""
  });

  // Use ref to track if we're currently loading to prevent duplicate requests
  const loadingRef = useRef(false);
  const cleanupRef = useRef<() => void>();

  // Load images for a specific page
  const loadPage = useCallback(async (page: number, append: boolean = false) => {
    if (!projectId || loadingRef.current) return;

    if (!validateProjectExists(projectId)) {
      console.warn(`Invalid project ID: ${projectId}`);
      setState(prev => ({ ...prev, images: [], totalCount: 0 }));
      return;
    }

    try {
      loadingRef.current = true;
      setState(prev => ({ ...prev, isLoading: true, lastError: null }));

      // Load images and count in parallel
      const [pageImages, countResponse] = await Promise.all([
        apiImageService.getProjectImagesPaginated(projectId, page, pageSize),
        state.totalCount === 0 ? apiImageService.getProjectImagesCount(projectId) : Promise.resolve(state.totalCount)
      ]);

      const totalCount = typeof countResponse === 'number' ? countResponse : countResponse;
      const hasNextPage = page * pageSize < totalCount;

      setState(prev => ({
        ...prev,
        images: append ? [...prev.images, ...pageImages] : pageImages,
        totalCount,
        currentPage: page,
        hasNextPage,
        isLoading: false
      }));

      console.log(`[usePaginatedFileManager] Loaded page ${page}: ${pageImages.length} images, total: ${totalCount}`);

    } catch (error) {
      const errorMsg = `Failed to load images for project ${projectId}, page ${page}: ${error}`;
      console.error(errorMsg);
      setState(prev => ({
        ...prev,
        lastError: errorMsg,
        isLoading: false
      }));
    } finally {
      loadingRef.current = false;
    }
  }, [projectId, pageSize, state.totalCount]);

  // Load more images (for infinite scroll)
  const loadMore = useCallback(async () => {
    if (state.hasNextPage && !state.isLoading) {
      await loadPage(state.currentPage + 1, true);
    }
  }, [loadPage, state.hasNextPage, state.isLoading, state.currentPage]);

  // Refresh/reload from the beginning
  const refresh = useCallback(async () => {
    setState(prev => ({ 
      ...prev, 
      images: [], 
      totalCount: 0, 
      currentPage: 1,
      hasNextPage: false 
    }));
    await loadPage(1, false);
  }, [loadPage]);

  // Search functionality
  const search = useCallback(async (query: string) => {
    setState(prev => ({ 
      ...prev, 
      searchQuery: query,
      images: [], 
      totalCount: 0, 
      currentPage: 1,
      hasNextPage: false 
    }));
    
    // For now, we'll do client-side filtering
    // In the future, this could be moved to the backend
    await loadPage(1, false);
  }, [loadPage]);

  // Filter images based on search query
  const filteredImages = state.searchQuery 
    ? state.images.filter(image => 
        image.name.toLowerCase().includes(state.searchQuery.toLowerCase()) ||
        image.status.toLowerCase().includes(state.searchQuery.toLowerCase())
      )
    : state.images;

  // Load initial data when project changes
  useEffect(() => {
    setState({
      images: [],
      totalCount: 0,
      currentPage: 1,
      isLoading: false,
      hasNextPage: false,
      lastError: null,
      searchQuery: ""
    });

    if (projectId) {
      loadPage(1, false);
    }

    // Cleanup function
    cleanupRef.current = () => {
      apiImageService.cleanupUnusedUrls();
    };

    return () => {
      cleanupRef.current?.();
    };
  }, [projectId, loadPage]);

  // File upload functionality
  const uploadFiles = useCallback(async (files: FileList) => {
    if (!projectId) {
      setState(prev => ({ ...prev, lastError: 'No project selected' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, lastError: null }));
    
    try {
      const uploadedImages = await apiImageService.uploadFiles(files, projectId);
      setState(prev => ({ 
        ...prev, 
        images: [...uploadedImages, ...prev.images],
        totalCount: prev.totalCount + uploadedImages.length,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error uploading files:', error);
      setState(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Failed to upload files',
        isLoading: false
      }));
    }
  }, [projectId]);

  // Update image status
  const updateImageStatus = useCallback(async (imageId: string, status: ImageFile['status']) => {
    try {
      await apiImageService.updateImageStatus(imageId, status);
      setState(prev => ({
        ...prev,
        images: prev.images.map(img => 
          img.id === imageId ? { ...img, status } : img
        )
      }));
    } catch (error) {
      console.error('Failed to update image status:', error);
      setState(prev => ({
        ...prev,
        lastError: 'Failed to update image status'
      }));
    }
  }, []);

  // Update image annotation data
  const updateImageAnnotationData = useCallback(async (imageId: string, annotationData: Annotation[]) => {
    console.log(`[usePaginatedFileManager] Updating annotation data for image ${imageId} with ${annotationData.length} annotations`);
    
    try {
      await apiImageService.updateImageAnnotations(imageId, annotationData);
      
      setState(prev => ({
        ...prev,
        images: prev.images.map(img => 
          img.id === imageId ? { 
            ...img, 
            annotations: annotationData.length,
            annotationData,
            status: annotationData.length > 0 ? 'completed' : 'pending'
          } : img
        ),
        lastError: null
      }));
      
      console.log(`[usePaginatedFileManager] Successfully updated annotation data for image ${imageId}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to save annotations';
      console.error(`[usePaginatedFileManager] Failed to update image annotations for ${imageId}:`, error);
      setState(prev => ({
        ...prev,
        lastError: errorMessage
      }));
      throw error;
    }
  }, []);

  // Delete image
  const deleteImage = useCallback(async (imageId: string) => {
    try {
      await apiImageService.deleteImage(imageId);
      setState(prev => ({
        ...prev,
        images: prev.images.filter(img => img.id !== imageId),
        totalCount: Math.max(0, prev.totalCount - 1)
      }));
    } catch (error) {
      console.error('Failed to delete image:', error);
      setState(prev => ({
        ...prev,
        lastError: 'Failed to delete image'
      }));
    }
  }, []);

  // Clear all images
  const clearAllImages = useCallback(async () => {
    if (!projectId) return;
    
    try {
      await apiImageService.clearProjectImages(projectId);
      setState(prev => ({
        ...prev,
        images: [],
        totalCount: 0
      }));
    } catch (error) {
      console.error('Failed to clear all images:', error);
      setState(prev => ({
        ...prev,
        lastError: 'Failed to clear images'
      }));
    }
  }, [projectId]);

  // Directory upload
  const uploadDirectory = useCallback(async (files: FileList, classDefinitions: ClassDefinition[]) => {
    if (!projectId) {
      setState(prev => ({ ...prev, lastError: 'No project selected' }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, lastError: null }));
    
    try {
      const uploadedImages = await apiImageService.uploadDirectory(files, projectId, classDefinitions);
      setState(prev => ({ 
        ...prev, 
        images: [...uploadedImages, ...prev.images],
        totalCount: prev.totalCount + uploadedImages.length,
        isLoading: false
      }));
    } catch (error) {
      console.error('Error uploading directory:', error);
      setState(prev => ({
        ...prev,
        lastError: error instanceof Error ? error.message : 'Failed to upload directory',
        isLoading: false
      }));
    }
  }, [projectId]);

  // Storage info
  const getStorageStats = useCallback(async () => {
    try {
      return await apiImageService.getStorageInfo();
    } catch (error) {
      console.error('Failed to get storage stats:', error);
      return { used: 0, total: 0, available: 0 };
    }
  }, []);

  return {
    // State
    images: filteredImages,
    totalCount: state.totalCount,
    currentPage: state.currentPage,
    isLoading: state.isLoading,
    hasNextPage: state.hasNextPage,
    lastError: state.lastError,
    searchQuery: state.searchQuery,
    
    // Actions
    loadMore,
    refresh,
    search,
    uploadFiles,
    uploadDirectory,
    updateImageStatus,
    updateImageAnnotationData,
    deleteImage,
    clearAllImages,
    getStorageStats,
    
    // Utility
    clearError: () => setState(prev => ({ ...prev, lastError: null })),
    
    // Backward compatibility
    files: filteredImages,
    updateImageAnnotations: (imageId: string, count: number) => {
      setState(prev => ({
        ...prev,
        images: prev.images.map(img => 
          img.id === imageId ? { ...img, annotations: count } : img
        )
      }));
    }
  };
};