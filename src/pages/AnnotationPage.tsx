"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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
  RotateCcw
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

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

interface ImageData {
  id: string;
  url: string;
  name: string;
  annotations: Annotation[];
}

const mockImages: ImageData[] = [
  { 
    id: '1', 
    url: 'https://via.placeholder.com/800x600', 
    name: 'street_001.jpg',
    annotations: []
  },
  { 
    id: '2', 
    url: 'https://via.placeholder.com/800x600', 
    name: 'parking_002.jpg',
    annotations: []
  },
];

const CLASSES = [
  { id: 0, name: 'person', color: '#ef4444', key: '1' },
  { id: 1, name: 'car', color: '#3b82f6', key: '2' },
  { id: 2, name: 'bike', color: '#22c55e', key: '3' },
  { id: 3, name: 'dog', color: '#eab308', key: '4' },
];

export const AnnotationPage = () => {
  const { imageId } = useParams();
  const navigate = useNavigate();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [currentBox, setCurrentBox] = useState<Annotation | null>(null);
  const [selectedClass, setSelectedClass] = useState(0);
  const [scale, setScale] = useState(1);
  const [imageLoaded, setImageLoaded] = useState(false);

  const currentImage = mockImages[currentImageIndex];
  const totalImages = mockImages.length;

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
  }, [currentImageIndex, currentBox]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setIsDrawing(true);
    setStartPoint({ x, y });
    setCurrentBox(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    const width = Math.abs(x - startPoint.x);
    const height = Math.abs(y - startPoint.y);
    const boxX = Math.min(x, startPoint.x);
    const boxY = Math.min(y, startPoint.y);

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
      setCurrentImageIndex(currentImageIndex - 1);
      setAnnotations([]);
    }
  };

  const handleNext = () => {
    if (currentImageIndex < totalImages - 1) {
      setCurrentImageIndex(currentImageIndex + 1);
      setAnnotations([]);
    }
  };

  const handleComplete = () => {
    // Mark current image as completed
    console.log('Completed image:', currentImage.name, 'with', annotations.length, 'annotations');
    handleNext();
  };

  const handleZoomIn = () => setScale(Math.min(scale * 1.2, 3));
  const handleZoomOut = () => setScale(Math.max(scale / 1.2, 0.5));
  const handleReset = () => setScale(1);

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
          <div className="flex justify-center">
            <canvas
              ref={canvasRef}
              width={800}
              height={600}
              className="border bg-white cursor-crosshair"
              style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}
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
            <Button variant="outline" onClick={() => navigate('/images')}>
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
          {mockImages.map((img, index) => (
            <button
              key={img.id}
              onClick={() => setCurrentImageIndex(index)}
              className={`w-full p-2 rounded border transition-colors ${
                index === currentImageIndex ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="aspect-square bg-gray-200 rounded mb-1" />
              <p className="text-xs truncate">{img.name}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};