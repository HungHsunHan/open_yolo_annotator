"use client";

import { useParams } from "react-router-dom";
import { YoloEditor } from "@/features/annotation/components/YoloEditor";
import { ClassManager } from "@/features/project/components/ClassManager";
import { ExportPanel } from "@/features/annotation/components/ExportPanel";
import { FileUploader } from "@/features/file/components/FileUploader";
import { useProject } from "@/features/project/hooks/useProject";

export const ProjectPage = () => {
  const { id } = useParams();
  const { currentProject } = useProject();
  
  // 這裡應該從API獲取實際圖片
  const sampleImage = "https://via.placeholder.com/800x600";

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          {currentProject?.name || `Project ${id}`}
        </h1>
        <div className="text-sm text-gray-500">
          Last updated: {currentProject?.updatedAt.toLocaleDateString() || 'N/A'}
        </div>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">Annotation Editor</h2>
            <YoloEditor imageSrc={sampleImage} />
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h2 className="text-lg font-medium mb-4">File Management</h2>
            <FileUploader />
          </div>
        </div>
        
        <div className="space-y-6">
          <ClassManager />
          <ExportPanel />
        </div>
      </div>
    </div>
  );
};