"use client";

import { useParams } from "react-router-dom";
import { YoloEditor } from "@/features/annotation/components/YoloEditor";
import { useProject } from "@/features/project/hooks/useProject";

export const ProjectPage = () => {
  const { id } = useParams();
  const { currentProject } = useProject();
  
  // 這裡應該從API獲取實際圖片
  const sampleImage = "https://via.placeholder.com/800x600";

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">
        {currentProject?.name || `Project ${id}`}
      </h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <YoloEditor imageSrc={sampleImage} />
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-lg font-medium mb-4">Class Management</h2>
          {/* 類別管理將在這裡實現 */}
        </div>
      </div>
    </div>
  );
};