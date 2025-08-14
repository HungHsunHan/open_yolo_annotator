import { apiClient } from '@/lib/api';
import { Annotation } from '@/features/file/hooks/useFileManager';
import { ClassDefinition } from '@/features/project/types';
import { parseYoloFile } from '@/lib/yolo-parser';
import { getImageCompletionStatus } from '@/lib/utils';

export interface ImageFile {
  id: string;
  name: string;
  url: string; // API URL for image download
  type: 'image';
  size: number;
  uploadDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
  annotationData?: Annotation[];
}

class ApiImageService {
  private imageUrls = new Map<string, string>(); // Track blob URLs for cleanup

  private async buildImageFileFromApi(img: any): Promise<ImageFile> {
    // Try to download blob with auth and build an object URL
    try {
      const blob = await apiClient.downloadImage(img.id);
      const objectUrl = URL.createObjectURL(blob);
      // Track for cleanup
      this.imageUrls.set(img.id, objectUrl);

      return {
        id: img.id,
        name: img.name,
        url: objectUrl,
        type: 'image' as const,
        size: img.size,
        uploadDate: new Date(img.upload_date),
        status: img.status,
        annotations: img.annotations || 0,
        annotationData: [],
      };
    } catch (e) {
      // Fallback to an inline placeholder if download fails
      const placeholder =
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBhdGggZD0iTTIxIDE1bC01LTVMNSAyMSIvPjwvc3ZnPg==';
      return {
        id: img.id,
        name: img.name,
        url: placeholder,
        type: 'image' as const,
        size: img.size,
        uploadDate: new Date(img.upload_date),
        status: img.status,
        annotations: img.annotations || 0,
        annotationData: [],
      };
    }
  }

  async uploadFiles(files: FileList | Iterable<File>, projectId: string): Promise<ImageFile[]> {
    try {
      const uploadedImages = await apiClient.uploadImages(projectId, files);

      // Convert API response to frontend format with authorized object URLs
      const results = await Promise.all(
        uploadedImages.map((img: any) => this.buildImageFileFromApi(img))
      );
      return results;
    } catch (error) {
      console.error('Upload failed:', error);
      throw error;
    }
  }

  async uploadDirectory(
    files: FileList,
    projectId: string,
    classDefinitions: ClassDefinition[]
  ): Promise<ImageFile[]> {
    const allFiles = Array.from(files);
    const imageFiles = allFiles.filter((file) => file.type.startsWith('image/'));
    const txtFiles = allFiles.filter((file) => file.name.endsWith('.txt'));

    // Create a map of txt files by their base name
    const txtFileMap = new Map<string, File>();
    txtFiles.forEach((file) => {
      const baseName = file.name.replace(/\.txt$/, '');
      txtFileMap.set(baseName, file);
    });

    // First upload all images
    const uploadedImages = await this.uploadFiles(imageFiles, projectId);

    // Then process annotations for uploaded images
    for (const imageFile of uploadedImages) {
      try {
        // Check for corresponding txt file
        const imageBaseName = imageFile.name.replace(/\.[^/.]+$/, '');
        const txtFile = txtFileMap.get(imageBaseName);

        if (txtFile) {
          try {
            const txtContent = await this.readTextFile(txtFile);

            // Get image dimensions by downloading the image
            const imageDimensions = await this.getImageDimensions(imageFile.url);

            const annotations = parseYoloFile(
              txtContent,
              imageDimensions.width,
              imageDimensions.height,
              classDefinitions
            );

            // Save annotations to server
            if (annotations.length > 0) {
              await this.updateImageAnnotations(imageFile.id, annotations);
              imageFile.annotationData = annotations;
              imageFile.annotations = annotations.length;
              imageFile.status = getImageCompletionStatus(annotations);
            }
          } catch (error) {
            console.warn(`Failed to parse annotations for ${imageFile.name}:`, error);
          }
        }
      } catch (error) {
        console.error('Error processing annotations for:', imageFile.name, error);
      }
    }

    return uploadedImages;
  }

  async getProjectImages(projectId: string): Promise<ImageFile[]> {
    try {
      const images = await apiClient.getProjectImages(projectId);

      // Revoke any existing object URLs before rebuilding list
      this.imageUrls.forEach((url) => URL.revokeObjectURL(url));
      this.imageUrls.clear();

      const results = await Promise.all(
        images.map((img: any) => this.buildImageFileFromApi(img))
      );
      return results;
    } catch (error) {
      console.error('Failed to load project images:', error);
      throw error;
    }
  }

  async updateImageAnnotations(
    imageId: string,
    annotationData: Annotation[]
  ): Promise<void> {
    try {
      await apiClient.saveAnnotations(imageId, annotationData);
    } catch (error) {
      console.error('Failed to save annotations:', error);
      throw error;
    }
  }

  async updateImageStatus(imageId: string, status: 'pending' | 'in-progress' | 'completed'): Promise<void> {
    try {
      await apiClient.updateImage(imageId, { status });
    } catch (error) {
      console.error('Failed to update image status:', error);
      throw error;
    }
  }

  async deleteImage(imageId: string): Promise<void> {
    try {
      await apiClient.deleteImage(imageId);

      // Clean up any cached URLs
      const objectUrl = this.imageUrls.get(imageId);
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        this.imageUrls.delete(imageId);
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      throw error;
    }
  }

  async clearProjectImages(projectId: string): Promise<void> {
    try {
      // Get all images first to clean up URLs
      const images = await this.getProjectImages(projectId);

      // Delete each image
      await Promise.all(images.map((img) => this.deleteImage(img.id)));

      // Clean up any remaining URLs
      images.forEach((image) => {
        const objectUrl = this.imageUrls.get(image.id);
        if (objectUrl) {
          URL.revokeObjectURL(objectUrl);
          this.imageUrls.delete(image.id);
        }
      });
    } catch (error) {
      console.error('Failed to clear project images:', error);
      throw error;
    }
  }

  async getStorageInfo() {
    // For API-based storage, return server storage stats
    // This would need to be implemented on the server side
    return {
      used: 0,
      total: 1000 * 1024 * 1024, // 1GB placeholder
      available: 1000 * 1024 * 1024,
    };
  }

  async getImageBlob(imageId: string): Promise<Blob | null> {
    try {
      return await apiClient.downloadImage(imageId);
    } catch (error) {
      console.error('Failed to download image blob:', error);
      return null;
    }
  }

  // Helper function to get image dimensions from API image
  private async getImageDimensions(imageUrl: string): Promise<{ width: number; height: number }> {
    // Note: imageUrl may be an object URL now
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.onerror = () => {
        reject(new Error('Failed to load image dimensions'));
      };
      img.src = imageUrl;
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

  // Cleanup function to revoke all object URLs (call on app unmount)
  cleanup(): void {
    this.imageUrls.forEach((url) => {
      URL.revokeObjectURL(url);
    });
    this.imageUrls.clear();
  }
}

// Export singleton instance
export const apiImageService = new ApiImageService();