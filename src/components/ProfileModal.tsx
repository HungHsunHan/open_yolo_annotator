import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { User, Calendar, Shield, Activity } from "lucide-react";
import { useAuth } from "@/auth/AuthProvider";

interface ProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const ProfileModal = ({ open, onOpenChange }: ProfileModalProps) => {
  const { user } = useAuth();

  if (!user) return null;

  const getUserInitials = (username: string) => {
    return username.charAt(0).toUpperCase();
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200";
      case "annotator":
        return "bg-blue-100 text-blue-800 border-blue-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getRoleDescription = (role: string) => {
    switch (role) {
      case "admin":
        return "Full access to create, delete, and manage projects and images";
      case "annotator":
        return "Can annotate images and view projects";
      default:
        return "Standard user access";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            User Profile
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* User Info Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback className="bg-blue-500 text-white dark:text-blue-50 text-xl">
                    {getUserInitials(user.username)}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <CardTitle className="text-xl">{user.username}</CardTitle>
                  <Badge 
                    variant="outline" 
                    className={getRoleColor(user.role)}
                  >
                    <Shield className="h-3 w-3 mr-1" />
                    {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-1">Role Description</h4>
                <p className="text-sm text-muted-foreground">
                  {getRoleDescription(user.role)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Account Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Account Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Username</h4>
                  <p className="text-sm">{user.username}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Role</h4>
                  <p className="text-sm capitalize">{user.role}</p>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-2">Permissions</h4>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>View Projects</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Allowed
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Annotate Images</span>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                      Allowed
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Create Projects</span>
                    <Badge 
                      variant="outline" 
                      className={user.role === "admin" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                    >
                      {user.role === "admin" ? "Allowed" : "Denied"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Delete Projects</span>
                    <Badge 
                      variant="outline" 
                      className={user.role === "admin" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                    >
                      {user.role === "admin" ? "Allowed" : "Denied"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Delete Images</span>
                    <Badge 
                      variant="outline" 
                      className={user.role === "admin" ? "bg-green-50 text-green-700 border-green-200" : "bg-red-50 text-red-700 border-red-200"}
                    >
                      {user.role === "admin" ? "Allowed" : "Denied"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};