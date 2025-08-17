"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, Image, FileText } from "lucide-react";
import { useFileManager } from "../hooks/useFileManager";
import { useProject } from "@/features/project/hooks/useProject";

export const FileUploader = () => {
  const { currentProject } = useProject();
  const { files, uploadFiles } = useFileManager(currentProject?.id || "");
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      // Reset file input to allow selecting the same files again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
      // Reset file input to allow selecting the same files again
      e.target.value = '';
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const imageFiles = files; // All files are images in this context
  const labelFiles: any[] = []; // No label files in image upload context

  return (
    <Card>
      <CardHeader>
        <CardTitle>File Management</CardTitle>
      </CardHeader>
      <CardContent>
        <div 
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
            isDragging ? 'border-primary bg-primary/10' : 'border-gray-300'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
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

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="flex items-center p-3 bg-blue-50 rounded-lg">
            <Image className="h-8 w-8 text-blue-500 mr-2" />
            <div>
              <p className="text-sm font-medium">Images</p>
              <p className="text-2xl font-bold">{imageFiles.length}</p>
            </div>
          </div>
          <div className="flex items-center p-3 bg-green-50 rounded-lg">
            <FileText className="h-8 w-8 text-green-500 mr-2" />
            <div>
              <p className="text-sm font-medium">Labels</p>
              <p className="text-2xl font-bold">{labelFiles.length}</p>
            </div>
          </div>
        </div>

        {files.length > 0 && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">Recent Files</h3>
            <div className="max-h-40 overflow-y-auto">
              {files.slice(0, 5).map((file, index) => (
                <div key={index} className="flex items-center py-1 text-sm">
                  {file.type === 'image' ? (
                    <Image className="h-4 w-4 text-blue-500 mr-2" />
                  ) : (
                    <FileText className="h-4 w-4 text-green-500 mr-2" />
                  )}
                  <span className="truncate">{file.name}</span>
                </div>
              ))}
              {files.length > 5 && (
                <p className="text-xs text-gray-500 mt-1">
                  + {files.length - 5} more files
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};