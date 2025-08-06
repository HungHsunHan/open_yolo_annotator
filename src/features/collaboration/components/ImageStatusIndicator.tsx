import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  CheckCircle2, 
  Lock, 
  User, 
  Clock, 
  AlertCircle,
  Eye,
  PlayCircle
} from 'lucide-react';
import { useCollaboration } from '../hooks/useCollaboration';
import { ImageFile } from '@/features/file/hooks/useFileManager';
import { useAuth } from '@/auth/AuthProvider';

interface ImageStatusIndicatorProps {
  imageId: string;
  images: ImageFile[];
  projectId: string;
  showTooltip?: boolean;
  showUsernames?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ImageStatusIndicator = ({ 
  imageId, 
  images,
  projectId,
  showTooltip = true, 
  showUsernames = false,
  size = 'md'
}: ImageStatusIndicatorProps) => {
  const { user } = useAuth();
  const { getImageStatus, state } = useCollaboration(projectId, images);
  const status = getImageStatus(imageId);

  const getStatusConfig = () => {
    switch (status.status) {
      case 'available':
        return {
          color: 'bg-green-500',
          badgeColor: 'bg-green-100 text-green-800',
          icon: PlayCircle,
          label: 'Available',
          description: 'Ready for annotation'
        };
      case 'assigned_to_me':
        return {
          color: 'bg-blue-500',
          badgeColor: 'bg-blue-100 text-blue-800',
          icon: User,
          label: 'Assigned to me',
          description: `Assigned to you${status.lockedUntil ? ` until ${status.lockedUntil.toLocaleTimeString()}` : ''}`
        };
      case 'assigned_to_other':
        return {
          color: 'bg-yellow-500',
          badgeColor: 'bg-yellow-100 text-yellow-800',
          icon: User,
          label: `Assigned to ${status.assignedUsername}`,
          description: `Being worked on by ${status.assignedUsername}${status.canTakeOver ? ' (can take over)' : ''}`
        };
      case 'locked':
        return {
          color: 'bg-red-500',
          badgeColor: 'bg-red-100 text-red-800',
          icon: Lock,
          label: `Locked by ${status.assignedUsername}`,
          description: `Currently being annotated by ${status.assignedUsername}${status.lockedUntil ? ` until ${status.lockedUntil.toLocaleTimeString()}` : ''}`
        };
      case 'completed':
        return {
          color: 'bg-gray-500',
          badgeColor: 'bg-gray-100 text-gray-800',
          icon: CheckCircle2,
          label: 'Completed',
          description: `Completed by ${status.assignedUsername}`
        };
      default:
        return {
          color: 'bg-gray-400',
          badgeColor: 'bg-gray-100 text-gray-800',
          icon: Eye,
          label: 'Unknown',
          description: 'Status unknown'
        };
    }
  };

  const config = getStatusConfig();
  const IconComponent = config.icon;
  
  const getTimeRemaining = () => {
    if (!status.lockedUntil) return null;
    
    const now = new Date();
    const timeLeft = status.lockedUntil.getTime() - now.getTime();
    
    if (timeLeft <= 0) return 'Expired';
    
    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) return `${hours}h ${minutes}m left`;
    if (minutes > 0) return `${minutes}m left`;
    return 'Expiring soon';
  };

  const sizeConfig = {
    sm: { dot: 'w-2 h-2', icon: 'h-3 w-3', text: 'text-xs' },
    md: { dot: 'w-3 h-3', icon: 'h-4 w-4', text: 'text-sm' },
    lg: { dot: 'w-4 h-4', icon: 'h-5 w-5', text: 'text-base' }
  };

  const indicator = (
    <div className="flex items-center space-x-2">
      {/* Status dot */}
      <div className={`${sizeConfig[size].dot} ${config.color} rounded-full border-2 border-white shadow-sm`} />
      
      {/* Icon and text (for larger sizes) */}
      {size !== 'sm' && (
        <>
          <IconComponent className={`${sizeConfig[size].icon} text-gray-600`} />
          {showUsernames && status.assignedUsername && (
            <span className={`${sizeConfig[size].text} text-gray-600 truncate`}>
              {status.assignedUsername === user?.username ? 'You' : status.assignedUsername}
            </span>
          )}
        </>
      )}
      
      {/* Time remaining for locked items */}
      {(status.status === 'locked' || status.status === 'assigned_to_me') && status.lockedUntil && (
        <Badge variant="outline" className="text-xs">
          <Clock className="h-3 w-3 mr-1" />
          {getTimeRemaining()}
        </Badge>
      )}
      
      {/* Can take over indicator */}
      {status.canTakeOver && (
        <Badge variant="outline" className="text-xs bg-orange-50 text-orange-700">
          <AlertCircle className="h-3 w-3 mr-1" />
          Can take over
        </Badge>
      )}
    </div>
  );

  if (!showTooltip) {
    return indicator;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="cursor-help">
            {indicator}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <div className="font-medium">{config.label}</div>
            <div className="text-sm text-gray-600">{config.description}</div>
            {status.lockedUntil && (
              <div className="text-xs text-gray-500">
                Lock expires: {status.lockedUntil.toLocaleString()}
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Compact version for grid/list views
export const ImageStatusBadge = ({ 
  imageId, 
  images,
  projectId,
  className = ''
}: Omit<ImageStatusIndicatorProps, 'size' | 'showTooltip' | 'showUsernames'> & { className?: string }) => {
  const { getImageStatus } = useCollaboration(projectId, images);
  const status = getImageStatus(imageId);

  const getBadgeVariant = () => {
    switch (status.status) {
      case 'available':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'assigned_to_me':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'assigned_to_other':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'locked':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };

  const getStatusText = () => {
    switch (status.status) {
      case 'available':
        return 'Available';
      case 'assigned_to_me':
        return 'Mine';
      case 'assigned_to_other':
        return status.assignedUsername || 'Assigned';
      case 'locked':
        return 'Locked';
      case 'completed':
        return 'Done';
      default:
        return 'Unknown';
    }
  };

  return (
    <Badge 
      variant="outline" 
      className={`text-xs border ${getBadgeVariant()} ${className}`}
    >
      {getStatusText()}
    </Badge>
  );
};