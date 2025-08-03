"use client";

import { useProject } from "@/features/project/hooks/useProject";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Play, Trash2, MoreVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";
import { useState, useEffect } from "react";
import { DeleteProjectDialog } from "@/components/DeleteProjectDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

const DashboardPage = () => {
  const { projects, createProject, deleteProject } = useProject();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [projectStats, setProjectStats] = useState<{[key: string]: {totalImages: number, completedImages: number, totalAnnotations: number}}>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<{id: string, name: string} | null>(null);

  // Calculate statistics for all projects
  useEffect(() => {
    const stats: {[key: string]: {totalImages: number, completedImages: number, totalAnnotations: number}} = {};
    
    projects.forEach(project => {
      const savedImages = localStorage.getItem(`project-${project.id}-images`);
      if (savedImages) {
        try {
          const images = JSON.parse(savedImages);
          const totalImages = images.length;
          const completedImages = images.filter((img: any) => 
            img.annotationData && img.annotationData.length > 0
          ).length;
          const totalAnnotations = images.reduce((sum: number, img: any) => 
            sum + (img.annotationData ? img.annotationData.length : 0), 0
          );
          
          stats[project.id] = { totalImages, completedImages, totalAnnotations };
        } catch (e) {
          stats[project.id] = { totalImages: 0, completedImages: 0, totalAnnotations: 0 };
        }
      } else {
        stats[project.id] = { totalImages: 0, completedImages: 0, totalAnnotations: 0 };
      }
    });
    
    setProjectStats(stats);
  }, [projects]);

  const handleDeleteClick = (projectId: string, projectName: string) => {
    setProjectToDelete({ id: projectId, name: projectName });
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (projectToDelete) {
      deleteProject(projectToDelete.id);
      toast({
        title: "Project deleted",
        description: `"${projectToDelete.name}" has been permanently deleted.`,
      });
      setProjectToDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-gray-600">Manage your YOLO annotation projects</p>
        </div>
        <Button onClick={() => navigate("/")}>
          <Plus className="mr-2 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Projects */}
      {projects.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">No projects yet</h3>
            <p className="text-gray-600">
              Use the "New Project" button above to get started
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => {
            const stats = projectStats[project.id] || { totalImages: 0, completedImages: 0, totalAnnotations: 0 };
            const percentage = stats.totalImages > 0 
              ? Math.round((stats.completedImages / stats.totalImages) * 100)
              : 0;
            
            return (
              <Card key={project.id} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Folder className="h-6 w-6 text-blue-500" />
                      <div>
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        <p className="text-sm text-gray-600">
                          Created {project.createdAt.toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => navigate(`/project/${project.id}`)}
                          className="cursor-pointer"
                        >
                          <Play className="mr-2 h-4 w-4" />
                          Open Project
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleDeleteClick(project.id, project.name)}
                          className="cursor-pointer text-red-600 focus:text-red-600"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete Project
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Statistics Grid */}
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{stats.totalImages}</div>
                      <p className="text-xs text-gray-600">Total Images</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{stats.totalAnnotations}</div>
                      <p className="text-xs text-gray-600">Annotations</p>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">{percentage}%</div>
                      <p className="text-xs text-gray-600">Progress</p>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Completion</span>
                      <span className="font-medium">{stats.completedImages}/{stats.totalImages} images</span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                  </div>
                  
                  {/* Action Button */}
                  <Button 
                    className="w-full" 
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Open Project
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Delete Confirmation Dialog */}
      <DeleteProjectDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        projectName={projectToDelete?.name || ""}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
};

export default DashboardPage;