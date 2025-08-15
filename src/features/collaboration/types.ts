export interface UserSession {
  userId: string;
  username: string;
  sessionId: string;
  projectId: string;
  lastHeartbeat: Date;
  loginTime: Date;
  isActive: boolean;
  currentImageId?: string;
}

export interface ImageAssignment {
  imageId: string;
  projectId: string;
  assignedTo: string;
  assignedBy: string;
  assignedAt: Date;
  lockedUntil: Date;
  status: 'assigned' | 'locked' | 'completed' | 'available';
  lastActivity: Date;
  lockReason: 'annotation' | 'manual' | 'auto';
}


export interface UserActivity {
  userId: string;
  username: string;
  imageId: string;
  action: 'started' | 'annotating' | 'completed' | 'abandoned';
  timestamp: Date;
  annotationsCount: number;
}

export interface ConflictResolution {
  conflictId: string;
  imageId: string;
  conflictType: 'simultaneous_edit' | 'expired_lock' | 'assignment_conflict';
  users: string[];
  resolution: 'auto' | 'manual' | 'pending';
  resolvedBy?: string;
  resolvedAt?: Date;
  details: any;
}

export interface CollaborationState {
  projectId: string;
  activeSessions: Record<string, UserSession>;
  assignments: Record<string, ImageAssignment>;
  activities: UserActivity[];
  conflicts: ConflictResolution[];
  lastSync: Date;
}

export interface SimpleCollaborationState {
  projectId: string;
  activeUsers: {
    userId: string;
    username: string;
    sessionId: string;
    lastActivity: Date;
    currentImageId?: string;
  }[];
  maxUsers: number; // Set to 2 for simple race condition prevention
  lastSync: Date;
}

export interface ProjectAccessResult {
  allowed: boolean;
  reason?: 'max_users_reached' | 'already_active' | 'project_not_found';
  currentUsers?: string[];
}