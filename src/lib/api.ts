const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ApiResponse<T> {
  data?: T;
  error?: string;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
    // Load token from localStorage on init
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string | null) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = this.getHeaders();

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Network error' }));
        throw new Error(errorData.detail || `HTTP ${response.status}`);
      }

      // Handle empty responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return {} as T;
      }
    } catch (error) {
      console.error(`API Error for ${endpoint}:`, error);
      throw error;
    }
  }

  // Auth endpoints
  async login(username: string, password: string) {
    const response = await this.request<{
      access_token: string;
      token_type: string;
      user: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    this.setToken(response.access_token);
    return response;
  }

  async getCurrentUser() {
    return this.request<any>('/auth/me');
  }

  async register(username: string, password: string, role: 'admin' | 'annotator') {
    return this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ username, password, role }),
    });
  }

  // User endpoints
  async getUsers() {
    return this.request<any[]>('/users');
  }

  async updateUser(userId: string, updates: any) {
    return this.request(`/users/${userId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteUser(userId: string) {
    return this.request(`/users/${userId}`, {
      method: 'DELETE',
    });
  }

  // Project endpoints
  async getProjects() {
    return this.request<any[]>('/projects');
  }

  async createProject(projectData: any) {
    return this.request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData),
    });
  }

  async getProject(projectId: string) {
    return this.request(`/projects/${projectId}`);
  }

  async updateProject(projectId: string, updates: any) {
    return this.request(`/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteProject(projectId: string) {
    return this.request(`/projects/${projectId}`, {
      method: 'DELETE',
    });
  }

  async assignUserToProject(projectId: string, userId: string) {
    return this.request(`/projects/${projectId}/assign/${userId}`, {
      method: 'POST',
    });
  }

  async unassignUserFromProject(projectId: string, userId: string) {
    return this.request(`/projects/${projectId}/assign/${userId}`, {
      method: 'DELETE',
    });
  }

  // Image endpoints
  async getProjectImages(projectId: string) {
    return this.request<any[]>(`/projects/${projectId}/images`);
  }

  async uploadImages(projectId: string, files: FileList | Iterable<File>) {
    const formData = new FormData();

    // Narrow types and append files safely
    if (typeof (files as any)?.[Symbol.iterator] === 'function' && !(files as FileList).item) {
      for (const file of files as Iterable<File>) {
        formData.append('files', file, file.name);
      }
    } else {
      const fl = files as FileList;
      for (let i = 0; i < fl.length; i++) {
        const f = fl.item(i);
        if (f) formData.append('files', f, f.name);
      }
    }

    const headers: Record<string, string> = {};
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/images/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Upload failed' }));
      throw new Error(errorData.detail || `Upload failed: ${response.status}`);
    }

    return response.json();
  }

  async downloadImage(imageId: string): Promise<Blob> {
    const url = `${this.baseUrl}/images/${imageId}/download`;
    const headers = this.getHeaders();
    
    console.log(`[apiClient] Downloading image from: ${url}`);
    console.log(`[apiClient] Request headers:`, headers);
    console.log(`[apiClient] Auth token present:`, this.token ? 'YES' : 'NO');
    
    try {
      const response = await fetch(url, {
        headers,
      });

      console.log(`[apiClient] Download response status: ${response.status} ${response.statusText}`);
      console.log(`[apiClient] Download response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        console.error(`[apiClient] Download failed with status ${response.status}:`, errorText);
        throw new Error(`Failed to download image: ${response.status} - ${errorText}`);
      }

      const blob = await response.blob();
      console.log(`[apiClient] Successfully downloaded blob: ${blob.size} bytes, type: ${blob.type}`);
      return blob;
    } catch (error) {
      console.error(`[apiClient] Download error for image ${imageId}:`, error);
      throw error;
    }
  }

  async updateImage(imageId: string, updates: any) {
    return this.request(`/images/${imageId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  }

  async deleteImage(imageId: string) {
    return this.request(`/images/${imageId}`, {
      method: 'DELETE',
    });
  }

  // Annotation endpoints
  async saveAnnotations(imageId: string, annotations: any[]) {
    return this.request(`/images/${imageId}/annotations`, {
      method: 'POST',
      body: JSON.stringify(annotations),
    });
  }

  async getAnnotations(imageId: string) {
    return this.request<any[]>(`/images/${imageId}/annotations`);
  }

  async downloadAnnotations(imageId: string): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/images/${imageId}/annotations/download`, {
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Failed to download annotations: ${response.status}`);
    }

    return response.blob();
  }
}

// Export singleton instance
export const apiClient = new ApiClient();