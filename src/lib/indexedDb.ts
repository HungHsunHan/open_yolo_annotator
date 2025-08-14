import { Annotation } from "@/features/file/hooks/useFileManager";

export interface ImageDBRecord {
  id: string;
  projectId: string;
  name: string;
  blob: Blob;
  size: number;
  type: string;
  uploadDate: Date;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
  annotationData?: Annotation[];
}

class IndexedDBManager {
  private dbName = 'YoloAnnotatorDB';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for images
        if (!db.objectStoreNames.contains('images')) {
          const imageStore = db.createObjectStore('images', { keyPath: 'id' });
          
          // Create indexes for efficient queries
          imageStore.createIndex('projectId', 'projectId', { unique: false });
          imageStore.createIndex('name', 'name', { unique: false });
          imageStore.createIndex('uploadDate', 'uploadDate', { unique: false });
          imageStore.createIndex('status', 'status', { unique: false });
        }

        // Create object store for metadata
        if (!db.objectStoreNames.contains('metadata')) {
          db.createObjectStore('metadata', { keyPath: 'key' });
        }
      };
    });
  }

  private async ensureConnection(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to establish IndexedDB connection');
    }
    return this.db;
  }

  async saveImage(image: ImageDBRecord): Promise<void> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.put(image);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save image: ${request.error?.message}`));
    });
  }

  async getImage(id: string): Promise<ImageDBRecord | null> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        const result = request.result;
        if (result) {
          // Ensure Date objects are properly restored
          result.uploadDate = new Date(result.uploadDate);
        }
        resolve(result || null);
      };
      request.onerror = () => reject(new Error(`Failed to get image: ${request.error?.message}`));
    });
  }

  async getImagesByProject(projectId: string): Promise<ImageDBRecord[]> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      const index = store.index('projectId');
      
      const request = index.getAll(projectId);
      
      request.onsuccess = () => {
        const results = request.result || [];
        // Ensure Date objects are properly restored
        results.forEach(result => {
          result.uploadDate = new Date(result.uploadDate);
        });
        resolve(results);
      };
      request.onerror = () => reject(new Error(`Failed to get project images: ${request.error?.message}`));
    });
  }

  async deleteImage(id: string): Promise<void> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to delete image: ${request.error?.message}`));
    });
  }

  async clearProjectImages(projectId: string): Promise<void> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readwrite');
      const store = transaction.objectStore('images');
      const index = store.index('projectId');
      
      const request = index.openCursor(projectId);
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      
      request.onerror = () => reject(new Error(`Failed to clear project images: ${request.error?.message}`));
    });
  }

  async updateImage(id: string, updates: Partial<ImageDBRecord>): Promise<void> {
    const existing = await this.getImage(id);
    if (!existing) {
      throw new Error(`Image ${id} not found`);
    }

    const updated = { ...existing, ...updates };
    await this.saveImage(updated);
  }

  async getStorageUsage(): Promise<{ used: number; total: number; available: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      try {
        const estimate = await navigator.storage.estimate();
        const used = estimate.usage || 0;
        const quota = estimate.quota || 0;
        
        return {
          used,
          total: quota,
          available: quota - used
        };
      } catch (e) {
        console.warn('Failed to get storage estimate:', e);
      }
    }

    // Fallback: estimate based on data size
    const images = await this.getAllImages();
    const estimatedUsage = images.reduce((total, img) => total + img.size, 0);
    
    return {
      used: estimatedUsage,
      total: 100 * 1024 * 1024, // Assume 100MB quota
      available: (100 * 1024 * 1024) - estimatedUsage
    };
  }

  async getAllImages(): Promise<ImageDBRecord[]> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['images'], 'readonly');
      const store = transaction.objectStore('images');
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const results = request.result || [];
        // Ensure Date objects are properly restored
        results.forEach(result => {
          result.uploadDate = new Date(result.uploadDate);
        });
        resolve(results);
      };
      request.onerror = () => reject(new Error(`Failed to get all images: ${request.error?.message}`));
    });
  }

  async saveMetadata(key: string, value: unknown): Promise<void> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readwrite');
      const store = transaction.objectStore('metadata');
      
      const request = store.put({ key, value, timestamp: new Date() });
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(new Error(`Failed to save metadata: ${request.error?.message}`));
    });
  }

  async getMetadata(key: string): Promise<unknown> {
    const db = await this.ensureConnection();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(['metadata'], 'readonly');
      const store = transaction.objectStore('metadata');
      
      const request = store.get(key);
      
      request.onsuccess = () => {
        const result = request.result;
        resolve(result ? result.value : null);
      };
      request.onerror = () => reject(new Error(`Failed to get metadata: ${request.error?.message}`));
    });
  }
}

// Export singleton instance
export const indexedDBManager = new IndexedDBManager();

// Initialize on module load
indexedDBManager.init().catch(console.error);