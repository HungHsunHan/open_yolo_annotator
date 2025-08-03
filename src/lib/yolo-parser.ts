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