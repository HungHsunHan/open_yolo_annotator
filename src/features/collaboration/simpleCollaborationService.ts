import { SimpleCollaborationState, ProjectAccessResult } from './types';

// Simple collaboration service that limits projects to 2 concurrent users
export class SimpleCollaborationService {
  private static instance: SimpleCollaborationService;
  private currentUserId: string = '';
  private currentUsername: string = '';
  private currentSessionId: string = '';
  private heartbeatInterval: number | null = null;

  static getInstance(): SimpleCollaborationService {
    if (!this.instance) {
      this.instance = new SimpleCollaborationService();
    }
    return this.instance;
  }

  private constructor() {
    // Listen for storage changes from other tabs/sessions
    window.addEventListener('storage', this.handleStorageChange.bind(this));
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', this.cleanup.bind(this));
  }

  initialize(userId: string, username: string) {
    this.currentUserId = userId;
    this.currentUsername = username;
    this.currentSessionId = this.generateSessionId();
    this.startHeartbeat();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStorageKey(projectId: string): string {
    return `simple-collaboration-${projectId}`;
  }

  // Check if user can access project (max 2 users)
  async checkProjectAccess(projectId: string): Promise<ProjectAccessResult> {
    const state = this.getCollaborationState(projectId);
    const now = new Date();
    
    // Clean up inactive users (inactive for more than 5 minutes)
    const activeUsers = state.activeUsers.filter(user => 
      now.getTime() - user.lastActivity.getTime() < 5 * 60 * 1000
    );

    // Check if current user is already in the project
    const currentUserExists = activeUsers.find(user => user.userId === this.currentUserId);
    
    if (currentUserExists) {
      // Update existing user's activity
      currentUserExists.lastActivity = now;
      currentUserExists.sessionId = this.currentSessionId;
      this.saveCollaborationState(projectId, { ...state, activeUsers });
      
      return {
        allowed: true,
        currentUsers: activeUsers.map(u => u.username)
      };
    }

    // Check if we've reached the limit
    if (activeUsers.length >= state.maxUsers) {
      return {
        allowed: false,
        reason: 'max_users_reached',
        currentUsers: activeUsers.map(u => u.username)
      };
    }

    // Add current user to active users
    activeUsers.push({
      userId: this.currentUserId,
      username: this.currentUsername,
      sessionId: this.currentSessionId,
      lastActivity: now
    });

    this.saveCollaborationState(projectId, { ...state, activeUsers });

    return {
      allowed: true,
      currentUsers: activeUsers.map(u => u.username)
    };
  }

  // Remove user from project
  async leaveProject(projectId: string): Promise<void> {
    const state = this.getCollaborationState(projectId);
    const activeUsers = state.activeUsers.filter(user => user.userId !== this.currentUserId);
    
    this.saveCollaborationState(projectId, { ...state, activeUsers });
  }

  // Update user's current image
  async updateCurrentImage(projectId: string, imageId?: string): Promise<void> {
    const state = this.getCollaborationState(projectId);
    const user = state.activeUsers.find(u => u.userId === this.currentUserId);
    
    if (user) {
      user.currentImageId = imageId;
      user.lastActivity = new Date();
      this.saveCollaborationState(projectId, state);
    }
  }

  // Get current project state
  getCollaborationState(projectId: string): SimpleCollaborationState {
    const stored = localStorage.getItem(this.getStorageKey(projectId));
    if (!stored) {
      return this.createInitialState(projectId);
    }
    
    try {
      const parsed = JSON.parse(stored);
      return {
        ...parsed,
        lastSync: new Date(parsed.lastSync),
        activeUsers: parsed.activeUsers.map((user: any) => ({
          ...user,
          lastActivity: new Date(user.lastActivity)
        }))
      };
    } catch (error) {
      console.error('Failed to parse simple collaboration state:', error);
      return this.createInitialState(projectId);
    }
  }

  private createInitialState(projectId: string): SimpleCollaborationState {
    return {
      projectId,
      activeUsers: [],
      maxUsers: 2, // Simple limit: only 2 users can work on a project simultaneously
      lastSync: new Date()
    };
  }

  private saveCollaborationState(projectId: string, state: SimpleCollaborationState): void {
    state.lastSync = new Date();
    localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(state));
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Update heartbeat every 30 seconds
    this.heartbeatInterval = window.setInterval(() => {
      // This will be called by the hook to update activity
    }, 30000);
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key?.startsWith('simple-collaboration-')) {
      // Notify listeners of changes (for future use)
      console.log('Simple collaboration state changed for project:', event.key);
    }
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }

  // Get active users for a project
  getActiveUsers(projectId: string): string[] {
    const state = this.getCollaborationState(projectId);
    const now = new Date();
    
    // Filter out inactive users
    const activeUsers = state.activeUsers.filter(user => 
      now.getTime() - user.lastActivity.getTime() < 5 * 60 * 1000
    );
    
    return activeUsers.map(user => user.username);
  }
}