import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Annotation } from '@/features/file/hooks/useFileManager';
import { ClassDefinition } from '@/features/project/types';

const MIN_BOX_SIZE = 5;

interface HTMLCanvasAnnotationProps {
  imageUrl: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  selectedClass: ClassDefinition;
  isDrawingMode: boolean;
  scale: number;
  classDefinitions: ClassDefinition[];
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
}

export const HTMLCanvasAnnotation: React.FC<HTMLCanvasAnnotationProps> = ({
  imageUrl,
  annotations,
  onAnnotationsChange,
  selectedClass,
  isDrawingMode,
  scale,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentPoint, setCurrentPoint] = useState<{ x: number; y: number } | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImage(img);
      // Calculate canvas size to fit scaled image with padding
      const padding = 40;
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      setCanvasSize({
        width: scaledWidth + padding,
        height: scaledHeight + padding,
      });
    };
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
    };
    img.src = imageUrl;
  }, [imageUrl, scale]);

  // Convert canvas coordinates to image coordinates
  const getImageCoordinates = useCallback((canvasX: number, canvasY: number) => {
    if (!image) return { x: 0, y: 0 };
    
    const padding = 20;
    const imageX = (canvasX - padding) / scale;
    const imageY = (canvasY - padding) / scale;
    
    return {
      x: Math.max(0, Math.min(imageX, image.width)),
      y: Math.max(0, Math.min(imageY, image.height))
    };
  }, [image, scale]);

  // Check if coordinates are within image bounds
  const isWithinImageBounds = useCallback((canvasX: number, canvasY: number) => {
    if (!image) return false;
    const padding = 20;
    return canvasX >= padding && 
           canvasX <= padding + (image.width * scale) &&
           canvasY >= padding && 
           canvasY <= padding + (image.height * scale);
  }, [image, scale]);

  // Drawing function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const padding = 20;

    // Draw image
    ctx.drawImage(
      image,
      padding,
      padding,
      image.width * scale,
      image.height * scale
    );

    // Draw existing annotations
    annotations.forEach((annotation) => {
      const x = padding + (annotation.x * scale);
      const y = padding + (annotation.y * scale);
      const width = annotation.width * scale;
      const height = annotation.height * scale;

      // Draw rectangle
      ctx.strokeStyle = annotation.color;
      ctx.lineWidth = selectedAnnotationId === annotation.id ? 3 : 2;
      ctx.strokeRect(x, y, width, height);

      // Fill if selected
      if (selectedAnnotationId === annotation.id) {
        ctx.fillStyle = annotation.color + '20';
        ctx.fillRect(x, y, width, height);
      }

      // Draw label
      ctx.fillStyle = annotation.color;
      ctx.font = 'bold 12px Arial';
      ctx.fillText(annotation.className, x + 5, y + 15);
    });

    // Draw current drawing rectangle
    if (isDrawing && startPoint && currentPoint) {
      const startCanvas = {
        x: padding + (startPoint.x * scale),
        y: padding + (startPoint.y * scale)
      };
      const currentCanvas = {
        x: padding + (currentPoint.x * scale),
        y: padding + (currentPoint.y * scale)
      };

      const x = Math.min(startCanvas.x, currentCanvas.x);
      const y = Math.min(startCanvas.y, currentCanvas.y);
      const width = Math.abs(currentCanvas.x - startCanvas.x);
      const height = Math.abs(currentCanvas.y - startCanvas.y);

      ctx.strokeStyle = selectedClass.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(x, y, width, height);
      ctx.setLineDash([]);
    }
  }, [image, scale, annotations, selectedAnnotationId, isDrawing, startPoint, currentPoint, selectedClass]);

  // Redraw when dependencies change
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    if (isDrawingMode && isWithinImageBounds(canvasX, canvasY)) {
      // Start drawing
      const imageCoords = getImageCoordinates(canvasX, canvasY);
      setIsDrawing(true);
      setStartPoint(imageCoords);
      setCurrentPoint(imageCoords);
      onSelectAnnotation?.(null);
    } else if (!isDrawingMode) {
      // Check if clicked on annotation
      const padding = 20;
      let clickedAnnotation: string | null = null;

      for (const annotation of annotations) {
        const x = padding + (annotation.x * scale);
        const y = padding + (annotation.y * scale);
        const width = annotation.width * scale;
        const height = annotation.height * scale;

        if (canvasX >= x && canvasX <= x + width && 
            canvasY >= y && canvasY <= y + height) {
          clickedAnnotation = annotation.id;
          break;
        }
      }

      onSelectAnnotation?.(clickedAnnotation);
    }
  }, [image, isDrawingMode, isWithinImageBounds, getImageCoordinates, onSelectAnnotation, annotations, scale]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !startPoint || !image) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;

    const imageCoords = getImageCoordinates(canvasX, canvasY);
    setCurrentPoint(imageCoords);
  }, [isDrawing, startPoint, image, getImageCoordinates]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !startPoint || !currentPoint || !image) {
      setIsDrawing(false);
      setStartPoint(null);
      setCurrentPoint(null);
      return;
    }

    // Calculate final annotation
    const minX = Math.min(startPoint.x, currentPoint.x);
    const minY = Math.min(startPoint.y, currentPoint.y);
    const maxX = Math.max(startPoint.x, currentPoint.x);
    const maxY = Math.max(startPoint.y, currentPoint.y);
    const width = maxX - minX;
    const height = maxY - minY;

    // Only create annotation if it meets minimum size
    if (width >= MIN_BOX_SIZE && height >= MIN_BOX_SIZE) {
      const newAnnotation: Annotation = {
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        classId: selectedClass.id,
        className: selectedClass.name,
        color: selectedClass.color,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(width),
        height: Math.round(height),
      };

      const newAnnotations = [...annotations, newAnnotation];
      onAnnotationsChange(newAnnotations);
    }

    setIsDrawing(false);
    setStartPoint(null);
    setCurrentPoint(null);
  }, [isDrawing, startPoint, currentPoint, image, selectedClass, annotations, onAnnotationsChange]);

  return (
    <div ref={containerRef} className="flex justify-center items-center bg-gray-100 p-4">
      <div className="border bg-white shadow-lg">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ 
            cursor: isDrawingMode ? 'crosshair' : 'default',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};