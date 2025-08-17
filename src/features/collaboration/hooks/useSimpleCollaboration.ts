import { useState, useEffect, useCallback } from 'react';
import { SimpleCollaborationService } from '../simpleCollaborationService';
import { ProjectAccessResult } from '../types';
import { useAuth } from '@/auth/AuthProvider';

export const useSimpleCollaboration = (projectId: string) => {
  const { user } = useAuth();
  const [accessResult, setAccessResult] = useState<ProjectAccessResult | null>(null);
  const [activeUsers, setActiveUsers] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  
  const collaborationService = SimpleCollaborationService.getInstance();

  // Initialize collaboration when user and projectId are available
  useEffect(() => {
    if (!user || !projectId) return;

    const initializeCollaboration = async () => {
      try {
        // Initialize the service
        collaborationService.initialize(user.username, user.username);
        
        // Check if user can access the project
        const result = await collaborationService.checkProjectAccess(projectId);
        setAccessResult(result);
        
        if (result.allowed) {
          setActiveUsers(result.currentUsers || []);
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error('Failed to initialize simple collaboration:', error);
        setAccessResult({
          allowed: false,
          reason: 'project_not_found'
        });
      }
    };

    initializeCollaboration();

    // Cleanup when leaving
    return () => {
      if (projectId) {
        collaborationService.leaveProject(projectId);
      }
    };
  }, [user, projectId]);

  // Update activity periodically
  useEffect(() => {
    if (!isInitialized || !accessResult?.allowed) return;

    const interval = setInterval(async () => {
      try {
        const result = await collaborationService.checkProjectAccess(projectId);
        if (result.allowed) {
          setActiveUsers(result.currentUsers || []);
        }
      } catch (error) {
        console.error('Failed to update collaboration state:', error);
      }
    }, 3000); // Update every 3 seconds for faster detection

    return () => clearInterval(interval);
  }, [isInitialized, accessResult?.allowed, projectId]);

  const updateCurrentImage = useCallback(async (imageId?: string) => {
    if (!accessResult?.allowed) return;
    
    try {
      await collaborationService.updateCurrentImage(projectId, imageId);
    } catch (error) {
      console.error('Failed to update current image:', error);
    }
  }, [accessResult?.allowed, projectId]);

  const canAccess = accessResult?.allowed || false;
  const accessDeniedReason = accessResult?.reason;

  return {
    canAccess,
    accessDeniedReason,
    activeUsers,
    isInitialized,
    updateCurrentImage
  };
};