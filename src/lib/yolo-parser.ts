import { Annotation } from "@/features/file/hooks/useFileManager";
import { ClassDefinition } from "@/features/project/types";

export interface YoloAnnotationLine {
  classId: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

/**
 * Parse YOLO format annotation string
 * Format: "classId centerX centerY width height" (all normalized 0-1)
 */
export const parseYoloAnnotation = (line: string): YoloAnnotationLine | null => {
  const parts = line.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [classId, centerX, centerY, width, height] = parts.map(Number);
  
  // Validate all numbers are valid and within expected ranges
  if (isNaN(classId) || isNaN(centerX) || isNaN(centerY) || isNaN(width) || isNaN(height)) {
    return null;
  }

  return { classId, centerX, centerY, width, height };
};

/**
 * Convert YOLO format to absolute pixel coordinates
 */
export const yoloToAbsolute = (
  yolo: YoloAnnotationLine, 
  imageWidth: number, 
  imageHeight: number,
  classDefinitions: ClassDefinition[]
): Annotation => {
  const absoluteWidth = yolo.width * imageWidth;
  const absoluteHeight = yolo.height * imageHeight;
  const x = (yolo.centerX * imageWidth) - (absoluteWidth / 2);
  const y = (yolo.centerY * imageHeight) - (absoluteHeight / 2);

  // Find class definition or create default
  const classDef = classDefinitions.find(c => c.id === yolo.classId) || {
    id: yolo.classId,
    name: `class_${yolo.classId}`,
    color: "#ff0000",
    key: yolo.classId.toString()
  };

  return {
    id: crypto.randomUUID(),
    classId: yolo.classId,
    className: classDef.name,
    color: classDef.color,
    x: Math.max(0, x),
    y: Math.max(0, y),
    width: Math.min(absoluteWidth, imageWidth - x),
    height: Math.min(absoluteHeight, imageHeight - y)
  };
};

/**
 * Convert absolute pixel coordinates to YOLO format
 */
export const absoluteToYolo = (
  annotation: Annotation,
  imageWidth: number,
  imageHeight: number
): YoloAnnotationLine => {
  // Ensure coordinates are within image bounds
  const clampedX = Math.max(0, Math.min(annotation.x, imageWidth - annotation.width));
  const clampedY = Math.max(0, Math.min(annotation.y, imageHeight - annotation.height));
  const clampedWidth = Math.min(annotation.width, imageWidth - clampedX);
  const clampedHeight = Math.min(annotation.height, imageHeight - clampedY);

  // Calculate center point
  const centerX = (clampedX + clampedWidth / 2) / imageWidth;
  const centerY = (clampedY + clampedHeight / 2) / imageHeight;
  
  // Normalize width and height
  const normalizedWidth = clampedWidth / imageWidth;
  const normalizedHeight = clampedHeight / imageHeight;

  return {
    classId: annotation.classId,
    centerX: Math.max(0, Math.min(1, centerX)),
    centerY: Math.max(0, Math.min(1, centerY)),
    width: Math.max(0, Math.min(1, normalizedWidth)),
    height: Math.max(0, Math.min(1, normalizedHeight))
  };
};

/**
 * Convert annotations array to YOLO format string
 */
export const annotationsToYoloString = (
  annotations: Annotation[],
  imageWidth: number,
  imageHeight: number
): string => {
  if (!annotations || annotations.length === 0) {
    return '';
  }

  return annotations
    .map(annotation => {
      const yolo = absoluteToYolo(annotation, imageWidth, imageHeight);
      // Format: classId centerX centerY width height (6 decimal places for precision)
      return `${yolo.classId} ${yolo.centerX.toFixed(6)} ${yolo.centerY.toFixed(6)} ${yolo.width.toFixed(6)} ${yolo.height.toFixed(6)}`;
    })
    .join('\n');
};

/**
 * Parse complete YOLO annotation file content
 */
export const parseYoloFile = (
  content: string,
  imageWidth: number,
  imageHeight: number,
  classDefinitions: ClassDefinition[]
): Annotation[] => {
  const lines = content.split('\n').filter(line => line.trim());
  const annotations: Annotation[] = [];

  for (const line of lines) {
    const yoloAnnotation = parseYoloAnnotation(line);
    if (yoloAnnotation) {
      annotations.push(yoloToAbsolute(yoloAnnotation, imageWidth, imageHeight, classDefinitions));
    }
  }

  return annotations;
};

/**
 * Download annotations as YOLO format text file
 */
export const downloadYoloAnnotations = (
  annotations: Annotation[],
  imageWidth: number,
  imageHeight: number,
  filename: string
): void => {
  const yoloContent = annotationsToYoloString(annotations, imageWidth, imageHeight);
  
  // Create blob and download
  const blob = new Blob([yoloContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.txt') ? filename : `${filename}.txt`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
};