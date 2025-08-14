import { indexedDBManager, ImageDBRecord } from '@/lib/indexedDb';
import { Annotation } from '@/features/file/hooks/useFileManager';
import { ClassDefinition } from '@/features/project/types';
import { parseYoloFile } from '@/lib/yolo-parser';
import { getImageCompletionStatus } from '@/lib/utils';

export interface ImageFile {
  id: string;
  name: string;
  url: string; // Object URL for display
  type: 'image';
  size: number;
  uploadDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
  annotationData?: Annotation[];
}

class ImageDBService {
  private objectUrls = new Map<string, string>(); // Track object URLs for cleanup

  async uploadFiles(files: FileList, projectId: string): Promise<ImageFile[]> {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    const uploadedImages: ImageFile[] = [];

    // Check storage before uploading
    const storageInfo = await indexedDBManager.getStorageUsage();
    const estimatedSizeNeeded = validFiles.reduce((total, file) => total + file.size, 0);

    if (storageInfo.available < estimatedSizeNeeded) {
      throw new Error(
        `Insufficient storage space. Need ${Math.round(estimatedSizeNeeded / 1024)}KB, have ${Math.round(storageInfo.available / 1024)}KB remaining.`
      );
    }

    for (const file of validFiles) {
      try {
        const imageId = crypto.randomUUID();
        
        const dbRecord: ImageDBRecord = {
          id: imageId,
          projectId,
          name: file.name,
          blob: file,
          size: file.size,
          type: file.type,
          uploadDate: new Date(),
          status: 'pending',
          annotations: 0,
          annotationData: []
        };

        await indexedDBManager.saveImage(dbRecord);

        // Create object URL for display
        const objectUrl = URL.createObjectURL(file);
        this.objectUrls.set(imageId, objectUrl);

        const imageFile: ImageFile = {
          id: imageId,
          name: file.name,
          url: objectUrl,
          type: 'image',
          size: file.size,
          uploadDate: new Date(),
          status: 'pending',
          annotations: 0,
          annotationData: []
        };

        uploadedImages.push(imageFile);
      } catch (error) {
        console.error('Error processing file:', file.name, error);
        throw new Error(`Failed to process file: ${file.name}`);
      }
    }

    return uploadedImages;
  }

  async uploadDirectory(
    files: FileList, 
    projectId: string, 
    classDefinitions: ClassDefinition[]
  ): Promise<ImageFile[]> {
    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter(file => file.type.startsWith('image/'));
    const txtFiles = allFiles.filter(file => file.name.endsWith('.txt'));

    // Create a map of txt files by their base name
    const txtFileMap = new Map<string, File>();
    txtFiles.forEach(file => {
      const baseName = file.name.replace(/\.txt$/, '');
      txtFileMap.set(baseName, file);
    });

    const uploadedImages: ImageFile[] = [];

    for (const imageFile of imageFiles) {
      try {
        const imageId = crypto.randomUUID();

        // Get image dimensions for annotation parsing
        const imageDimensions = await this.getImageDimensions(imageFile);

        // Check for corresponding txt file
        const imageBaseName = imageFile.name.replace(/\.[^/.]+$/, '');
        const txtFile = txtFileMap.get(imageBaseName);

        let annotations: Annotation[] = [];
        if (txtFile) {
          try {
            const txtContent = await this.readTextFile(txtFile);
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

        const dbRecord: ImageDBRecord = {
          id: imageId,
          projectId,
          name: imageFile.name,
          blob: imageFile,
          size: imageFile.size,
          type: imageFile.type,
          uploadDate: new Date(),
          status: getImageCompletionStatus(annotations),
          annotations: annotations.length,
          annotationData: annotations
        };

        await indexedDBManager.saveImage(dbRecord);

        // Create object URL for display
        const objectUrl = URL.createObjectURL(imageFile);
        this.objectUrls.set(imageId, objectUrl);

        const imageFileObj: ImageFile = {
          id: imageId,
          name: imageFile.name,
          url: objectUrl,
          type: 'image',
          size: imageFile.size,
          uploadDate: new Date(),
          status: getImageCompletionStatus(annotations),
          annotations: annotations.length,
          annotationData: annotations
        };

        uploadedImages.push(imageFileObj);
      } catch (error) {
        console.error('Error processing file:', imageFile.name, error);
      }
    }

    return uploadedImages;
  }

  async getProjectImages(projectId: string): Promise<ImageFile[]> {
    try {
      const dbRecords = await indexedDBManager.getImagesByProject(projectId);
      const imageFiles: ImageFile[] = [];

      for (const record of dbRecords) {
        // Create or reuse object URL
        let objectUrl = this.objectUrls.get(record.id);
        if (!objectUrl) {
          objectUrl = URL.createObjectURL(record.blob);
          this.objectUrls.set(record.id, objectUrl);
        }

        const imageFile: ImageFile = {
          id: record.id,
          name: record.name,
          url: objectUrl,
          type: 'image',
          size: record.size,
          uploadDate: record.uploadDate,
          status: record.status,
          annotations: record.annotations,
          annotationData: record.annotationData
        };

        imageFiles.push(imageFile);
      }

      return imageFiles;
    } catch (error) {
      console.error('Error loading project images:', error);
      throw error;
    }
  }

  async updateImageAnnotations(
    imageId: string, 
    annotationData: Annotation[]
  ): Promise<void> {
    const status = getImageCompletionStatus(annotationData);
    
    await indexedDBManager.updateImage(imageId, {
      annotationData,
      annotations: annotationData.length,
      status
    });
  }

  async updateImageStatus(imageId: string, status: 'pending' | 'in-progress' | 'completed'): Promise<void> {
    await indexedDBManager.updateImage(imageId, { status });
  }

  async deleteImage(imageId: string): Promise<void> {
    await indexedDBManager.deleteImage(imageId);
    
    // Clean up object URL
    const objectUrl = this.objectUrls.get(imageId);
    if (objectUrl) {
      URL.revokeObjectURL(objectUrl);
      this.objectUrls.delete(imageId);
    }
  }

  async clearProjectImages(projectId: string): Promise<void> {
    // Get all images for this project to clean up their object URLs
    const images = await this.getProjectImages(projectId);
    
    // Clean up object URLs
    images.forEach(image => {
      const objectUrl = this.objectUrls.get(image.id);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        this.objectUrls.delete(image.id);
      }
    });

    await indexedDBManager.clearProjectImages(projectId);
  }

  async getStorageInfo() {
    return await indexedDBManager.getStorageUsage();
  }

  async getImageBlob(imageId: string): Promise<Blob | null> {
    const record = await indexedDBManager.getImage(imageId);
    return record ? record.blob : null;
  }

  // Cleanup function to revoke all object URLs (call on app unmount)
  cleanup(): void {
    this.objectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.objectUrls.clear();
  }

  private async getImageDimensions(file: File): Promise<{width: number, height: number}> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('Failed to load image dimensions'));
      };
      
      img.src = objectUrl;
    });
  }

  private async readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          resolve(e.target.result as string);
        } else {
          reject(new Error('Failed to read text file'));
        }
      };
      reader.onerror = () => reject(new Error('Text file read error'));
      reader.readAsText(file);
    });
  }
}

// Export singleton instance
export const imageDBService = new ImageDBService();

// Migration function to move data from localStorage to IndexedDB
export async function migrateFromLocalStorage(projectId: string): Promise<boolean> {
  try {
    const localStorageKey = `project-${projectId}-images`;
    const savedImages = localStorage.getItem(localStorageKey);
    
    if (!savedImages) {
      return false; // No data to migrate
    }

    const parsedImages = JSON.parse(savedImages);
    if (!Array.isArray(parsedImages) || parsedImages.length === 0) {
      return false;
    }

    let migratedCount = 0;

    for (const imgData of parsedImages) {
      try {
        if (!imgData.id || !imgData.name || !imgData.url || !imgData.url.startsWith('data:image/')) {
          console.warn('Skipping invalid image data:', imgData.name);
          continue;
        }

        // Convert base64 to blob
        const response = await fetch(imgData.url);
        const blob = await response.blob();

        const dbRecord: ImageDBRecord = {
          id: imgData.id,
          projectId,
          name: imgData.name,
          blob,
          size: imgData.size || blob.size,
          type: blob.type || 'image/jpeg',
          uploadDate: imgData.uploadDate ? new Date(imgData.uploadDate) : new Date(),
          status: imgData.status || 'pending',
          annotations: imgData.annotations || 0,
          annotationData: imgData.annotationData || []
        };

        await indexedDBManager.saveImage(dbRecord);
        migratedCount++;
      } catch (error) {
        console.error(`Failed to migrate image ${imgData.name}:`, error);
      }
    }

    if (migratedCount > 0) {
      // Mark migration as completed
      await indexedDBManager.saveMetadata(`migrated-${projectId}`, {
        migratedAt: new Date(),
        migratedCount,
        originalCount: parsedImages.length
      });

      // Optionally remove localStorage data after successful migration
      localStorage.removeItem(localStorageKey);
      
      console.log(`Successfully migrated ${migratedCount}/${parsedImages.length} images for project ${projectId}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('Migration failed:', error);
    return false;
  }
}

// Check if project has been migrated
export async function isMigrated(projectId: string): Promise<boolean> {
  try {
    const migrationData = await indexedDBManager.getMetadata(`migrated-${projectId}`);
    return migrationData !== null;
  } catch (error) {
    console.error('Failed to check migration status:', error);
    return false;
  }
}