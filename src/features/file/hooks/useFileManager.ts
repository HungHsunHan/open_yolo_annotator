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
        try {
          const parsedImages = JSON.parse(savedImages).map((img: any) => ({
            ...img,
            uploadDate: new Date(img.uploadDate)
          }));
          setImages(parsedImages);
        } catch (e) {
          console.error("Failed to parse saved images:", e);
          setImages([]);
        }
      }
    }
  }, [projectId]);

  // Save images to localStorage whenever they change
  useEffect(() => {
    if (projectId && images.length > 0) {
      try {
        localStorage.setItem(`project-${projectId}-images`, JSON.stringify(images));
      } catch (e) {
        console.error("Failed to save images:", e);
      }
    } else if (projectId) {
      // Clear storage if no images
      localStorage.removeItem(`project-${projectId}-images`);
    }
  }, [images, projectId]);

  const uploadFiles = async (files: FileList) => {
    setIsLoading(true);
    
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    for (const file of validFiles) {
      try {
        // Convert file to base64 for persistence
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            if (e.target?.result) {
              resolve(e.target.result as string);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = () => reject(new Error("File read error"));
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
      } catch (error) {
        console.error("Error processing file:", file.name, error);
      }
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