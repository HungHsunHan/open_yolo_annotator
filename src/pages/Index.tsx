import { MadeWithDyad } from "@/components/made-with-dyad";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProject } from "@/features/project/hooks/useProject";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CreateProjectDialog } from "@/features/project/components/CreateProjectDialog";

const Index = () => {
  const { projects, createProject } = useProject();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreateProject = (name: string, classes: any[]) => {
    const project = createProject(name);
    // Store classes in project or separate storage
    console.log('Created project with classes:', classes);
    navigate(`/dashboard`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">YOLO Annotation Tool</h1>
          <p className="text-lg text-gray-600 mb-8">
            Create and manage your YOLO object detection datasets with ease
          </p>
          <Button size="lg" onClick={() => setIsCreate<dyad-write path="src/pages/Index.tsx" description="Update homepage to use new dashboard and create project dialog">
import { MadeWithDyad } from "@/components/made-with-dyad";
import { MainLayout } from "@/components/layout/MainLayout";
import { useProject } from "@/features/project/hooks/useProject";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { CreateProjectDialog } from "@/features/project/components/CreateProjectDialog";

const Index = () => {
  const { projects, createProject } = useProject();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const navigate = useNavigate();

  const handleCreateProject = (name: string, classes: any[]) => {
    const project = createProject(name);
    // Store classes in project or separate storage
    console.log('Created project with classes:', classes);
    navigate(`/dashboard`);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="text-center py-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">YOLO Annotation Tool</h1>
          <p className="text-lg text-gray-600 mb-8">
            Create and manage your YOLO object detection datasets with ease
          </p>
          <Button size="lg" onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-5 w-5" />
            Create New Project
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Card
              key={project.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => navigate(`/dashboard`)}
            >
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Folder className="mr-2 h-5 w-5" />
                  {project.name}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  Created: {project.createdAt.toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  Classes: {project.classNames.length || 1}
                </p>
              </CardContent>
            </Card>
          ))}
          
          {projects.length === 0 && (
            <Card className="col-span-full">
              <CardContent className="text-center py-12">
                <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-gray-600 mb-4">
                  Get started by creating your first YOLO annotation project
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create First Project
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        
        <CreateProjectDialog
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          onCreate={handleCreateProject}
        />
        
        <div className="mt-12">
          <MadeWithDyad />
        </div>
      </div>
    </MainLayout>
  );
};

export default Index;