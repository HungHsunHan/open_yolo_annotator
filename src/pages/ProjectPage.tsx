"use client";

import { useParams, useNavigate } from "react-router-dom";
import { ClassManager } from "@/features/project/components/ClassManager";
import { ProjectAssignments } from "@/features/project/components/ProjectAssignments";
import { ExportPanel } from "@/features/annotation/components/ExportPanel";
import { useProject } from "@/features/project/hooks/useProject";
import { useFileManager } from "@/features/file/hooks/useFileManager";
import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image as ImageIcon, CheckCircle2, Clock, Circle, Trash2, Eye } from "lucide-react";
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
// Collaboration features temporarily disabled
// import { UserPresence } from "@/features/collaboration/components/UserPresence";
// import { ImageStatusIndicator, ImageStatusBadge } from "@/features/collaboration/components/ImageStatusIndicator";
// import { useCollaboration } from "@/features/collaboration/hooks/useCollaboration";

export const ProjectPage = () => {
  const { id } = useParams();
  const { projects } = useProject();
  const navigate = useNavigate();
  const { canDeleteImages } = useRoles();
  const { toast } = useToast();
  const [isProjectLoading, setIsProjectLoading] = useState(true);
  const [deleteImageDialogOpen, setDeleteImageDialogOpen] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<{id: string, name: string} | null>(null);
  const [clearAllImagesDialogOpen, setClearAllImagesDialogOpen] = useState(false);
  
  // Find the current project by URL ID, not the globally selected project
  const currentProject = projects.find(p => p.id === id);
  
  const { images, uploadFiles, uploadDirectory, updateImageStatus, deleteImage, clearAllImages, isLoading } = useFileManager(id || "");
  
  // Use simple collaboration system instead of complex one
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
  const [currentPage, setCurrentPage] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const directoryInputRef = useRef<HTMLInputElement>(null);
  
  const IMAGES_PER_PAGE = 8;

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

  const handleDeleteImage = (imageId: string, imageName: string) => {
    setImageToDelete({ id: imageId, name: imageName });
    setDeleteImageDialogOpen(true);
  };

  const handleDeleteImageConfirm = () => {
    if (imageToDelete) {
      deleteImage(imageToDelete.id);
      toast({
        title: "Image deleted",
        description: `"${imageToDelete.name}" has been permanently deleted.`,
      });
      setImageToDelete(null);
    }
  };

  const handleClearAllImages = () => {
    setClearAllImagesDialogOpen(true);
  };

  const handleClearAllImagesConfirm = () => {
    const imageCount = images.length;
    clearAllImages();
    toast({
      title: "All images cleared",
      description: `${imageCount} images have been permanently deleted from the project.`,
    });
  };

  const handleReviewImages = () => {
    if (images.length > 0) {
      navigate(`/project/${id}/annotate/${images[0].id}`);
    }
  };

  const handleAnnotateImage = async (imageId: string) => {
    // Simplified navigation without collaboration
    navigate(`/project/${id}/annotate/${imageId}`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      default:
        return <Circle className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'border-green-500';
      case 'in-progress':
        return 'border-yellow-500';
      default:
        return 'border-gray-300';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Completed</Badge>;
      case 'in-progress':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Pending</Badge>;
    }
  };

  // Pagination logic
  const totalPages = Math.ceil(images.length / IMAGES_PER_PAGE);
  const startIndex = (currentPage - 1) * IMAGES_PER_PAGE;
  const endIndex = startIndex + IMAGES_PER_PAGE;
  const currentImages = images.slice(startIndex, endIndex);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const completedCount = images.filter(img => img.status === 'completed').length;
  const totalAnnotations = images.reduce((sum, img) => sum + img.annotations, 0);

  // Show loading state while projects are being loaded from localStorage
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

  return (
    <div className="space-y-6">
      {/* Access Control Warning */}
      {collaborationInitialized && !canAccess && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {accessDeniedReason === 'max_users_reached' 
              ? `This project is currently at its maximum capacity (2 users). Active users: ${activeUsers.join(', ')}. Please wait for a user to leave before accessing the project.`
              : 'You cannot access this project at the moment. Please try again later.'
            }
          </AlertDescription>
        </Alert>
      )}

      {/* Active Users Indicator */}
      {collaborationInitialized && canAccess && activeUsers.length > 1 && (
        <Alert>
          <Users className="h-4 w-4" />
          <AlertDescription>
            {activeUsers.length} users currently working on this project: {activeUsers.join(', ')}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">{currentProject.name}</h1>
          <p className="text-sm text-gray-500">
            Last updated: {currentProject.updatedAt.toLocaleDateString()}
          </p>
        </div>
        <Button onClick={() => navigate('/dashboard')}>Back to Dashboard</Button>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Images</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging ? 'border-primary bg-primary/5' : 'border-gray-300'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <p className="text-lg font-medium mb-2">Drop images here or click to browse</p>
                <p className="text-sm text-gray-600">Supports JPG, PNG, WebP (max 10MB each)</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept="image/*"
                  onChange={handleFileInput}
                />
              </div>
            </CardContent>
          </Card>

          {/* Directory Upload */}
          <Card>
            <CardHeader>
              <CardTitle>Import Annotated Dataset</CardTitle>
            </CardHeader>
            <CardContent>
              <div 
                className="border-2 border-dashed rounded-lg p-6 text-center border-blue-300 bg-blue-50"
                onClick={() => directoryInputRef.current?.click()}
              >
                <ImageIcon className="mx-auto h-10 w-10 text-blue-400 mb-3" />
                <p className="text-md font-medium mb-1">Upload directory with images + annotations</p>
                <p className="text-sm text-gray-600 mb-2">
                  Select a folder containing images (.jpg, .png) and corresponding YOLO format annotations (.txt)
                </p>
                <p className="text-xs text-gray-500">
                  Example: image1.jpg + image1.txt, image2.png + image2.txt
                </p>
                <input
                  type="file"
                  ref={directoryInputRef}
                  className="hidden"
                  multiple
                  {...({ webkitdirectory: "" } as any)}
                  onChange={handleDirectoryUpload}
                />
              </div>
            </CardContent>
          </Card>

          {/* Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Total Images</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{images.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{completedCount}</div>
                <Progress value={images.length > 0 ? (completedCount/images.length)*100 : 0} className="mt-2" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Annotations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAnnotations}</div>
              </CardContent>
            </Card>
          </div>

          {/* Image Library */}
          {images.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>Image Library</CardTitle>
                  <div className="flex gap-2">
                    {canDeleteImages && images.length > 0 && (
                      <Button 
                        variant="destructive" 
                        size="sm"
                        onClick={handleClearAllImages}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Clear All
                      </Button>
                    )}
                    <Button onClick={handleReviewImages} disabled={images.length === 0}>
                      <Eye className="mr-2 h-4 w-4" />
                      Start Review
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {currentImages.map((image) => {
                    return (
                    <div key={image.id} className="group relative">
                      <div className={`border-2 rounded-lg overflow-hidden ${getStatusColor(image.status)}`}>
                        
                        <div className="aspect-square bg-gray-200 flex items-center justify-center">
                          <img 
                            src={image.url} 
                            alt={image.name} 
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error("Image load error:", image.name);
                              const target = e.target as HTMLImageElement;
                              target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSIzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBhdGggZD0iTTIxIDE1bC01LTVMNSAyMSIvPjwvc3ZnPg==";
                            }}
                            onLoad={() => {
                              // Image loaded successfully
                            }}
                          />
                        </div>
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                          <div className="space-x-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleAnnotateImage(image.id)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Annotate
                            </Button>
                            {canDeleteImages && (
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => handleDeleteImage(image.id, image.name)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <p className="text-sm font-medium truncate">{image.name}</p>
                        <div className="flex items-center justify-between mt-1">
                          <div className="flex items-center space-x-2">
                            {getStatusBadge(image.status)}
                          </div>
                          <span className="text-xs text-gray-500">{formatBytes(image.size)}</span>
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2 mt-6">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => goToPage(page)}
                      >
                        {page}
                      </Button>
                    ))}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Empty State */}
          {images.length === 0 && (
            <Card>
              <CardContent className="text-center py-12">
                <ImageIcon className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">No images yet</h3>
                <p className="text-gray-600 mb-4">
                  Upload your first images to start annotating
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Images
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
        
        <div className="space-y-6">
          <ClassManager 
            projectClasses={currentProject.classNames} 
            classDefinitions={currentProject.classDefinitions}
          />
          <ProjectAssignments projectId={id!} />
          <ExportPanel projectId={id} currentProject={currentProject} images={images} />
        </div>
      </div>
      
      {/* Delete Image Confirmation Dialog */}
      <DeleteImageDialog
        open={deleteImageDialogOpen}
        onOpenChange={setDeleteImageDialogOpen}
        imageName={imageToDelete?.name || ""}
        onConfirm={handleDeleteImageConfirm}
      />
      
      {/* Clear All Images Confirmation Dialog */}
      <ClearAllImagesDialog
        open={clearAllImagesDialogOpen}
        onOpenChange={setClearAllImagesDialogOpen}
        imageCount={images.length}
        projectName={currentProject?.name || ""}
        onConfirm={handleClearAllImagesConfirm}
      />
    </div>
  );
};