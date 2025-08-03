"use client";

import { useState, useEffect } from "react";

export interface ImageFile {
  id: string;
  name: string;
  url: string;
  type: 'image';
  size: number;
  uploadDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
}

export const useFileManager = (projectId: string) => {
  const [images, setImages] = useState<ImageFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load images from localStorage when project changes
  useEffect(() => {
    if (projectId) {
      const savedImages = localStorage.getItem(`project-${projectId}-images`);
      if (savedImages) {
        const parsedImages = JSON.parse(savedImages).map((img: any) => ({
          ...img,
          uploadDate: new Date(img.uploadDate)
        }));
        setImages(parsedImages);
      }
    }
  }, [projectId]);

  // Save images to localStorage whenever they change
  useEffect(() => {
    if (projectId && images.length > 0) {
      localStorage.setItem(`project-${projectId}-images`, JSON.stringify(images));
    }
  }, [images, projectId]);

  const uploadFiles = async (files: FileList) => {
    setIsLoading(true);
    
    const newImages: ImageFile[] = Array.from(files)
      .filter(file => file.type.startsWith('image/'))
      .map(file => {
        // Convert file to base64 for persistence
        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        return {
          id: crypto.randomUUID(),
          name: file.name,
          url: URL.createObjectURL(file), // Temporary URL for immediate use
          type: 'image' as const,
          size: file.size,
          uploadDate: new Date(),
          status: 'pending' as const,
          annotations: 0
        };
      });

    // Convert files to base64 for persistence
    for (const file of Array.from(files).filter(file => file.type.startsWith('image/'))) {
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });

      const newImage: ImageFile = {
        id: crypto.randomUUID(),
        name: file.name,
        url: base64, // Use base64 for persistence
        type: 'image' as const,
        size: file.size,
        uploadDate: new Date(),
        status: 'pending' as const,
        annotations: 0
      };

      setImages(prev => [...prev, newImage]);
    }
    
    setIsLoading(false);
  };

  const updateImageStatus = (imageId: string, status: ImageFile['status']) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, status } : img
    ));
  };

  const updateImageAnnotations = (imageId: string, annotations: number) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, annotations } : img
    ));
  };

  const deleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const clearAllImages = () => {
    setImages([]);
    if (projectId) {
      localStorage.removeItem(`project-${projectId}-images`);
    }
  };

  return { 
    images, 
    uploadFiles, 
    updateImageStatus, 
    updateImageAnnotations, 
    deleteImage, 
    clearAllImages,
    isLoading 
  };
};