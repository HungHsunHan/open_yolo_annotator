"use client";

import { useState, useEffect, useRef } from "react";
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
  ArrowLeft
} from "lucide-react";
import { useFileManager } from "@/features/file/hooks/useFileManager";

interface Annotation {
  id: string;
  classId: number;
  className: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const CLASSES = [
  { id: 0, name: 'person', color: '#ef4444', key: '1' },
  { id: 1, name: 'car', color: '#3b82f6', key: '2' },
  { id: 2, name: 'bike', color: '#22c55e', key: '3' },
  { id: 3, name: 'dog', color: '#eab308', key: '4' },
];

export const AnnotationPage = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  
  // Get project ID from URL
  const pathParts = window.location.pathname.split('/');
  const projectId = pathParts[2];
  
  const { images, updateImageStatus, updateImageAnnotations } = useFileManager(projectId || "");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Annotation | null>(null);
  const [selectedClass, setSelectedClass] = useState(0);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

  const currentImageIndex = images.findIndex(img => img.id === imageId);
  const currentImage = images[currentImageIndex] || null;
  const totalImages = images.length;

  // Load image and set canvas dimensions
  useEffect(() => {
    if (!currentImage || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      setImageDimensions({ width: img.width, height: img.height });
      
      // Calculate scale to fit image in viewport
      const maxWidth = window.innerWidth * 0.6;
      const maxHeight = window.innerHeight * 0.7;
      const scaleX = maxWidth / img.width;
      const scaleY = maxHeight / img.height;
      const newScale = Math.min(scaleX, scaleY, 1);
      
      setScale(newScale);
      
      // Set canvas dimensions to match scaled image
      canvas.width = img.width * newScale;
      canvas.height = img.height * newScale;
      
      // Draw image
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      
      setImageLoaded(true);
    };
    
    img.onerror = (e) => {
      console.error("Failed to load image:", currentImage.name, e);
      // Set a placeholder image
      ctx.fillStyle = "#f0f0f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#999";
      ctx.font = "20px Arial";
      ctx.textAlign = "center";
      ctx.fillText("Failed to load image", canvas.width/2, canvas.height/2);
    };
    
    img.src = currentImage.url;
    imageRef.current = img;
  }, [currentImage]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        const classIndex = parseInt(e.key) - 1;
        if (classIndex < CLASSES.length) {
          setSelectedClass(classIndex);
        }
      }
      
      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          handlePrevious();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          handleNext();
          break;
        case ' ':
          e.preventDefault();
          handleComplete();
          break;
        case 'Delete':
        case 'Backspace':
          if (currentBox) {
            handleDeleteAnnotation(currentBox.id);
          }
          break;
        case 'Escape':
          setCurrentBox(null);
          setIsDrawing(false);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentImageIndex, currentBox, images]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imageLoaded) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !canvasRef.current || !imageRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);
    const boxX = Math.min(x, startPoint.x);
    const boxY = Math.min(y, startPoint.y);

    // Redraw image and existing annotations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imageRef.current, 0, 0, canvas.width, canvas.height);

    // Draw existing annotations
    annotations.forEach(ann => {
      ctx.strokeStyle = ann.color;
      ctx.lineWidth = 2;
      ctx.strokeRect(ann.x * scale, ann.y * scale, ann.width * scale, ann.height * scale);
      
      ctx.fillStyle = ann.color;
      ctx.font = '14px Arial';
      ctx.fillText(ann.className, ann.x * scale + 5, ann.y * scale + 20);
    });

    // Draw current box
    ctx.strokeStyle = CLASSES[selectedClass].color;
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX * scale, boxY * scale, width * scale, height * scale);
    
    ctx.fillStyle = CLASSES[selectedClass].color;
    ctx.font = '14px Arial';
    ctx.fillText(CLASSES[selectedClass].name, boxX * scale + 5, boxY * scale + 20);

    setCurrentBox({
      id: Date.now().toString(),
      classId: selectedClass,
      className: CLASSES[selectedClass].name,
      color: CLASSES[selectedClass].color,
      x: boxX,
      y: boxY,
      width,
      height,
    });
  };

  const handleMouseUp = () => {
    if (currentBox && currentBox.width > 10 && currentBox.height > 10) {
      setAnnotations([...annotations, currentBox]);
    }
    setIsDrawing(false);
    setCurrentBox(null);
  };

  const handleDeleteAnnotation = (id: string) => {
    setAnnotations(annotations.filter(a => a.id !== id));
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

  const handleComplete = () => {
    if (currentImage) {
      updateImageStatus(currentImage.id, 'completed');
      updateImageAnnotations(currentImage.id, annotations.length);
    }
    
    if (currentImageIndex < totalImages - 1) {
      handleNext();
    } else {
      navigate(`/project/${projectId}`);
    }
  };

  const handleZoomIn = () => setScale(Math.min(scale * 1.2, 3));
  const handleZoomOut = () => setScale(Math.max(scale / 1.2, 0.5));
  const handleReset = () => setScale(1);

  if (!currentImage && images.length > 0) {
    // If we have images but current image not found, redirect to first image
    if (images.length > 0) {
      navigate(`/project/${projectId}/annotate/${images[0].id}`, { replace: true });
      return null;
    }
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
        <h3 className="font-semibold mb-4">Classes</h3>
        <div className="space-y-2">
          {CLASSES.map((cls) => (
            <button
              key={cls.id}
              onClick={() => setSelectedClass(cls.id)}
              className={`w-full text-left p-2 rounded flex items-center space-x-2 transition-colors ${
                selectedClass === cls.id ? 'bg-blue-100' : 'hover:bg-gray-100'
              }`}
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
          <h4 className="font-medium mb-2">Shortcuts</h4>
          <div className="text-xs space-y-1 text-gray-600">
            <p>1-9: Select class</p>
            <p>A/D: Prev/Next</p>
            <p>Space: Complete</p>
            <p>Del: Delete box</p>
            <p>Esc: Cancel</p>
          </div>
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
        <div className="flex-1 overflow-auto p-4">
          <div className="flex justify-center items-center h-full">
            <canvas
              ref={canvasRef}
              className="border bg-white cursor-crosshair max-w-full max-h-full"
              style={{ maxWidth: '100%', maxHeight: '100%' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
            />
          </div>
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
                    target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100' viewBox='0 0 24 24' fill='none' stroke='%23ccc' stroke-width='2'%3E%3Crect x='3' y='3' width='18' height='18' rx='2' ry='2'/%3E%3Ccircle cx='8.5' cy='8.5' r='1.5'/%3E%3Cpath d='M21 15l-5-5L5 21'/%3E%3C/svg%3E";
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