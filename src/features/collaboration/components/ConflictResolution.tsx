import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  AlertTriangle, 
  Clock, 
  Users, 
  Shield,
  CheckCircle2,
  XCircle,
  RefreshCw
} from 'lucide-react';
import { ConflictResolution as ConflictType, UserActivity } from '../types';
import { useCollaboration } from '../hooks/useCollaboration';
import { useAuth } from '@/auth/AuthProvider';
import { ImageFile } from '@/features/file/hooks/useFileManager';

interface ConflictResolutionProps {
  projectId: string;
  images: ImageFile[];
  className?: string;
}

export const ConflictResolution = ({ projectId, images, className }: ConflictResolutionProps) => {
  const { user } = useAuth();
  const { state, forceAssign } = useCollaboration(projectId, images);
  const [detectedConflicts, setDetectedConflicts] = useState<ConflictType[]>([]);
  const [resolving, setResolving] = useState<string | null>(null);

  // Detect conflicts
  useEffect(() => {
    if (!state || !user) return;

    const conflicts: ConflictType[] = [];
    const now = new Date();

    // Check for expired locks that could be taken over
    Object.entries(state.assignments).forEach(([imageId, assignment]) => {
      if (assignment.status === 'locked' && 
          assignment.assignedTo !== user.username &&
          now > assignment.lockedUntil) {
        conflicts.push({
          conflictId: `expired-${imageId}`,
          imageId,
          conflictType: 'expired_lock',
          users: [assignment.assignedTo],
          resolution: 'pending',
          details: {
            expiredAt: assignment.lockedUntil,
            originalAssignee: assignment.assignedTo,
            canTakeOver: true
          }
        });
      }
    });

    // Check for simultaneous editing (multiple recent activities on same image)
    const recentActivities = state.activities.filter(
      activity => now.getTime() - activity.timestamp.getTime() < 60000 // Last minute
    );
    
    const imageActivities = new Map<string, UserActivity[]>();
    recentActivities.forEach(activity => {
      if (!imageActivities.has(activity.imageId)) {
        imageActivities.set(activity.imageId, []);
      }
      imageActivities.get(activity.imageId)!.push(activity);
    });

    imageActivities.forEach((activities, imageId) => {
      const uniqueUsers = new Set(activities.map(a => a.userId));
      if (uniqueUsers.size > 1) {
        conflicts.push({
          conflictId: `simultaneous-${imageId}`,
          imageId,
          conflictType: 'simultaneous_edit',
          users: Array.from(uniqueUsers),
          resolution: 'pending',
          details: {
            activities,
            detectedAt: now
          }
        });
      }
    });

    // Check for assignment conflicts (multiple assignments to same image)
    Object.entries(state.assignments).forEach(([imageId, assignment]) => {
      const assignmentActivities = state.activities.filter(
        a => a.imageId === imageId && a.action === 'started'
      ).slice(-3); // Last 3 assignment activities

      if (assignmentActivities.length > 1) {
        const uniqueAssignees = new Set(assignmentActivities.map(a => a.userId));
        if (uniqueAssignees.size > 1) {
          conflicts.push({
            conflictId: `assignment-${imageId}`,
            imageId,
            conflictType: 'assignment_conflict',
            users: Array.from(uniqueAssignees),
            resolution: 'pending',
            details: {
              currentAssignee: assignment.assignedTo,
              recentAssignments: assignmentActivities
            }
          });
        }
      }
    });

    setDetectedConflicts(conflicts);
  }, [state, user]);

  const handleResolveConflict = async (conflict: ConflictType, resolution: 'take_over' | 'release' | 'ignore') => {
    if (!user) return;
    
    setResolving(conflict.conflictId);
    
    try {
      switch (resolution) {
        case 'take_over':
          if (conflict.conflictType === 'expired_lock') {
            await forceAssign(conflict.imageId);
          }
          break;
        case 'release':
          // This would require additional logic in the collaboration system
          break;
        case 'ignore':
          // Mark as resolved locally
          setDetectedConflicts(prev => 
            prev.filter(c => c.conflictId !== conflict.conflictId)
          );
          break;
      }
    } catch (error) {
      console.error('Failed to resolve conflict:', error);
    } finally {
      setResolving(null);
    }
  };

  const getConflictIcon = (type: ConflictType['conflictType']) => {
    switch (type) {
      case 'expired_lock':
        return <Clock className="h-4 w-4 text-orange-500" />;
      case 'simultaneous_edit':
        return <Users className="h-4 w-4 text-red-500" />;
      case 'assignment_conflict':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Shield className="h-4 w-4 text-gray-500" />;
    }
  };

  const getConflictTitle = (conflict: ConflictType) => {
    const image = images.find(img => img.id === conflict.imageId);
    const imageName = image?.name || 'Unknown Image';

    switch (conflict.conflictType) {
      case 'expired_lock':
        return `Expired lock on ${imageName}`;
      case 'simultaneous_edit':
        return `Multiple users editing ${imageName}`;
      case 'assignment_conflict':
        return `Assignment conflict on ${imageName}`;
      default:
        return `Conflict on ${imageName}`;
    }
  };

  const getConflictDescription = (conflict: ConflictType) => {
    switch (conflict.conflictType) {
      case 'expired_lock':
        const expiredUser = conflict.details.originalAssignee;
        const expiredAt = new Date(conflict.details.expiredAt).toLocaleTimeString();
        return `Lock by ${expiredUser} expired at ${expiredAt}. You can take over this image.`;
      case 'simultaneous_edit':
        const users = conflict.users.join(', ');
        return `Multiple users (${users}) are working on this image simultaneously.`;
      case 'assignment_conflict':
        const currentAssignee = conflict.details.currentAssignee;
        return `Multiple assignment attempts detected. Currently assigned to ${currentAssignee}.`;
      default:
        return 'Unknown conflict type.';
    }
  };

  const getResolutionActions = (conflict: ConflictType) => {
    const actions = [];
    
    switch (conflict.conflictType) {
      case 'expired_lock':
        if (conflict.details.canTakeOver) {
          actions.push(
            <Button
              key="take_over"
              size="sm"
              onClick={() => handleResolveConflict(conflict, 'take_over')}
              disabled={resolving === conflict.conflictId}
            >
              {resolving === conflict.conflictId ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Taking over...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Take Over
                </>
              )}
            </Button>
          );
        }
        break;
      case 'simultaneous_edit':
      case 'assignment_conflict':
        actions.push(
          <Button
            key="ignore"
            size="sm"
            variant="outline"
            onClick={() => handleResolveConflict(conflict, 'ignore')}
            disabled={resolving === conflict.conflictId}
          >
            <XCircle className="h-3 w-3 mr-1" />
            Ignore
          </Button>
        );
        break;
    }

    return actions;
  };

  if (detectedConflicts.length === 0) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-sm text-green-600">
          <CheckCircle2 className="h-4 w-4" />
          <span>No conflicts detected</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center space-x-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <span className="text-sm font-medium">
            Conflicts Detected ({detectedConflicts.length})
          </span>
        </div>

        <div className="space-y-2">
          {detectedConflicts.map((conflict) => (
            <Alert key={conflict.conflictId} className="border-orange-200 bg-orange-50">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-2 flex-1">
                  {getConflictIcon(conflict.conflictType)}
                  <div className="space-y-1">
                    <div className="font-medium text-sm">
                      {getConflictTitle(conflict)}
                    </div>
                    <AlertDescription className="text-xs">
                      {getConflictDescription(conflict)}
                    </AlertDescription>
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className="text-xs"
                      >
                        {conflict.conflictType.replace('_', ' ')}
                      </Badge>
                      {conflict.users.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <Users className="h-3 w-3" />
                          <span className="text-xs text-gray-600">
                            {conflict.users.join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 ml-2">
                  {getResolutionActions(conflict)}
                </div>
              </div>
            </Alert>
          ))}
        </div>

        {detectedConflicts.length > 0 && (
          <div className="pt-2 border-t text-xs text-gray-500">
            <p>
              Conflicts are automatically detected. Take action to resolve them or ignore if they don't affect your work.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
};