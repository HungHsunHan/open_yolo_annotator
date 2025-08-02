"use client";

import { useProject } from "@/features/project/hooks/useProject";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Folder, Play } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Progress } from "@/components/ui/progress";

const DashboardPage = () => {
  const { projects, createProject } = useProject();
  const navigate = useNavigate();

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

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projects.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Images</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Annotations</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0%</div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projects.map((project) => (
              <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Folder className="h-8 w-8 text-blue-500" />
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-gray-600">
                      Created {project.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">0% Complete</p>
                    <Progress value={0} className="w-32" />
                  </div>
                  <Button size="sm" onClick={() => navigate(`/project/${project.id}`)}>
                    <Play className="mr-1 h-4 w-4" />
                    Open
                  </Button>
                </div>
              </div>
            ))}
            
            {projects.length === 0 && (
              <div className="text-center py-8">
                <Folder className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No projects yet</h3>
                <p className="text-gray-600 mb-4">
                  Create your first project to get started
                </p>
                <Button onClick={() => navigate("/")}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Project
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DashboardPage;