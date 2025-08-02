"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileArchive, FileText } from "lucide-react";
import { useProject } from "@/features/project/hooks/useProject";

export const ExportPanel = () => {
  const { currentProject } = useProject();

  const exportDataset = () => {
    // 這裡應該實現實際的導出邏輯
    console.log("Exporting dataset for project:", currentProject?.name);
  };

  const exportLabels = () => {
    // 這裡應該實現標籤導出邏輯
    console.log("Exporting labels for project:", currentProject?.name);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export Dataset</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button 
          className="w-full" 
          onClick={exportDataset}
          disabled={!currentProject}
        >
          <Download className="mr-2 h-4 w-4" />
          Export Full Dataset
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={exportLabels}
          disabled={!currentProject}
        >
          <FileText className="mr-2 h-4 w-4" />
          Export Labels Only
        </Button>
        
        <div className="text-sm text-gray-500 mt-4">
          <p>Export format:</p>
          <ul className="list-disc list-inside mt-1">
            <li>YOLO format (txt files)</li>
            <li>Dataset configuration (yaml)</li>
            <li>Class definitions (txt)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};