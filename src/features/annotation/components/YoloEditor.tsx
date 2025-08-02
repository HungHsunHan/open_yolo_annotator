"use client";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const YoloEditor = ({ imageSrc }: { imageSrc: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxes, setBoxes] = useState<Array<[number, number, number, number, number]>>([]);
  const [currentClass, setCurrentClass] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      drawBoxes();
    };
    img.src = imageSrc;

    const drawBoxes = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      
      boxes.forEach(([classId, x, y, w, h]) => {
        const pixelX = x * canvas.width;
        const pixelY = y * canvas.height;
        const pixelW = w * canvas.width;
        const pixelH = h * canvas.height;
        
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          pixelX - pixelW/2,
          pixelY - pixelH/2,
          pixelW,
          pixelH
        );
        
        ctx.fillStyle = 'red';
        ctx.font = '16px Arial';
        ctx.fillText(`Class ${classId}`, pixelX - pixelW/2 + 5, pixelY - pixelH/2 + 20);
      });
    };

    const handleClick = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / canvas.width;
      const y = (e.clientY - rect.top) / canvas.height;
      
      // Default box size (10% of image size)
      const w = 0.1;
      const h = 0.1;
      
      setBoxes([...boxes, [currentClass, x, y, w, h]]);
    };

    canvas.addEventListener('click', handleClick);
    return () => canvas.removeEventListener('click', handleClick);
  }, [boxes, currentClass, imageSrc]);

  return (
    <div className="space-y-4">
      <div className="flex items-center space-x-4">
        <Label>Current Class ID:</Label>
        <Input 
          type="number" 
          value={currentClass}
          onChange={(e) => setCurrentClass(parseInt(e.target.value))}
          className="w-20"
          min="0"
        />
      </div>
      
      <div className="border rounded-md overflow-auto">
        <canvas 
          ref={canvasRef} 
          className="max-w-full max-h-[70vh]"
        />
      </div>
      
      <div className="space-x-2">
        <Button onClick={() => setBoxes([])} variant="destructive">
          Clear All
        </Button>
        <Button onClick={() => setBoxes(boxes.slice(0, -1))}>
          Undo Last
        </Button>
      </div>
      
      <div className="bg-gray-100 p-4 rounded-md">
        <h3 className="font-medium mb-2">YOLO Format Annotations:</h3>
        <pre className="text-sm bg-white p-2 rounded">
          {boxes.map((box, i) => (
            <div key={i}>{box.join(' ')}</div>
          ))}
        </pre>
      </div>
    </div>
  );
};