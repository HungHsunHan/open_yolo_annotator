import { useState, useEffect, useCallback, useRef } from 'react';
import { CollaborationState, ImageAssignment, UserSession, UserActivity } from '../types';
import { CoordinationService } from '../coordinationService';
import { useAuth } from '@/auth/AuthProvider';
import { ImageFile } from '@/features/file/hooks/useFileManager';

export interface CollaborationStatus {
  state: CollaborationState;
  currentSession: UserSession | null;
  isInitialized: boolean;
  activeUsers: UserSession[];
  myAssignments: ImageAssignment[];
  canAssign: (imageId: string) => boolean;
  getImageStatus: (imageId: string) => {
    status: 'available' | 'assigned_to_me' | 'assigned_to_other' | 'locked' | 'completed';
    assignedTo?: string;
    assignedUsername?: string;
    lockedUntil?: Date;
    canTakeOver?: boolean;
  };
}

export const useCollaboration = (projectId: string, images: ImageFile[] = []) => {
  const { user } = useAuth();
  const [state, setState] = useState<CollaborationState | null>(null);
  const [currentSession, setCurrentSession] = useState<UserSession | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const coordinationService = useRef(CoordinationService.getInstance());
  const heartbeatInterval = useRef<number | null>(null);
  const cleanupInterval = useRef<number | null>(null);

  // Initialize collaboration system
  useEffect(() => {
    if (!user || !projectId) return;

    const initializeCollaboration = async () => {
      try {
        // Initialize coordination service
        coordinationService.current.initialize(user.username, user.username);
        
        // Register session
        const session = await coordinationService.current.registerSession(projectId);
        setCurrentSession(session);
        
        
        // Load initial state
        const initialState = coordinationService.current.getCollaborationState(projectId);
        setState(initialState);
        setIsInitialized(true);
        
      } catch (error) {
        console.error('Failed to initialize collaboration:', error);
      }
    };

    initializeCollaboration();
    
    return () => {
      // Cleanup intervals on unmount
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, [user, projectId]);

  // Start heartbeat and cleanup timers after initialization
  useEffect(() => {
    if (!isInitialized || !projectId) return;

    // Start heartbeat
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
    }
    
    heartbeatInterval.current = window.setInterval(async () => {
      if (currentSession) {
        try {
          await coordinationService.current.updateHeartbeat(projectId, currentSession.currentImageId);
        } catch (error) {
          console.error('Heartbeat failed:', error);
        }
      }
    }, 30000); // 30 seconds

    // Start cleanup timer
    if (cleanupInterval.current) {
      clearInterval(cleanupInterval.current);
    }
    
    cleanupInterval.current = window.setInterval(async () => {
      try {
        await coordinationService.current.cleanupInactiveSessions(projectId);
      } catch (error) {
        console.error('Cleanup failed:', error);
      }
    }, 60000); // 1 minute

    return () => {
      if (heartbeatInterval.current) {
        clearInterval(heartbeatInterval.current);
      }
      if (cleanupInterval.current) {
        clearInterval(cleanupInterval.current);
      }
    };
  }, [isInitialized, projectId, currentSession]);

  // Subscribe to collaboration state changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const unsubscribe = coordinationService.current.subscribe((newState) => {
      setState(newState);
    });
    
    return unsubscribe;
  }, [isInitialized]);


  // Assignment functions
  const assignImage = useCallback(async (imageId: string, lockReason: 'annotation' | 'manual' | 'auto' = 'manual'): Promise<boolean> => {
    if (!user) return false;
    
    try {
      const assignment = await coordinationService.current.assignImage(projectId, imageId, user.username, lockReason);
      
      if (assignment) {
        // Record activity
        await coordinationService.current.recordActivity(projectId, {
          imageId,
          action: 'started',
          timestamp: new Date(),
          annotationsCount: 0
        });
        
        // Update current session
        await coordinationService.current.updateHeartbeat(projectId, imageId);
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to assign image:', error);
      return false;
    }
  }, [user, projectId]);

  const releaseAssignment = useCallback(async (imageId: string, markCompleted: boolean = false): Promise<void> => {
    if (!user) return;
    
    try {
      await coordinationService.current.releaseAssignment(projectId, imageId, markCompleted);
      
      // Record activity
      await coordinationService.current.recordActivity(projectId, {
        imageId,
        action: markCompleted ? 'completed' : 'abandoned',
        timestamp: new Date(),
        annotationsCount: 0 // This should be updated with actual count
      });
      
      // Clear current image from session
      await coordinationService.current.updateHeartbeat(projectId);
      
    } catch (error) {
      console.error('Failed to release assignment:', error);
    }
  }, [user, projectId]);


  const forceAssign = useCallback(async (imageId: string): Promise<boolean> => {
    if (!user) return false;
    
    try {
      // Force assign by updating state directly
      await coordinationService.current.updateCollaborationState(projectId, (state) => {
        const now = new Date();
        const lockDuration = 30 * 60 * 1000; // 30 minutes
        const assignment: ImageAssignment = {
          imageId,
          projectId,
          assignedTo: user.username,
          assignedBy: user.username,
          assignedAt: now,
          lockedUntil: new Date(now.getTime() + lockDuration),
          status: 'locked',
          lastActivity: now,
          lockReason: 'manual'
        };

        return {
          ...state,
          assignments: {
            ...state.assignments,
            [imageId]: assignment
          }
        };
      });
      
      return true;
    } catch (error) {
      console.error('Failed to force assign image:', error);
      return false;
    }
  }, [user, projectId]);

  const updateActivity = useCallback(async (imageId: string, annotationsCount: number): Promise<void> => {
    try {
      await coordinationService.current.recordActivity(projectId, {
        imageId,
        action: 'annotating',
        timestamp: new Date(),
        annotationsCount
      });
      
      // Update assignment activity
      await coordinationService.current.updateCollaborationState(projectId, (state) => {
        const assignment = state.assignments[imageId];
        if (assignment && assignment.assignedTo === user?.username) {
          return {
            ...state,
            assignments: {
              ...state.assignments,
              [imageId]: {
                ...assignment,
                lastActivity: new Date()
              }
            }
          };
        }
        return state;
      });
    } catch (error) {
      console.error('Failed to update activity:', error);
    }
  }, [user, projectId]);

  // Helper functions
  const canAssign = useCallback((imageId: string): boolean => {
    if (!state || !user) return false;
    
    const assignment = state.assignments[imageId];
    
    if (!assignment) return true; // No assignment exists
    
    // Can assign if it's available
    if (assignment.status === 'available') return true;
    
    // Can assign if it's already assigned to current user
    if (assignment.assignedTo === user.username) return true;
    
    // Can assign if lock has expired
    if (assignment.status === 'locked' && new Date() > assignment.lockedUntil) return true;
    
    return false;
  }, [state, user]);

  const getImageStatus = useCallback((imageId: string) => {
    if (!state || !user) {
      return { status: 'available' as const };
    }
    
    const assignment = state.assignments[imageId];
    
    if (!assignment || assignment.status === 'available') {
      return { status: 'available' as const };
    }
    
    if (assignment.status === 'completed') {
      return {
        status: 'completed' as const,
        assignedTo: assignment.assignedTo,
        assignedUsername: assignment.assignedTo
      };
    }
    
    if (assignment.assignedTo === user.username) {
      return {
        status: 'assigned_to_me' as const,
        assignedTo: assignment.assignedTo,
        assignedUsername: assignment.assignedTo,
        lockedUntil: assignment.lockedUntil
      };
    }
    
    // Check if lock has expired
    const isExpired = new Date() > assignment.lockedUntil;
    
    return {
      status: assignment.status === 'locked' ? 'locked' as const : 'assigned_to_other' as const,
      assignedTo: assignment.assignedTo,
      assignedUsername: assignment.assignedTo,
      lockedUntil: assignment.lockedUntil,
      canTakeOver: isExpired
    };
  }, [state, user]);

  const activeUsers = state ? Object.values(state.activeSessions).filter(session => session.isActive) : [];
  const myAssignments = state && user 
    ? Object.values(state.assignments).filter(a => a.assignedTo === user.username && a.status !== 'completed')
    : [];

  const collaborationStatus: CollaborationStatus = {
    state: state || coordinationService.current.getCollaborationState(projectId),
    currentSession,
    isInitialized,
    activeUsers,
    myAssignments,
    canAssign,
    getImageStatus
  };

  return {
    ...collaborationStatus,
    assignImage,
    releaseAssignment,
    forceAssign,
    updateActivity
  };
};