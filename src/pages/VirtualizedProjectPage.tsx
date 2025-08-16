"use client";

import { useParams, useNavigate } from "react-router-dom";
import { ClassManager } from "@/features/project/components/ClassManager";
import { ProjectAssignments } from "@/features/project/components/ProjectAssignments";
import { ExportPanel } from "@/features/annotation/components/ExportPanel";
import { VirtualizedImageGrid } from "@/components/VirtualizedImageGrid";
import { useProject } from "@/features/project/hooks/useProject";
import { usePaginatedFileManager } from "@/features/file/hooks/usePaginatedFileManager";
import { useMemoryManager } from "@/hooks/useMemoryManager";
import { useState, useRef, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image as ImageIcon, AlertCircle, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatBytes } from "@/lib/utils";
import { useRoles } from "@/auth/useRoles";
import { DeleteImageDialog } from "@/components/DeleteImageDialog";
import { ClearAllImagesDialog } from "@/components/ClearAllImagesDialog";
import { useToast } from "@/hooks/use-toast";
import { useSimpleCollaboration } from "@/features/collaboration/hooks/useSimpleCollaboration";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Users, AlertTriangle } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const VirtualizedProjectPage = () => {
  const { id } = useParams();
  const { projects } = useProject();
  const navigate = useNavigate();
  const { canDeleteImages } = useRoles();
  const { toast } = useToast();
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<{id: string, name: string} | null>(null);
  const [clearAllImagesDialogOpen, setClearAllImagesDialogOpen] = useState(false);
  
  // Find the current project by URL ID
  const currentProject = projects.find(p => p.id === id);
  
  // Use paginated file manager
  const {
    images,
    totalCount,
    isLoading,
    hasNextPage,
    lastError,
    searchQuery,
    loadMore,
    refresh,
    search,
    uploadFiles,
    uploadDirectory,
    updateImageStatus,
    updateImageAnnotationData,
    deleteImage,
    clearAllImages,
    clearError
  } = usePaginatedFileManager(id || "", { pageSize: 50 });

  // Memory management
  const visibleImageIds = useMemo(() => images.map(img => img.id), [images]);
  const { forceCleanup, getStats } = useMemoryManager(visibleImageIds, {
    maxCachedImages: 200,
    cleanupInterval: 30000,
    memoryThreshold: 150 * 1024 * 1024 // 150MB
  });
  
  // Use simple collaboration system
  const {
    canAccess,
    accessDeniedReason,
    activeUsers,
    isInitialized: collaborationInitialized,
    updateCurrentImage
  } = useSimpleCollaboration(id || "");

  // Handle project loading state
  useEffect(() => {
    if (projects.length > 0 || localStorage.getItem('yolo-projects')) {
      setIsProjectLoading(false);
    }
  }, [projects]);

  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  const handleDirectoryUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && currentProject) {
      const classDefinitions = currentProject.classDefinitions || 
        currentProject.classNames.map((name, index) => ({
          id: index,
          name: name,
          color: ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#06b6d4", "#84cc16"][index % 8],
          key: (index + 1).toString()
        }));
      uploadDirectory(e.target.files, classDefinitions);
    }
  };

  const handleImageClick = (image: any) => {
    updateCurrentImage(image.id, image.name);
    navigate(`/annotation/${id}?imageId=${image.id}`);
  };

  const handleDeleteImage = (imageId: string) => {
    const image = images.find(img => img.id === imageId);
    if (image) {
      setImageToDelete({ id: imageId, name: image.name });
      setDeleteImageDialogOpen(true);
    }
  };

  const confirmDeleteImage = async () => {
    if (imageToDelete) {
      try {
        await deleteImage(imageToDelete.id);
        toast({
          title: "Image deleted",
          description: `${imageToDelete.name} has been deleted.`,
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to delete image.",
          variant: "destructive",
        });
      } finally {
        setDeleteImageDialogOpen(false);
        setImageToDelete(null);
      }
    }
  };

  const completedCount = images.filter(img => img.status === 'completed').length;
  const totalAnnotations = images.reduce((sum, img) => sum + img.annotations, 0);
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

  // Show loading state while projects are being loaded
  if (isProjectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Loading project...</h2>
        </div>
      </div>
    );
  }

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <p className="text-gray-600 mb-4">The project with ID "{id}" could not be found.</p>
          <Button onClick={() => navigate('/dashboard')}>Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  // Check collaboration access
  if (collaborationInitialized && !canAccess) {
    return (
      <div className="flex items-center justify-center h-64">
        <Alert className="max-w-md">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {accessDeniedReason}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="space-y-6 h-full flex flex-col">
      {/* Project Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">{currentProject.name}</h1>
          <p className="text-gray-600">
            {totalCount} images • {completedCount} completed • {totalAnnotations} annotations
          </p>
        </div>

        {/* Active Users */}
        {collaborationInitialized && activeUsers.length > 0 && (
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-gray-500" />
            <span className="text-sm text-gray-600">
              Active: {activeUsers.join(", ")}
            </span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      {totalCount > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Annotation Progress</span>
                <span>{completedCount}/{totalCount} ({Math.round(progress)}%)</span>
              </div>
              <Progress value={progress} className="w-full" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Display */}
      {lastError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            {lastError}
            <Button variant="outline" size="sm" onClick={clearError}>
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Main Content */}
      <div className="flex-1 min-h-0">
        <Tabs defaultValue="images" className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="images">Images</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          
          <TabsContent value="images" className="flex-1 min-h-0 mt-6">
            <div className="h-full flex flex-col">
              {/* Upload Area */}
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Upload Images</CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                      isDragging ? 'border-primary bg-primary/10' : 'border-gray-300'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      <span className="font-medium text-primary">Click to upload</span> or drag and drop
                    </p>
                    <p className="text-xs text-gray-500">
                      Images and YOLO label files (.txt)
                    </p>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      multiple
                      onChange={handleFileInput}
                      accept="image/*,.txt"
                    />
                  </div>

                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      onClick={() => directoryInputRef.current?.click()}
                    >
                      Upload Directory
                    </Button>
                    {canDeleteImages && (
                      <Button
                        variant="destructive"
                        onClick={() => setClearAllImagesDialogOpen(true)}
                        disabled={totalCount === 0}
                      >
                        Clear All Images
                      </Button>
                    )}
                    <Button variant="outline" onClick={refresh}>
                      Refresh
                    </Button>
                    <Button variant="outline" onClick={forceCleanup}>
                      Clean Memory
                    </Button>
                  </div>

                  <input
                    type="file"
                    ref={directoryInputRef}
                    className="hidden"
                    multiple
                    onChange={handleDirectoryUpload}
                    accept="image/*,.txt"
                    {...({ webkitdirectory: "true" } as any)}
                  />

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-4 mt-6">
                    <div className="flex items-center p-3 bg-blue-50 rounded-lg">
                      <ImageIcon className="h-8 w-8 text-blue-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium">Total Images</p>
                        <p className="text-2xl font-bold">{totalCount}</p>
                      </div>
                    </div>
                    <div className="flex items-center p-3 bg-green-50 rounded-lg">
                      <ImageIcon className="h-8 w-8 text-green-500 mr-2" />
                      <div>
                        <p className="text-sm font-medium">Completed</p>
                        <p className="text-2xl font-bold">{completedCount}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Virtualized Image Grid */}
              <div className="flex-1 min-h-0">
                <VirtualizedImageGrid
                  images={images}
                  totalCount={totalCount}
                  isLoading={isLoading}
                  hasNextPage={hasNextPage}
                  loadMore={loadMore}
                  onImageClick={handleImageClick}
                  onDeleteImage={canDeleteImages ? handleDeleteImage : undefined}
                  searchQuery={searchQuery}
                  onSearchChange={search}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="classes" className="mt-6">
            <ClassManager />
          </TabsContent>

          <TabsContent value="assignments" className="mt-6">
            <ProjectAssignments />
          </TabsContent>

          <TabsContent value="export" className="mt-6">
            <ExportPanel />
          </TabsContent>
        </Tabs>
      </div>

      {/* Delete Dialogs */}
      <DeleteImageDialog
        open={deleteImageDialogOpen}
        onOpenChange={setDeleteImageDialogOpen}
        onConfirm={confirmDeleteImage}
        imageName={imageToDelete?.name || ""}
      />

      <ClearAllImagesDialog
        open={clearAllImagesDialogOpen}
        onOpenChange={setClearAllImagesDialogOpen}
        onConfirm={async () => {
          await clearAllImages();
          toast({
            title: "All images cleared",
            description: "All images have been removed from the project.",
          });
        }}
        imageCount={totalCount}
      />
    </div>
  );
};

export default VirtualizedProjectPage;