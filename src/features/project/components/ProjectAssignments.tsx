import { useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { useProject } from "../hooks/useProject";
import { AdminOnlyFeature } from "@/components/AdminOnlyFeature";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { UserPlus, UserMinus, Users, Crown } from "lucide-react";

interface ProjectAssignmentsProps {
  projectId: string;
}

export const ProjectAssignments = ({ projectId }: ProjectAssignmentsProps) => {
  const { users } = useAuth();
  const { 
    allProjects, 
    assignUserToProject, 
    unassignUserFromProject, 
    getProjectAssignments 
  } = useProject();
  
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const project = allProjects.find(p => p.id === projectId);
  const assignedUserIds = getProjectAssignments(projectId);
  const assignedUsers = users.filter(user => assignedUserIds.includes(user.id));
  const availableUsers = users.filter(user => 
    !assignedUserIds.includes(user.id) && user.role === 'annotator'
  );

  if (!project) return null;

  const handleAssignUser = async () => {
    if (!selectedUserId) {
      toast({
        title: "Error",
        description: "Please select a user to assign",
        variant: "destructive",
      });
      return;
    }

    const success = assignUserToProject(projectId, selectedUserId);
    if (success) {
      const user = users.find(u => u.id === selectedUserId);
      toast({
        title: "Success",
        description: `${user?.username} assigned to project`,
      });
      setSelectedUserId("");
      setIsAssignDialogOpen(false);
    } else {
      toast({
        title: "Error",
        description: "Failed to assign user to project",
        variant: "destructive",
      });
    }
  };

  const handleUnassignUser = async (userId: string) => {
    const success = unassignUserFromProject(projectId, userId);
    if (success) {
      const user = users.find(u => u.id === userId);
      toast({
        title: "Success",
        description: `${user?.username} removed from project`,
      });
    } else {
      toast({
        title: "Error",
        description: "Cannot remove project creator or assignment failed",
        variant: "destructive",
      });
    }
  };

  return (
    <AdminOnlyFeature>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              <div>
                <CardTitle>Project Assignments</CardTitle>
                <CardDescription>
                  Manage which annotators can access this project
                </CardDescription>
              </div>
            </div>
            
            <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={availableUsers.length === 0}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Assign User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Assign User to Project</DialogTitle>
                  <DialogDescription>
                    Select an annotator to give access to "{project.name}"
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a user to assign" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.username}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAssignDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAssignUser}>
                    Assign User
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        
        <CardContent>
          {assignedUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No users assigned to this project
            </p>
          ) : (
            <div className="space-y-3">
              {assignedUsers.map((user) => {
                const isCreator = project.createdBy === user.id;
                
                return (
                  <div key={user.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="font-medium">{user.username}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                            {user.role}
                          </Badge>
                          {isCreator && (
                            <Badge variant="outline" className="flex items-center gap-1">
                              <Crown className="h-3 w-3" />
                              Creator
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!isCreator && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <UserMinus className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove User Access</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to remove {user.username}'s access to this project? 
                              They will no longer be able to view or annotate images in this project.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleUnassignUser(user.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Remove Access
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          
          {availableUsers.length === 0 && assignedUsers.length > 0 && (
            <p className="text-muted-foreground text-sm mt-4">
              All annotators have been assigned to this project
            </p>
          )}
        </CardContent>
      </Card>
    </AdminOnlyFeature>
  );
};