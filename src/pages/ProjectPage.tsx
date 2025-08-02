"use client";

import { useParams, useNavigate } from "react-router-dom";
import { YoloEditor } from "@/features/annotation/components/YoloEditor";
import { ClassManager } from "@/features/project/components/ClassManager";
import { ExportPanel } from "@/features/annotation/components/ExportPanel";
import { FileUploader } from "@/features/file/components/FileUploader";
import { useProject } from "@/features/project/hooks/useProject";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image as ImageIcon, CheckCircle2, Clock, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface ImageItem {
  id: string;
  name: string;
  url: string;
  status: 'pending' | 'in-progress' | 'completed';
  annotations: number;
  size: string;
  uploadDate: string;
}

const mockImages: ImageItem[] = [
  { id: '1', name: 'street_001.jpg', url: '/api/images/1', status: 'completed', annotations: 5, size: '2.4 MB', uploadDate: '2024-01-15' },
  { id: '2', name: 'parking_002.jpg', url: '/api/images/2', status: 'in-progress', annotations: 2, size: '1.8 MB', uploadDate: '2024-01-15' },
  { id: '3', name: 'highway_003.jpg', url: '/api/images/3', status: 'pending', annotations: 0, size: '3.1 MB', uploadDate: '2024-01-16' },
  { id: '4', name: 'crosswalk_004.jpg', url: '/api/images/4', status: 'completed', annotations: 8, size: '2.2 MB', uploadDate: '2024-01-16' },
  { id: '5', name: 'intersection_005.jpg', url: '/api/images/5', status: 'pending', annotations: 0, size: '1.9 MB', uploadDate: '2024-01-17' },
];

export const ProjectPage = () => {
  const { id } = useParams();
  const { currentProject } = useProject();
  const navigate = useNavigate();
  const [images, setImages] = useState<ImageItem[]>(mockImages);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // 這裡應該從API獲取實際圖片
  const sampleImage = "https://via.placeholder.com/800x600";

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
    
    const files = Array.from(e.dataTransfer.files);
    // Handle file upload logic here
    console.log('Uploading files:', files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    // Handle file upload logic here
    console.log('Uploading files:', files);
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

  const completedCount = images.filter(img => img.status === 'completed').length;
  const totalAnnotations = images.reduce((sum, img) => sum + img.annotations, 0);

  if (!currentProject) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Project not found</h2>
          <Button onClick={() => navigate('/')}>Go to Projects</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
                <Progress value={(completedCount/images.length)*100} className="mt-2" />
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

          {/* Image Grid */}
          <Card>
            <CardHeader>
              <CardTitle>Image Library</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {images.map((image) => (
                  <div key={image.id} className="group relative">
                    <div className={`border-2 rounded-lg overflow-hidden ${getStatusColor(image.status)}`}>
                      <div className="aspect-square bg-gray-200 flex items-center justify-center">
                        <ImageIcon className="h-12 w-12 text-gray-400" />
                      </div>
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity flex items-center justify-center">
                        <Button 
                          size="sm" 
                          onClick={() => navigate(`/annotate/${image.id}`)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          Annotate
                        </Button>
                      </div>
                    </div>
                    <div className="mt-2">
                      <p className="text-sm font-medium truncate">{image.name}</p>
                      <div className="flex items-center justify-between mt-1">
                        {getStatusBadge(image.status)}
                        <span className="text-xs text-gray-500">{image.annotations} boxes</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="space-y-6">
          <ClassManager projectClasses={currentProject.classNames} />
          <ExportPanel />
        </div>
      </div>
    </div>
  );
};