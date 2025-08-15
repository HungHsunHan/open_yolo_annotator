import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Stage, Layer, Image as KonvaImage, Rect, Text, Transformer } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import { Annotation } from '@/features/file/hooks/useFileManager';
import { ClassDefinition } from '@/features/project/types';

// Enforce a single source of truth for minimum bounding box size
const MIN_BOX_SIZE = 0;

interface KonvaAnnotationCanvasProps {
  imageUrl: string;
  annotations: Annotation[];
  onAnnotationsChange: (annotations: Annotation[]) => void;
  selectedClass: ClassDefinition;
  isDrawingMode: boolean;
  scale: number;
  // onScaleChange removed (unused)
  classDefinitions: ClassDefinition[];
  // New props for selection sync with parent
  selectedAnnotationId?: string | null;
  onSelectAnnotation?: (id: string | null) => void;
}

// Removed unused AnnotationShape interface

export const KonvaAnnotationCanvas: React.FC<KonvaAnnotationCanvasProps> = ({
  imageUrl,
  annotations,
  onAnnotationsChange,
  selectedClass,
  isDrawingMode,
  scale,
  // onScaleChange removed
  classDefinitions,
  selectedAnnotationId,
  onSelectAnnotation,
}) => {
  const stageRef = useRef<any>(null);
  const transformerRef = useRef<any>(null);
  const imageRef = useRef<any>(null);
  
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [newAnnotation, setNewAnnotation] = useState<Partial<Annotation> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);

  // Load image and calculate proper stage dimensions
  useEffect(() => {
    console.log('[Canvas] Mount/props', { imageUrl, isDrawingMode, scale, annCount: annotations.length, selectedClass });
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('[Canvas] Image loaded', { width: img.width, height: img.height });
      setImage(img);
      
      // Calculate stage size to fit the scaled image properly
      const scaledWidth = img.width * scale;
      const scaledHeight = img.height * scale;
      
      // Add padding around the image
      const padding = 40;
      setStageSize({
        width: scaledWidth + padding,
        height: scaledHeight + padding,
      });
    };
    
    img.onerror = () => {
      console.error('Failed to load image:', imageUrl);
    };
    img.src = imageUrl;
  }, [imageUrl, scale, annotations.length, isDrawingMode, selectedClass]);

  // Handle transformer selection
  useEffect(() => {
    if (selectedId && transformerRef.current && stageRef.current) {
      const stage = stageRef.current;
      const selectedNode = stage.findOne(`#${selectedId}`);
      if (selectedNode) {
        transformerRef.current.nodes([selectedNode]);
        transformerRef.current.getLayer()?.batchDraw();
      }
    } else if (transformerRef.current) {
      transformerRef.current.nodes([]);
      transformerRef.current.getLayer()?.batchDraw();
    }
  }, [selectedId, scale, annotations]);

  // Convert stage coordinates to image coordinates
  const getImageCoordinates = useCallback((stageX: number, stageY: number) => {
    if (!image) return { x: 0, y: 0 };
    
    // Account for image position in stage (centered with padding)
    const imageOffsetX = (stageSize.width - (image.width * scale)) / 2;
    const imageOffsetY = (stageSize.height - (image.height * scale)) / 2;
    const imageX = (stageX - imageOffsetX) / scale;
    const imageY = (stageY - imageOffsetY) / scale;
    
    // Clamp to image boundaries
    return {
      x: Math.max(0, Math.min(imageX, image.width)),
      y: Math.max(0, Math.min(imageY, image.height))
    };
  }, [image, scale, stageSize]);

  // Check if coordinates are within image bounds
  const isWithinImageBounds = useCallback((stageX: number, stageY: number) => {
    if (!image) return false;
    
    const imageOffsetX = (stageSize.width - (image.width * scale)) / 2;
    const imageOffsetY = (stageSize.height - (image.height * scale)) / 2;
    
    return stageX >= imageOffsetX && 
           stageX <= imageOffsetX + (image.width * scale) &&
           stageY >= imageOffsetY && 
           stageY <= imageOffsetY + (image.height * scale);
  }, [image, scale, stageSize]);

  const handleMouseDown = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!image) {
      console.warn('[Canvas] MouseDown ignored: image not loaded');
      return;
    }

    const stage = e.target.getStage();
    if (!stage) {
      console.warn('[Canvas] MouseDown ignored: no stage');
      return;
    }

    const pos = stage.getPointerPosition();
    if (!pos) {
      console.warn('[Canvas] MouseDown ignored: no pointer position');
      return;
    }

    const targetClass = (e.target as any)?.getClassName?.() || 'unknown';
    // Treat Stage or Layer as background (image is non-listening)
    const clickedOnBackground = e.target === stage || targetClass === 'Layer';
    const within = isWithinImageBounds(pos.x, pos.y);
    console.log(`[Canvas] MouseDown at stage=(${pos.x.toFixed(1)},${pos.y.toFixed(1)}) drawingMode=${isDrawingMode} clickedOnBackground=${clickedOnBackground} targetClass=${targetClass} withinImage=${within}`);
    
    if (isDrawingMode && clickedOnBackground && within) {
      // Start drawing new annotation
      const imageCoords = getImageCoordinates(pos.x, pos.y);
      
      console.log('[Canvas] Starting annotation at image=', imageCoords);
      setIsDrawing(true);
      setSelectedId(null);
      onSelectAnnotation?.(null);
      setStartPoint(imageCoords);
      setNewAnnotation({
        id: `temp-${Date.now()}`,
        classId: selectedClass.id,
        className: selectedClass.name,
        color: selectedClass.color,
        x: imageCoords.x,
        y: imageCoords.y,
        width: 0,
        height: 0,
      });
    } else if (!isDrawingMode) {
      // Handle selection mode
      if (clickedOnBackground) {
        console.log('[Canvas] Background click in selection mode: clearing selection');
        setSelectedId(null);
        onSelectAnnotation?.(null);
      }
    } else {
      // Drawing mode but click not valid
      if (!clickedOnBackground) {
        console.log('[Canvas] Click ignored: not on background (probably clicked a shape)');
      } else if (!within) {
        console.log('[Canvas] Click ignored: outside image bounds');
      }
    }
  }, [image, isDrawingMode, selectedClass, getImageCoordinates, isWithinImageBounds, onSelectAnnotation]);

  const handleMouseMove = useCallback((e: KonvaEventObject<MouseEvent>) => {
    if (!isDrawing || !newAnnotation || !startPoint || !image) return;

    const stage = e.target.getStage();
    if (!stage) return;

    const pos = stage.getPointerPosition();
    if (!pos) return;

    const currentCoords = getImageCoordinates(pos.x, pos.y);
    
    // Calculate the bounding box from start point to current point
    const minX = Math.min(startPoint.x, currentCoords.x);
    const minY = Math.min(startPoint.y, currentCoords.y);
    const maxX = Math.max(startPoint.x, currentCoords.x);
    const maxY = Math.max(startPoint.y, currentCoords.y);
    const w = maxX - minX;
    const h = maxY - minY;
    
    // Ensure minimum dimensions during drawing for visual feedback
    const displayWidth = Math.max(w, 1);
    const displayHeight = Math.max(h, 1);
    
    console.log('[Canvas] MouseMove drawing box', { x: minX, y: minY, width: displayWidth, height: displayHeight });
    
    setNewAnnotation({
      ...newAnnotation,
      x: minX,
      y: minY,
      width: displayWidth,
      height: displayHeight,
    });
  }, [isDrawing, newAnnotation, startPoint, image, getImageCoordinates]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !newAnnotation) {
      console.log('[Canvas] MouseUp ignored', { isDrawing, hasNewAnnotation: !!newAnnotation });
      return;
    }

    setIsDrawing(false);
    setStartPoint(null);

    // Only add annotation if it has meaningful size
    if (newAnnotation.width! >= MIN_BOX_SIZE && newAnnotation.height! >= MIN_BOX_SIZE) {
      const finalAnnotation: Annotation = {
        id: `annotation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        classId: newAnnotation.classId!,
        className: newAnnotation.className!,
        color: newAnnotation.color!,
        x: Math.round(newAnnotation.x!),
        y: Math.round(newAnnotation.y!),
        width: Math.round(newAnnotation.width!),
        height: Math.round(newAnnotation.height!),
      };
      
      console.log('[Canvas] Creating annotation:', finalAnnotation);
      console.log('[Canvas] Image dimensions:', { width: image?.width, height: image?.height });
      
      // Add the new annotation to the list
      const newAnnotations = [...annotations, finalAnnotation];
      onAnnotationsChange(newAnnotations);
    } else {
      console.log('[Canvas] Annotation too small:', newAnnotation.width, 'x', newAnnotation.height);
    }

    // Clear temporary annotation
    setNewAnnotation(null);
  }, [isDrawing, newAnnotation, annotations, onAnnotationsChange, image]);

  const handleAnnotationSelect = useCallback((id: string) => {
    if (!isDrawingMode) {
      setSelectedId(id);
      onSelectAnnotation?.(id);
    }
  }, [isDrawingMode, onSelectAnnotation]);

  const handleAnnotationChange = useCallback((id: string, attrs: Partial<Annotation>) => {
    const updatedAnnotations = annotations.map(ann => 
      ann.id === id ? { ...ann, ...attrs } : ann
    );
    onAnnotationsChange(updatedAnnotations);
  }, [annotations, onAnnotationsChange]);

  // Removed unused handleDeleteSelected

  // Sync canvas selection with parent selection
  useEffect(() => {
    if (selectedAnnotationId !== undefined) {
      setSelectedId(selectedAnnotationId ?? null);
    }
  }, [selectedAnnotationId]);

  // Cancel in-progress drawing if parent turns off drawing mode
  useEffect(() => {
    if (!isDrawingMode && isDrawing) {
      setIsDrawing(false);
      setNewAnnotation(null);
      setStartPoint(null);
    }
  }, [isDrawingMode, isDrawing]);

  // Prepare annotations for rendering
  const allAnnotations = [...annotations];
  // Show temporary annotation during drawing, even if it's very small
  if (newAnnotation && isDrawing) {
    allAnnotations.push(newAnnotation as Annotation);
  }

  // Calculate image position for centering
  const imageOffsetX = image ? (stageSize.width - (image.width * scale)) / 2 : 0;
  const imageOffsetY = image ? (stageSize.height - (image.height * scale)) / 2 : 0;

  return (
    <div className="flex justify-center items-center bg-gray-100 p-4">
      <div className="border bg-white shadow-lg">
        <Stage
          ref={stageRef}
          width={stageSize.width}
          height={stageSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp} // Handle case when mouse leaves canvas during drawing
          style={{ cursor: isDrawingMode ? 'crosshair' : 'default' }}
        >
          {/* Background Image Layer */}
          <Layer>
            {image && (
              <KonvaImage
                ref={imageRef}
                image={image}
                x={imageOffsetX}
                y={imageOffsetY}
                width={image.width * scale}
                height={image.height * scale}
                listening={false}
              />
            )}
          </Layer>

          {/* Annotations Layer */}
          <Layer>
            {allAnnotations.map((annotation) => (
              <React.Fragment key={annotation.id}>
                <Rect
                  id={annotation.id}
                  x={imageOffsetX + (annotation.x * scale)}
                  y={imageOffsetY + (annotation.y * scale)}
                  width={annotation.width * scale}
                  height={annotation.height * scale}
                  stroke={annotation.color}
                  strokeWidth={selectedId === annotation.id ? 3 : 2}
                  fill={selectedId === annotation.id ? `${annotation.color}20` : 'transparent'}
                  draggable={!isDrawingMode}
                  dragBoundFunc={(pos) => {
                    if (image) {
                      // Get the bounding box of the rectangle being dragged
                      const stage = stageRef.current;
                      const self = stage?.findOne(`#${annotation.id}`);
                      if (self) {
                        const boxWidth = self.width() * self.scaleX();
                        const boxHeight = self.height() * self.scaleY();

                        // Define the limits for the top-left corner of the box
                        const minX = imageOffsetX;
                        const maxX = imageOffsetX + (image.width * scale) - boxWidth;
                        const minY = imageOffsetY;
                        const maxY = imageOffsetY + (image.height * scale) - boxHeight;

                        // Clamp the position
                        const newX = Math.max(minX, Math.min(pos.x, maxX));
                        const newY = Math.max(minY, Math.min(pos.y, maxY));
                        
                        return { x: newX, y: newY };
                      }
                    }
                    return pos;
                  }}
                  onClick={(e) => {
                    e.cancelBubble = true;
                    if (!isDrawingMode) {
                      handleAnnotationSelect(annotation.id);
                    }
                  }}
                  onDragStart={(e) => {
                    // Ensure selection when starting to drag
                    if (!isDrawingMode && selectedId !== annotation.id) {
                      handleAnnotationSelect(annotation.id);
                    }
                  }}
                  onDragEnd={(e) => {
                    const newX = (e.target.x() - imageOffsetX) / scale;
                    const newY = (e.target.y() - imageOffsetY) / scale;
                    
                    // Clamp to image boundaries
                    const clampedX = Math.max(0, Math.min(newX, (image?.width || 0) - annotation.width));
                    const clampedY = Math.max(0, Math.min(newY, (image?.height || 0) - annotation.height));
                    
                    handleAnnotationChange(annotation.id, { 
                      x: Math.round(clampedX), 
                      y: Math.round(clampedY) 
                    });
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    
                    // Reset scale and update size
                    node.scaleX(1);
                    node.scaleY(1);
                    
                    const newX = (node.x() - imageOffsetX) / scale;
                    const newY = (node.y() - imageOffsetY) / scale;
                    const newWidth = (node.width() * scaleX) / scale;
                    const newHeight = (node.height() * scaleY) / scale;
                    
                    // Ensure minimum size and clamp to boundaries
                    const finalWidth = Math.max(MIN_BOX_SIZE, newWidth);
                    const finalHeight = Math.max(MIN_BOX_SIZE, newHeight);
                    const clampedX = Math.max(0, Math.min(newX, (image?.width || 0) - finalWidth));
                    const clampedY = Math.max(0, Math.min(newY, (image?.height || 0) - finalHeight));
                    
                    handleAnnotationChange(annotation.id, {
                      x: Math.round(clampedX),
                      y: Math.round(clampedY),
                      width: Math.round(finalWidth),
                      height: Math.round(finalHeight),
                    });
                  }}
                />
                <Text
                  x={imageOffsetX + (annotation.x * scale) + 5}
                  y={imageOffsetY + (annotation.y * scale) + 5}
                  text={annotation.className}
                  fontSize={12}
                  fill={annotation.color}
                  fontStyle="bold"
                  listening={false}
                  shadowColor="white"
                  shadowBlur={2}
                  shadowOffset={{ x: 1, y: 1 }}
                />
              </React.Fragment>
            ))}
          </Layer>

          {/* Transformer Layer */}
          <Layer>
            <Transformer
              ref={transformerRef}
              boundBoxFunc={(oldBox, newBox) => {
                // Enforce minimum size
                if (newBox.width < MIN_BOX_SIZE || newBox.height < MIN_BOX_SIZE) {
                  return oldBox;
                }

                // Enforce image boundaries
                if (image) {
                  const imageRect = {
                    x: imageOffsetX,
                    y: imageOffsetY,
                    width: image.width * scale,
                    height: image.height * scale,
                  };

                  // Clamp the new bounding box to be within the image's rectangle
                  const clampedX = Math.max(imageRect.x, newBox.x);
                  const clampedY = Math.max(imageRect.y, newBox.y);
                  
                  const clampedWidth = Math.min(
                    imageRect.x + imageRect.width, 
                    newBox.x + newBox.width
                  ) - clampedX;
                  
                  const clampedHeight = Math.min(
                    imageRect.y + imageRect.height,
                    newBox.y + newBox.height
                  ) - clampedY;

                  return {
                    ...newBox,
                    x: clampedX,
                    y: clampedY,
                    width: clampedWidth,
                    height: clampedHeight,
                  };
                }

                return newBox;
              }}
              enabledAnchors={[
                'top-left', 'top-right', 'bottom-left', 'bottom-right',
                'top-center', 'middle-right', 'bottom-center', 'middle-left'
              ]}
            />
          </Layer>
        </Stage>
      </div>
    </div>
  );
};