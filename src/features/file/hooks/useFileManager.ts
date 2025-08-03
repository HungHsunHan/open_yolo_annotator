"use client";

import { useState, useEffect } from "react";
import { parseYoloFile } from "@/lib/yolo-parser";
import { ClassDefinition } from "@/features/project/types";

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

export interface ImageFile {
  id: string;
  name: string;
  url: string;
  type: 'image';
  size: number;
  uploadDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
  annotationData?: Annotation[];
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
            uploadDate: new Date(img.uploadDate),
            // Ensure annotationData exists and status is correct
            annotationData: img.annotationData || [],
            status: (img.annotationData && img.annotationData.length > 0) ? 'completed' : 'pending',
            annotations: img.annotationData ? img.annotationData.length : 0
          }));
          
          // Validate that images have proper base64 URLs
          const validImages = parsedImages.filter((img: any) => {
            if (!img.url || !img.url.startsWith('data:image/')) {
              console.warn(`Invalid image URL for ${img.name}, removing from list`);
              return false;
            }
            return true;
          });
          
          setImages(validImages);
        } catch (e) {
          console.error("Failed to parse saved images:", e);
          setImages([]);
          // Clear corrupted data
          localStorage.removeItem(`project-${projectId}-images`);
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
          annotations: 0,
          annotationData: []
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

  const updateImageAnnotationData = (imageId: string, annotationData: Annotation[]) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { 
        ...img, 
        annotations: annotationData.length,
        annotationData 
      } : img
    ));
  };

  const deleteImage = (imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  };

  const clearAllImages = () => {
    setImages([]);
  };

  const uploadDirectory = async (files: FileList, classDefinitions: ClassDefinition[]) => {
    setIsLoading(true);
    
    try {
      // Separate image files and txt files
      const allFiles = Array.from(files);
      const imageFiles = allFiles.filter(file => file.type.startsWith('image/'));
      const txtFiles = allFiles.filter(file => file.name.endsWith('.txt'));
      
      // Create a map of txt files by their base name (without extension)
      const txtFileMap = new Map<string, File>();
      txtFiles.forEach(file => {
        const baseName = file.name.replace(/\.txt$/, '');
        txtFileMap.set(baseName, file);
      });
      
      // Process each image file
      for (const imageFile of imageFiles) {
        try {
          // Convert image to base64
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
              if (e.target?.result) {
                resolve(e.target.result as string);
              } else {
                reject(new Error("Failed to read image file"));
              }
            };
            reader.onerror = () => reject(new Error("Image file read error"));
            reader.readAsDataURL(imageFile);
          });

          // Get image dimensions
          const imageDimensions = await new Promise<{width: number, height: number}>((resolve) => {
            const img = new Image();
            img.onload = () => {
              resolve({ width: img.width, height: img.height });
            };
            img.src = base64;
          });

          // Check for corresponding txt file
          const imageBaseName = imageFile.name.replace(/\.[^/.]+$/, '');
          const txtFile = txtFileMap.get(imageBaseName);
          
          let annotations: Annotation[] = [];
          if (txtFile) {
            try {
              // Read and parse txt file
              const txtContent = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => {
                  if (e.target?.result) {
                    resolve(e.target.result as string);
                  } else {
                    reject(new Error("Failed to read txt file"));
                  }
                };
                reader.onerror = () => reject(new Error("Txt file read error"));
                reader.readAsText(txtFile);
              });

              // Parse YOLO annotations
              annotations = parseYoloFile(
                txtContent, 
                imageDimensions.width, 
                imageDimensions.height, 
                classDefinitions
              );
            } catch (error) {
              console.warn(`Failed to parse annotations for ${imageFile.name}:`, error);
            }
          }

          // Create image object
          const newImage: ImageFile = {
            id: crypto.randomUUID(),
            name: imageFile.name,
            url: base64,
            type: 'image' as const,
            size: imageFile.size,
            uploadDate: new Date(),
            status: annotations.length > 0 ? 'completed' : 'pending',
            annotations: annotations.length,
            annotationData: annotations
          };

          setImages(prev => [...prev, newImage]);
        } catch (error) {
          console.error("Error processing file:", imageFile.name, error);
        }
      }
    } catch (error) {
      console.error("Error uploading directory:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { 
    images, 
    uploadFiles, 
    uploadDirectory,
    updateImageStatus, 
    updateImageAnnotations, 
    updateImageAnnotationData,
    deleteImage, 
    clearAllImages,
    isLoading 
  };
};