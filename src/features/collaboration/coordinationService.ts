import { CollaborationState, UserSession, ImageAssignment, UserActivity } from './types';

// Coordination service for managing shared state across browser sessions
export class CoordinationService {
  private static instance: CoordinationService;
  private listeners: Set<(state: CollaborationState) => void> = new Set();
  private currentUserId: string = '';
  private currentUsername: string = '';
  private currentSessionId: string = '';
  private heartbeatInterval: number | null = null;
  private syncInterval: number | null = null;

  static getInstance(): CoordinationService {
    if (!this.instance) {
      this.instance = new CoordinationService();
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
    this.startSyncTimer();
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getStorageKey(projectId: string): string {
    return `collaboration-${projectId}`;
  }

  private getLockKey(resource: string): string {
    return `lock-${resource}`;
  }

  // Atomic operations using timestamp-based locking
  private async withLock<T>(resource: string, operation: () => Promise<T>): Promise<T> {
    const lockKey = this.getLockKey(resource);
    const lockTimeout = 5000; // 5 second timeout
    const lockValue = `${this.currentSessionId}-${Date.now()}`;
    
    // Try to acquire lock
    const startTime = Date.now();
    while (Date.now() - startTime < lockTimeout) {
      const existingLock = localStorage.getItem(lockKey);
      if (!existingLock || this.isLockExpired(existingLock)) {
        localStorage.setItem(lockKey, lockValue);
        
        // Verify we got the lock (race condition check)
        if (localStorage.getItem(lockKey) === lockValue) {
          try {
            const result = await operation();
            localStorage.removeItem(lockKey);
            return result;
          } catch (error) {
            localStorage.removeItem(lockKey);
            throw error;
          }
        }
      }
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    throw new Error(`Failed to acquire lock for ${resource}`);
  }

  private isLockExpired(lockValue: string): boolean {
    const parts = lockValue.split('-');
    const timestamp = parseInt(parts[parts.length - 1]);
    return Date.now() - timestamp > 5000; // 5 second expiry
  }

  getCollaborationState(projectId: string): CollaborationState {
    const stored = localStorage.getItem(this.getStorageKey(projectId));
    if (!stored) {
      return this.createInitialState(projectId);
    }
    
    try {
      const parsed = JSON.parse(stored);
      // Convert date strings back to Date objects
      return {
        ...parsed,
        lastSync: new Date(parsed.lastSync),
        activeSessions: Object.fromEntries(
          Object.entries(parsed.activeSessions || {}).map(([key, session]: [string, any]) => [
            key,
            {
              ...session,
              lastHeartbeat: new Date(session.lastHeartbeat),
              loginTime: new Date(session.loginTime || session.lastHeartbeat) // fallback for existing sessions
            }
          ])
        ),
        assignments: Object.fromEntries(
          Object.entries(parsed.assignments || {}).map(([key, assignment]: [string, any]) => [
            key,
            {
              ...assignment,
              assignedAt: new Date(assignment.assignedAt),
              lockedUntil: new Date(assignment.lockedUntil),
              lastActivity: new Date(assignment.lastActivity)
            }
          ])
        ),
        activities: (parsed.activities || []).map((activity: any) => ({
          ...activity,
          timestamp: new Date(activity.timestamp)
        }))
      };
    } catch (error) {
      console.error('Failed to parse collaboration state:', error);
      return this.createInitialState(projectId);
    }
  }

  private createInitialState(projectId: string): CollaborationState {
    return {
      projectId,
      activeSessions: {},
      assignments: {},
      activities: [],
      conflicts: [],
      lastSync: new Date()
    };
  }

  async updateCollaborationState(
    projectId: string, 
    updater: (state: CollaborationState) => CollaborationState
  ): Promise<CollaborationState> {
    return this.withLock(`state-${projectId}`, async () => {
      const currentState = this.getCollaborationState(projectId);
      const newState = updater(currentState);
      newState.lastSync = new Date();
      
      localStorage.setItem(this.getStorageKey(projectId), JSON.stringify(newState));
      this.notifyListeners(newState);
      
      return newState;
    });
  }

  // Session management
  async registerSession(projectId: string): Promise<UserSession> {
    // First, perform immediate cleanup of inactive sessions and expired assignments
    await this.cleanupInactiveSessions(projectId);
    
    const now = new Date();
    const session: UserSession = {
      userId: this.currentUserId,
      username: this.currentUsername,
      sessionId: this.currentSessionId,
      projectId,
      lastHeartbeat: now,
      loginTime: now,
      isActive: true
    };

    await this.updateCollaborationState(projectId, (state) => {
      // Remove any old sessions for the same user to prevent duplicates
      const cleanedSessions: Record<string, UserSession> = {};
      const cleanedAssignments = { ...state.assignments };
      
      Object.entries(state.activeSessions).forEach(([sessionId, existingSession]) => {
        if (existingSession.username !== this.currentUsername) {
          cleanedSessions[sessionId] = existingSession;
        } else {
          // Release any assignments from old sessions of the same user
          Object.entries(state.assignments).forEach(([imageId, assignment]) => {
            if (assignment.assignedTo === this.currentUsername) {
              cleanedAssignments[imageId] = {
                ...assignment,
                status: 'available',
                assignedTo: '',
                lastActivity: now
              };
            }
          });
        }
      });

      return {
        ...state,
        activeSessions: {
          ...cleanedSessions,
          [this.currentSessionId]: session
        },
        assignments: cleanedAssignments
      };
    });

    return session;
  }

  async updateHeartbeat(projectId: string, currentImageId?: string): Promise<void> {
    await this.updateCollaborationState(projectId, (state) => {
      const session = state.activeSessions[this.currentSessionId];
      if (session) {
        return {
          ...state,
          activeSessions: {
            ...state.activeSessions,
            [this.currentSessionId]: {
              ...session,
              lastHeartbeat: new Date(),
              currentImageId,
              isActive: true,
              loginTime: session.loginTime // preserve original login time
            }
          }
        };
      }
      return state;
    });
  }

  async cleanupInactiveSessions(projectId: string): Promise<void> {
    const inactivityThreshold = 3 * 1000; // 3 seconds for faster cleanup
    const now = new Date();

    await this.updateCollaborationState(projectId, (state) => {
      const activeSessions: Record<string, UserSession> = {};
      const expiredAssignments: string[] = [];
      const userLatestSessions: Record<string, UserSession> = {};

      // First, find the latest session for each user
      Object.entries(state.activeSessions).forEach(([sessionId, session]) => {
        const timeSinceLastHeartbeat = now.getTime() - session.lastHeartbeat.getTime();
        
        if (timeSinceLastHeartbeat < inactivityThreshold) {
          const existing = userLatestSessions[session.username];
          // Keep the session with the latest heartbeat, but preserve the earliest login time
          if (!existing || session.lastHeartbeat > existing.lastHeartbeat) {
            userLatestSessions[session.username] = {
              ...session,
              loginTime: existing?.loginTime && existing.loginTime < session.loginTime 
                ? existing.loginTime 
                : session.loginTime
            };
          }
        } else {
          // Mark assignments from inactive sessions as available
          Object.entries(state.assignments).forEach(([imageId, assignment]) => {
            if (assignment.assignedTo === session.username) {
              expiredAssignments.push(imageId);
            }
          });
        }
      });

      // Only keep the latest session for each active user
      Object.values(userLatestSessions).forEach(session => {
        activeSessions[session.sessionId] = session;
      });

      // Release assignments from inactive sessions
      const updatedAssignments = { ...state.assignments };
      expiredAssignments.forEach(imageId => {
        if (updatedAssignments[imageId]) {
          updatedAssignments[imageId] = {
            ...updatedAssignments[imageId],
            status: 'available',
            assignedTo: '',
            lastActivity: now
          };
        }
      });

      return {
        ...state,
        activeSessions,
        assignments: updatedAssignments
      };
    });
  }

  // Assignment management
  async assignImage(
    projectId: string, 
    imageId: string, 
    userId: string, 
    lockReason: 'annotation' | 'manual' | 'auto' = 'manual'
  ): Promise<ImageAssignment | null> {
    return this.updateCollaborationState(projectId, (state) => {
      const existingAssignment = state.assignments[imageId];
      
      // Check if image is already assigned and locked
      if (existingAssignment && 
          existingAssignment.status === 'locked' && 
          existingAssignment.assignedTo !== userId &&
          new Date() < existingAssignment.lockedUntil) {
        return state; // Cannot assign, already locked
      }

      const now = new Date();
      const lockDuration = 30 * 60 * 1000; // 30 minutes default
      
      const assignment: ImageAssignment = {
        imageId,
        projectId,
        assignedTo: userId,
        assignedBy: this.currentUserId,
        assignedAt: now,
        lockedUntil: new Date(now.getTime() + lockDuration),
        status: lockReason === 'annotation' ? 'locked' : 'assigned',
        lastActivity: now,
        lockReason
      };

      return {
        ...state,
        assignments: {
          ...state.assignments,
          [imageId]: assignment
        }
      };
    }).then(state => state.assignments[imageId] || null);
  }

  async releaseAssignment(projectId: string, imageId: string, markCompleted: boolean = false): Promise<void> {
    await this.updateCollaborationState(projectId, (state) => {
      const assignment = state.assignments[imageId];
      if (!assignment || assignment.assignedTo !== this.currentUserId) {
        return state; // Can only release own assignments
      }

      const updatedAssignment = {
        ...assignment,
        status: markCompleted ? 'completed' : 'available',
        assignedTo: markCompleted ? assignment.assignedTo : '',
        lastActivity: new Date()
      };

      return {
        ...state,
        assignments: {
          ...state.assignments,
          [imageId]: updatedAssignment
        }
      };
    });
  }


  async recordActivity(projectId: string, activity: Omit<UserActivity, 'userId' | 'username'>): Promise<void> {
    await this.updateCollaborationState(projectId, (state) => ({
      ...state,
      activities: [
        ...state.activities.slice(-49), // Keep last 50 activities
        {
          ...activity,
          userId: this.currentUserId,
          username: this.currentUsername
        }
      ]
    }));
  }

  private startHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = window.setInterval(() => {
      // Heartbeat will be updated by the collaboration hook when active
    }, 3000); // 3 seconds for faster detection
  }

  private startSyncTimer(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = window.setInterval(() => {
      // This will trigger cleanup and sync operations
      // The specific project cleanup will be handled by active collaboration hooks
    }, 60000); // 1 minute
  }

  private handleStorageChange(event: StorageEvent): void {
    if (event.key?.startsWith('collaboration-')) {
      const projectId = event.key.replace('collaboration-', '');
      if (event.newValue) {
        try {
          const newState = JSON.parse(event.newValue);
          
          // Convert date strings back to Date objects
          const processedState = {
            ...newState,
            lastSync: new Date(newState.lastSync),
            activeSessions: Object.fromEntries(
              Object.entries(newState.activeSessions || {}).map(([key, session]: [string, any]) => [
                key,
                {
                  ...session,
                  lastHeartbeat: new Date(session.lastHeartbeat),
                  loginTime: new Date(session.loginTime || session.lastHeartbeat)
                }
              ])
            ),
            assignments: Object.fromEntries(
              Object.entries(newState.assignments || {}).map(([key, assignment]: [string, any]) => [
                key,
                {
                  ...assignment,
                  assignedAt: new Date(assignment.assignedAt),
                  lockedUntil: new Date(assignment.lockedUntil),
                  lastActivity: new Date(assignment.lastActivity)
                }
              ])
            ),
            activities: (newState.activities || []).map((activity: any) => ({
              ...activity,
              timestamp: new Date(activity.timestamp)
            }))
          };
          
          // Check if the change affects our current session
          const ourSession = processedState.activeSessions[this.currentSessionId];
          if (!ourSession && this.currentUsername) {
            // Our session was removed, possibly due to logout in another tab
            console.log('Current session was removed from collaboration state, cleaning up...');
            this.cleanup();
          }
          
          this.notifyListeners(processedState);
        } catch (error) {
          console.error('Failed to parse storage change:', error);
        }
      }
    }
  }

  private notifyListeners(state: CollaborationState): void {
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in collaboration listener:', error);
      }
    });
  }

  subscribe(listener: (state: CollaborationState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    // Mark session as inactive (best effort)
    try {
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith('collaboration-')) {
          const projectId = key.replace('collaboration-', '');
          const state = this.getCollaborationState(projectId);
          
          if (state.activeSessions[this.currentSessionId]) {
            state.activeSessions[this.currentSessionId].isActive = false;
            localStorage.setItem(key, JSON.stringify(state));
          }
        }
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  }
}