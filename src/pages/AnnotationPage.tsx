"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ChevronLeft, 
  ChevronRight, 
  SkipForward, 
  CheckCircle2,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ArrowLeft,
  Download
} from "lucide-react";
import { useFileManager, Annotation } from "@/features/file/hooks/useFileManager";
import { useProject } from "@/features/project/hooks/useProject";
import { ClassDefinition } from "@/features/project/types";
import { useCollaboration } from "@/features/collaboration/hooks/useCollaboration";
import { useSimpleCollaboration } from "@/features/collaboration/hooks/useSimpleCollaboration";
import { ImageStatusIndicator } from "@/features/collaboration/components/ImageStatusIndicator";
import { ConflictResolution } from "@/features/collaboration/components/ConflictResolution";
import { useAuth } from "@/auth/AuthProvider";
import { KonvaAnnotationCanvas } from "@/components/KonvaAnnotationCanvas";
import { HTMLCanvasAnnotation } from "@/components/HTMLCanvasAnnotation";
import { downloadYoloAnnotations } from "@/lib/yolo-parser";


const DEFAULT_COLORS = [
  "#ef4444", "#3b82f6", "#22c55e", "#eab308", 
  "#a855f7", "#f97316", "#06b6d4", "#84cc16"
];

export const AnnotationPage = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get project ID from URL
  const pathParts = window.location.pathname.split('/');
  const projectId = pathParts[2];
  
  const { images, updateImageStatus, updateImageAnnotations, updateImageAnnotationData, isLoading } = useFileManager(projectId || "");
  const { projects } = useProject();
  const { 
    assignImage, 
    releaseAssignment, 
    updateActivity, 
    getImageStatus,
    canAssign 
  } = useCollaboration(projectId || "", images);
  
  // Find the current project by ID
  const currentProject = projects.find(p => p.id === projectId);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedClass, setSelectedClass] = useState(0);
  const [selectedAnnotation, setSelectedAnnotation] = useState<string | null>(null);
  const [drawingMode, setDrawingMode] = useState(false);
  const [scale, setScale] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  
  // Ref to track if annotations are being loaded from API (to prevent infinite loop)
  const isLoadingAnnotationsRef = useRef(false);

  const currentImageIndex = images.findIndex(img => img.id === imageId);
  const totalImages = images.length;
  
  // Memoize currentImage to prevent unnecessary re-renders and dependency loops
  const currentImage = useMemo(() => {
    const index = images.findIndex(img => img.id === imageId);
    return index >= 0 ? images[index] : null;
  }, [images, imageId]);

  // Get classes from current project or use defaults
  const CLASSES: ClassDefinition[] = currentProject?.classDefinitions || 
    (currentProject?.classNames.map((name, index) => ({
      id: index,
      name: name,
      color: DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      key: (index + 1).toString()
    })) || [
      { id: 0, name: 'person', color: '#ef4444', key: '1' },
      { id: 1, name: 'car', color: '#3b82f6', key: '2' },
      { id: 2, name: 'bike', color: '#22c55e', key: '3' },
      { id: 3, name: 'dog', color: '#eab308', key: '4' },
    ]);

  // Assign image and load existing annotations when image changes
  useEffect(() => {
    if (imageId && user && images.length > 0) {
      // Find current image inside the effect to avoid circular dependencies
      const image = images.find(img => img.id === imageId);
      if (!image) return;
      
      // Prevent running if we're already in a loading state
      if (isLoadingAnnotationsRef.current) {
        console.log('[AnnotationPage] Skipping effect - already loading annotations');
        return;
      }
      
      // Try to assign the image for annotation
      assignImage(image.id, 'annotation').then((success) => {
        if (!success) {
          const status = getImageStatus(image.id);
          if (status.status === 'locked' && status.assignedUsername !== user.username) {
            // Show warning but still allow viewing
            console.warn(`Image is locked by ${status.assignedUsername}`);
          }
        }
      });
      
      // Load existing annotations only if they haven't been loaded yet
      const currentAnnotationsCount = annotations.length;
      const cachedAnnotationsCount = image.annotationData?.length || 0;
      
      // Only load if annotations have changed or this is initial load
      if (currentAnnotationsCount !== cachedAnnotationsCount) {
        console.log(`[AnnotationPage] Loading annotations for image ${image.id}, has ${cachedAnnotationsCount} annotations`);
        isLoadingAnnotationsRef.current = true;
        
        if (image.annotationData) {
          console.log(`[AnnotationPage] Setting ${image.annotationData.length} annotations from cache`);
          setAnnotations(image.annotationData);
        } else {
          console.log('[AnnotationPage] No cached annotations, setting empty array');
          setAnnotations([]);
        }
        
        // Reset flag after state update
        setTimeout(() => {
          isLoadingAnnotationsRef.current = false;
          console.log('[AnnotationPage] Annotation loading flag reset - saves can now proceed');
        }, 100);
      }
    }
    
    // Cleanup function to release assignment when leaving
    return () => {
      if (imageId && user) {
        releaseAssignment(imageId, false);
      }
    };
  }, [imageId, user, images.length, assignImage, releaseAssignment, getImageStatus]); // Use images.length instead of images array

  // Save annotations whenever they change (with debouncing to prevent loops)
  useEffect(() => {
    // Don't save if annotations are being loaded from API (prevents infinite loop)
    if (isLoadingAnnotationsRef.current) {
      console.log('[AnnotationPage] Skipping save - annotations are being loaded');
      return;
    }
    
    // Don't save if we don't have a valid imageId
    if (!imageId) {
      console.log('[AnnotationPage] Skipping save - no imageId');
      return;
    }
    
    console.log(`[AnnotationPage] Scheduling save for ${annotations.length} annotations`);
    
    const timeoutId = setTimeout(async () => {
      try {
        setIsSaving(true);
        console.log(`[AnnotationPage] Saving ${annotations.length} annotations for image ${imageId}`);
        
        // Only call updateImageAnnotationData - it handles status update internally
        await updateImageAnnotationData(imageId, annotations);
        
        console.log(`[AnnotationPage] Successfully saved ${annotations.length} annotations`);
      } catch (error) {
        console.error('[AnnotationPage] Failed to save annotations:', error);
        // TODO: Show user-friendly error message
      } finally {
        setIsSaving(false);
      }
    }, 800); // Increased debounce to 800ms to prevent excessive API calls
    
    return () => {
      console.log('[AnnotationPage] Clearing save timeout');
      clearTimeout(timeoutId);
    };
  }, [annotations, imageId, updateImageAnnotationData]); // Use imageId instead of currentImage?.id

  // Calculate initial scale when image changes
  useEffect(() => {
    if (currentImage?.url) {
      const img = new Image();
      img.onload = () => {
        const maxWidth = window.innerWidth * 0.6;
        const maxHeight = window.innerHeight * 0.7;
        const scaleX = maxWidth / img.width;
        const scaleY = maxHeight / img.height;
        const newScale = Math.min(scaleX, scaleY, 1);
        setScale(newScale);
      };
      img.src = currentImage.url;
    }
  }, [currentImage?.url]); // Use specific URL property instead of entire object

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      console.log(`[KeyDown] key="${e.key}" on AnnotationPage`);
      if (e.key >= '1' && e.key <= '9') {
        const classIndex = parseInt(e.key) - 1;
        if (classIndex < CLASSES.length) {
          console.log(`[Shortcut] Select class index=${classIndex} name=${CLASSES[classIndex].name}`);
          setSelectedClass(classIndex);
        }
      }
      
      switch (e.key) {
        case 'w':
        case 'W':
          setDrawingMode(prev => {
            const next = !prev;
            console.log(`[Shortcut] Toggle drawing mode: ${prev} -> ${next}`);
            return next;
          });
          setSelectedAnnotation(null);
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          console.log('[Shortcut] Previous image');
          handlePrevious();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          console.log('[Shortcut] Next image');
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          console.log('[Shortcut] Complete current image');
          handleComplete();
          break;
        case 'Delete':
        case 'Backspace':
          console.log(`[Shortcut] Delete pressed, selectedAnnotation=${selectedAnnotation}`);
          if (selectedAnnotation) {
            handleDeleteAnnotation(selectedAnnotation);
          }
          break;
        case 'Escape':
          console.log('[Shortcut] Escape pressed: clearing selection and exiting drawing mode');
          setSelectedAnnotation(null);
          setDrawingMode(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentImageIndex, selectedAnnotation, drawingMode, images]);

  const handleAnnotationsChange = (newAnnotations: Annotation[]) => {
    console.log(`[Annotations] Received ${newAnnotations.length} annotations from canvas`);
    setAnnotations(newAnnotations);
  };

  const handleDeleteAnnotation = (id: string) => {
    console.log(`[Annotations] Deleting annotation id=${id}`);
    setAnnotations(annotations.filter(a => a.id !== id));
    setSelectedAnnotation(null);
  };

  const handlePrevious = () => {
    if (currentImageIndex > 0) {
      const prevImage = images[currentImageIndex - 1];
      navigate(`/project/${projectId}/annotate/${prevImage.id}`);
    }
  };

  const handleNext = () => {
    if (currentImageIndex < totalImages - 1) {
      const nextImage = images[currentImageIndex + 1];
      navigate(`/project/${projectId}/annotate/${nextImage.id}`);
    }
  };

  const handleComplete = async () => {
    // Mark assignment as completed before navigating
    if (currentImage && user) {
      await releaseAssignment(currentImage.id, true);
    }
    
    // Navigate to next image or back to project
    if (currentImageIndex < totalImages - 1) {
      handleNext();
    } else {
      navigate(`/project/${projectId}`);
    }
  };

  const handleZoomIn = () => setScale(Math.min(scale * 1.2, 3));
  const handleZoomOut = () => setScale(Math.max(scale / 1.2, 0.5));
  const handleReset = () => setScale(1);

  // Handle YOLO export for current image
  const handleDownloadYolo = useCallback(async () => {
    if (!currentImage || annotations.length === 0) {
      alert('No annotations to export for this image');
      return;
    }

    try {
      // Get image dimensions
      const img = new Image();
      img.crossOrigin = 'anonymous';
      
      img.onload = () => {
        const imageWidth = img.width;
        const imageHeight = img.height;
        
        // Get the base filename without extension
        const baseName = currentImage.name.replace(/\.[^/.]+$/, "");
        
        // Download YOLO format file
        downloadYoloAnnotations(
          annotations,
          imageWidth,
          imageHeight,
          `${baseName}.txt`
        );
        
        console.log(`Downloaded YOLO annotations for ${currentImage.name}`);
      };
      
      img.onerror = () => {
        console.error('Failed to load image for export');
        alert('Failed to load image dimensions for export');
      };
      
      img.src = currentImage.url;
    } catch (error) {
      console.error('Error exporting YOLO annotations:', error);
      alert('Failed to export annotations');
    }
  }, [currentImage, annotations]);

  if (!currentImage && images.length > 0) {
    // If we have images but current image not found, redirect to first image
    if (images.length > 0) {
      navigate(`/project/${projectId}/annotate/${images[0].id}`, { replace: true });
      return null;
    }
  }

  // Show loading state while images are being fetched
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
          <p className="text-gray-600">Loading images and annotations</p>
        </div>
      </div>
    );
  }

  if (!currentImage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">No images available</h1>
          <p className="text-gray-600 mb-4">
            Please upload images to your project first
          </p>
          <Button onClick={() => navigate(`/project/${projectId}`)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Project
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Left Panel - Classes */}
      <div className="w-64 bg-white border-r p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Classes</h3>
          <span className={`text-xs px-2 py-1 rounded ${
            drawingMode ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
          }`}>
            {drawingMode ? 'DRAW' : 'SELECT'}
          </span>
        </div>
        <div className="space-y-2">
          {CLASSES.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={`w-full text-left p-2 rounded flex items-center space-x-2 transition-colors ${
                selectedClass === cls.id && drawingMode ? 'bg-blue-100 border-2 border-blue-400' : 
                selectedClass === cls.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              } ${!drawingMode ? 'opacity-50' : ''}`}
            >
              <div 
                className="w-4 h-4 rounded" 
                style={{ backgroundColor: cls.color }}
              />
              <span className="text-sm">{cls.key}. {cls.name}</span>
            </button>
          ))}
        </div>
        
        <div className="mt-6">
          <h4 className="font-medium mb-2">Current Annotations ({annotations.length})</h4>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {annotations.map((ann, index) => (
              <div 
                key={ann.id}
                onClick={() => setSelectedAnnotation(ann.id)}
                className={`p-2 rounded text-xs cursor-pointer flex items-center justify-between ${
                  selectedAnnotation === ann.id ? 'bg-red-100 border border-red-300' : 'bg-gray-50 hover:bg-gray-100'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: ann.color }}
                  />
                  <span>{ann.className}</span>
                </div>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  className="h-6 w-6 p-0 hover:bg-red-200"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteAnnotation(ann.id);
                  }}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {annotations.length === 0 && (
              <p className="text-xs text-gray-500 italic">No annotations yet</p>
            )}
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium mb-2">Shortcuts</h4>
          <div className="text-xs space-y-1 text-gray-600">
            <p className="font-medium text-green-600">W: Toggle drawing mode</p>
            <p>1-9: Select class</p>
            <p>Click: {drawingMode ? 'Draw boxes (min 5x5px)' : 'Select annotation'}</p>
            <p>A/D: Prev/Next</p>
            <p>Space: Complete</p>
            <p>Del: Delete selected</p>
            <p>Esc: Exit modes</p>
          </div>
          
          {!drawingMode && (
            <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700">
              💡 Press <strong>W</strong> to enable drawing mode, then drag to create bounding boxes
            </div>
          )}
          
          {drawingMode && (
            <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
              🎯 Drawing mode active! Click and drag to create boxes (minimum 5x5 pixels)
            </div>
          )}
        </div>

        {/* Conflict Resolution */}
        <div className="mt-6">
          <ConflictResolution 
            projectId={projectId || ""} 
            images={images}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="bg-white border-b px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(`/project/${projectId}`)}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h2 className="font-semibold">{currentImage.name}</h2>
            <span className="text-sm text-gray-600">
              {currentImageIndex + 1} / {totalImages}
            </span>
            <Progress value={((currentImageIndex + 1) / totalImages) * 100} className="w-32" />
            
            {/* Assignment Status */}
            <ImageStatusIndicator 
              imageId={currentImage.id}
              images={images}
              projectId={projectId || ""}
              showUsernames={true}
              size="md"
            />
            
            <span className={`text-sm px-2 py-1 rounded font-medium ${
              drawingMode ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
            }`}>
              {drawingMode ? 'Drawing Mode (W to toggle)' : 'Selection Mode (W to draw)'}
            </span>
            {selectedAnnotation && !drawingMode && (
              <span className="text-sm bg-red-100 text-red-800 px-2 py-1 rounded">
                Annotation selected (press Del to delete)
              </span>
            )}
            {isSaving && (
              <span className="text-sm bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                Saving...
              </span>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm" onClick={handleZoomOut}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={handleZoomIn}>
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 overflow-auto">
          <KonvaAnnotationCanvas
            imageUrl={currentImage.url}
            annotations={annotations}
            onAnnotationsChange={handleAnnotationsChange}
            selectedClass={CLASSES[selectedClass]}
            isDrawingMode={drawingMode}
            scale={scale}
            classDefinitions={CLASSES}
            selectedAnnotationId={selectedAnnotation}
            onSelectAnnotation={setSelectedAnnotation}
          />
        </div>

        {/* Bottom Controls */}
        <div className="bg-white border-t px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Button onClick={handlePrevious} disabled={currentImageIndex === 0}>
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button onClick={handleNext} disabled={currentImageIndex === totalImages - 1}>
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={() => navigate(`/project/${projectId}`)}>
              <SkipForward className="h-4 w-4 mr-1" />
              Skip
            </Button>
            <Button onClick={handleComplete}>
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Complete
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDownloadYolo}
              disabled={annotations.length === 0}
              title={annotations.length === 0 ? "No annotations to export" : "Download YOLO annotations"}
            >
              <Download className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Right Panel - Thumbnails */}
      <div className="w-48 bg-white border-l p-4">
        <h3 className="font-semibold mb-4">Images</h3>
        <div className="space-y-2">
          {images.map((img, index) => (
            <button
              key={img.id}
              onClick={() => navigate(`/project/${projectId}/annotate/${img.id}`)}
              className={`w-full p-2 rounded border transition-colors ${
                img.id === imageId ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="aspect-square bg-gray-200 rounded mb-1">
                <img 
                  src={img.url} 
                  alt={img.name} 
                  className="w-full h-full object-cover rounded"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIiB2aWV3Qm94PSIwIDAgMjQgMjQiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI2NjYyIgc3Ryb2tlLXdpZHRoPSIyIj48cmVjdCB4PSIzIiB5PSMzIiB3aWR0aD0iMTgiIGhlaWdodD0iMTgiIHJ4PSIyIiByeT0iMiIvPjxjaXJjbGUgY3g9IjguNSIgY3k9IjguNSIgcj0iMS41Ii8+PHBhdGggZD0iTTIxIDE1bC01LTVMNSAyMSIvPjwvc3ZnPg==";
                  }}
                />
              </div>
              <p className="text-xs truncate">{img.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};