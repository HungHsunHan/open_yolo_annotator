import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Users, Clock, Image as ImageIcon } from 'lucide-react';
import { UserSession } from '../types';
import { useCollaboration } from '../hooks/useCollaboration';
import { ImageFile } from '@/features/file/hooks/useFileManager';
import { useAuth } from '@/auth/AuthProvider';

interface UserPresenceProps {
  projectId: string;
  images: ImageFile[];
  className?: string;
}

export const UserPresence = ({ projectId, images, className }: UserPresenceProps) => {
  const { user } = useAuth();
  const { activeUsers: allActiveSessions, state } = useCollaboration(projectId, images);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Group sessions by username and get the most recent session for each user
  const activeUsers = Object.values(
    allActiveSessions.reduce((acc, session) => {
      const existing = acc[session.username];
      if (!existing || session.lastHeartbeat > existing.lastHeartbeat) {
        acc[session.username] = session;
      }
      return acc;
    }, {} as Record<string, UserSession>)
  );

  // Update current time every 30 seconds for relative time display
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const getUserInitials = (username: string): string => {
    return username.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getRelativeTime = (date: Date): string => {
    const diffMs = currentTime.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'now';
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  };

  const getLoginTime = (date: Date): string => {
    const diffMs = currentTime.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    
    if (diffMinutes < 1) return 'Just logged in';
    if (diffMinutes < 60) return `Logged in ${diffMinutes}m ago`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `Logged in ${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `Logged in ${diffDays}d ago`;
  };

  const getCurrentImageName = (session: UserSession): string => {
    if (!session.currentImageId) return '';
    
    const image = images.find(img => img.id === session.currentImageId);
    return image ? image.name : 'Unknown image';
  };

  const getUserActivity = (session: UserSession): string => {
    if (!session.currentImageId) return 'Browsing project';
    
    const assignment = state?.assignments[session.currentImageId];
    if (!assignment) return 'Viewing image';
    
    switch (assignment.status) {
      case 'locked':
        return 'Annotating';
      case 'assigned':
        return 'Working on';
      case 'completed':
        return 'Completed';
      default:
        return 'Viewing';
    }
  };

  const getActivityColor = (session: UserSession): string => {
    if (!session.currentImageId) return 'bg-gray-500';
    
    const assignment = state?.assignments[session.currentImageId];
    if (!assignment) return 'bg-blue-500';
    
    switch (assignment.status) {
      case 'locked':
        return 'bg-red-500'; // Actively working
      case 'assigned':
        return 'bg-yellow-500'; // Assigned but not actively working
      case 'completed':
        return 'bg-green-500'; // Completed
      default:
        return 'bg-blue-500';
    }
  };

  if (!activeUsers.length) {
    return (
      <Card className={`p-4 ${className}`}>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <Users className="h-4 w-4" />
          <span>No other users online</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={`p-4 ${className}`}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="h-4 w-4" />
            <span className="text-sm font-medium">Active Users ({activeUsers.length})</span>
          </div>
          <Badge variant="outline" className="text-xs">
            Live
          </Badge>
        </div>
        
        <div className="space-y-2">
          {activeUsers.map((session) => (
            <div key={session.sessionId} className="flex items-center justify-between p-2 rounded-lg bg-gray-50">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {getUserInitials(session.username)}
                    </AvatarFallback>
                  </Avatar>
                  <div
                    className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${getActivityColor(session)}`}
                    title={getUserActivity(session)}
                  />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium truncate">
                      {session.username}
                    </span>
                    {session.username === user?.username && (
                      <Badge variant="secondary" className="text-xs">You</Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    {session.currentImageId ? (
                      <>
                        <ImageIcon className="h-3 w-3" />
                        <span className="truncate max-w-32">
                          {getCurrentImageName(session)}
                        </span>
                        <span>•</span>
                        <span>{getUserActivity(session)}</span>
                      </>
                    ) : (
                      <span>Browsing project</span>
                    )}
                  </div>
                  
                  {/* Login time display */}
                  <div className="text-xs text-gray-400">
                    {getLoginTime(session.loginTime)}
                  </div>
                </div>
              </div>
              
              <div className="flex flex-col items-end space-y-1">
                <div className="flex items-center space-x-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3" />
                  <span>Active {getRelativeTime(session.lastHeartbeat)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {state && (
          <div className="pt-2 border-t text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Active assignments: {Object.keys(state.assignments).length}</span>
              <span>Recent activities: {state.activities.length}</span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
};