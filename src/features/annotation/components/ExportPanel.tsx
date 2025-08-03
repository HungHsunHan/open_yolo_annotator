"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, FileArchive, FileText } from "lucide-react";
import { useFileManager, ImageFile, Annotation } from "@/features/file/hooks/useFileManager";
import { YoloProject } from "@/features/project/types";
import JSZip from "jszip";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

interface ExportPanelProps {
  projectId?: string;
  currentProject?: YoloProject | null;
  images?: ImageFile[];
}

export const ExportPanel = ({ projectId, currentProject, images: passedImages }: ExportPanelProps) => {
  // Use currentProject.id if available, fallback to projectId
  const actualProjectId = currentProject?.id || projectId || "";
  const { images: hookImages } = useFileManager(actualProjectId);
  
  // Use passed images if available, otherwise use hook images
  const images = passedImages || hookImages;
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);
  
  

  // Convert base64 image to blob
  const base64ToBlob = (base64: string): Blob => {
    const byteCharacters = atob(base64.split(',')[1]);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: 'image/jpeg' });
  };

  // Convert annotations to YOLO format
  const convertToYoloFormat = (annotations: Annotation[], imageWidth: number, imageHeight: number): string => {
    return annotations.map(ann => {
      // Convert from absolute coordinates to YOLO format (normalized center x, center y, width, height)
      const centerX = (ann.x + ann.width / 2) / imageWidth;
      const centerY = (ann.y + ann.height / 2) / imageHeight;
      const normalizedWidth = ann.width / imageWidth;
      const normalizedHeight = ann.height / imageHeight;
      
      return `${ann.classId} ${centerX.toFixed(6)} ${centerY.toFixed(6)} ${normalizedWidth.toFixed(6)} ${normalizedHeight.toFixed(6)}`;
    }).join('\n');
  };

  // Get image dimensions from base64
  const getImageDimensions = (base64: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      img.src = base64;
    });
  };

  // Generate classes.txt file
  const generateClassesFile = (): string => {
    if (!currentProject?.classDefinitions) {
      return currentProject?.classNames.join('\n') || '';
    }
    return currentProject.classDefinitions.map(cls => cls.name).join('\n');
  };

  // Generate dataset.yaml file
  const generateDatasetYaml = (): string => {
    const classNames = currentProject?.classDefinitions?.map(cls => cls.name) || currentProject?.classNames || [];
    
    return `# YOLO Dataset Configuration
# Generated from ${currentProject?.name || 'Unknown Project'}

path: .  # dataset root dir
train: images  # train images (relative to 'path')
val: images    # val images (relative to 'path')

# Classes
names:
${classNames.map((name, index) => `  ${index}: ${name}`).join('\n')}

# Number of classes
nc: ${classNames.length}
`;
  };

  const exportDataset = async () => {
    if (!currentProject || images.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Please add images to your project before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const zip = new JSZip();
      const projectFolder = zip.folder(currentProject.name);
      const imagesFolder = projectFolder!.folder('images');
      const labelsFolder = projectFolder!.folder('labels');
      
      // Add classes.txt
      projectFolder!.file('classes.txt', generateClassesFile());
      
      // Add dataset.yaml
      projectFolder!.file('dataset.yaml', generateDatasetYaml());
      
      // Process each image and its annotations
      for (const image of images) {
        try {
          // Get image dimensions
          const dimensions = await getImageDimensions(image.url);
          
          // Extract filename without extension
          const baseName = image.name.replace(/\.[^/.]+$/, "");
          const extension = image.name.split('.').pop() || 'jpg';
          
          // Add image file
          const imageBlob = base64ToBlob(image.url);
          imagesFolder!.file(`${baseName}.${extension}`, imageBlob);
          
          // Generate annotation file
          if (image.annotationData && image.annotationData.length > 0) {
            const yoloAnnotations = convertToYoloFormat(image.annotationData, dimensions.width, dimensions.height);
            labelsFolder!.file(`${baseName}.txt`, yoloAnnotations);
          } else {
            // Create empty annotation file for images without annotations
            labelsFolder!.file(`${baseName}.txt`, '');
          }
        } catch (error) {
          console.error(`Error processing image ${image.name}:`, error);
        }
      }
      
      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentProject.name}_dataset.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful!",
        description: `Dataset "${currentProject.name}" has been downloaded.`,
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "Please try again or check your browser's download settings.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportLabels = async () => {
    if (!currentProject || images.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Please add images to your project before exporting.",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const zip = new JSZip();
      const projectFolder = zip.folder(currentProject.name + '_labels');
      
      // Add classes.txt
      projectFolder!.file('classes.txt', generateClassesFile());
      
      // Process each image's annotations
      for (const image of images) {
        try {
          if (image.annotationData && image.annotationData.length > 0) {
            const dimensions = await getImageDimensions(image.url);
            const baseName = image.name.replace(/\.[^/.]+$/, "");
            const yoloAnnotations = convertToYoloFormat(image.annotationData, dimensions.width, dimensions.height);
            projectFolder!.file(`${baseName}.txt`, yoloAnnotations);
          }
        } catch (error) {
          console.error(`Error processing annotations for ${image.name}:`, error);
        }
      }
      
      // Generate and download ZIP
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${currentProject.name}_labels.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Export successful!",
        description: `Labels for "${currentProject.name}" have been downloaded.`,
      });
      
    } catch (error) {
      console.error('Export failed:', error);
      toast({
        title: "Export failed",
        description: "Please try again or check your browser's download settings.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
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
          disabled={!currentProject || images.length === 0 || isExporting}
        >
          <Download className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Full Dataset'}
        </Button>
        
        <Button 
          variant="outline" 
          className="w-full" 
          onClick={exportLabels}
          disabled={!currentProject || images.length === 0 || isExporting}
        >
          <FileText className="mr-2 h-4 w-4" />
          {isExporting ? 'Exporting...' : 'Export Labels Only'}
        </Button>
        
        {currentProject && (
          <div className="text-sm text-gray-600 mt-4">
            <p className="font-medium">Project: {currentProject.name}</p>
            <p>Images: {images.length}</p>
            <p>Annotated: {images.filter(img => img.annotationData && img.annotationData.length > 0).length}</p>
          </div>
        )}
        
        
        <div className="text-sm text-gray-500 mt-4">
          <p>Export includes:</p>
          <ul className="list-disc list-inside mt-1">
            <li>Images in original format</li>
            <li>YOLO format annotations (.txt)</li>
            <li>Class definitions (classes.txt)</li>
            <li>Dataset configuration (dataset.yaml)</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};