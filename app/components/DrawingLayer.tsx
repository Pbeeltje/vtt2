import { useEffect, useRef, useState } from 'react';
import { cn } from "@/lib/utils";

interface DrawingLayerProps {
  isDrawingMode: boolean;
  currentColor: string;
  currentTool: 'brush' | 'cursor';
  drawings: DrawingObject[];
  onDrawingComplete: (drawing: DrawingObject) => void;
  onDrawingSelect: (drawing: DrawingObject | null) => void;
  onDrawingDelete: (drawing: DrawingObject) => void;
  selectedDrawing: DrawingObject | null;
}

export interface DrawingObject {
  id: string;
  path: string;
  color: string;
  createdBy: number;
  createdAt: string;
}

export default function DrawingLayer({
  isDrawingMode,
  currentColor,
  currentTool,
  drawings,
  onDrawingComplete,
  onDrawingSelect,
  onDrawingDelete,
  selectedDrawing
}: DrawingLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<string>('');

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match parent
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Redraw all drawings
    drawings.forEach(drawing => {
      const path = new Path2D(drawing.path);
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.stroke(path);
    });
  }, [drawings]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingMode || currentTool !== 'brush') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setCurrentPath(`M ${x} ${y}`);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCurrentPath(prev => `${prev} L ${x} ${y}`);

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawings.forEach(drawing => {
      const path = new Path2D(drawing.path);
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.stroke(path);
    });

    const currentPathObj = new Path2D(currentPath);
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = 2;
    ctx.stroke(currentPathObj);
  };

  const stopDrawing = () => {
    if (!isDrawing) return;

    setIsDrawing(false);
    if (currentPath) {
      onDrawingComplete({
        id: Date.now().toString(),
        path: currentPath,
        color: currentColor,
        createdBy: 0, // TODO: Get actual user ID
        createdAt: new Date().toISOString()
      });
      setCurrentPath('');
    }
  };

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (currentTool !== 'cursor') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if click is on any drawing
    const clickedDrawing = drawings.find(drawing => {
      const path = new Path2D(drawing.path);
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      return ctx.isPointInPath(path, x, y);
    });

    onDrawingSelect(clickedDrawing || null);
  };

  return (
    <canvas
      ref={canvasRef}
      className={cn(
        "absolute inset-0",
        currentTool === 'brush' ? "pointer-events-auto" : "pointer-events-none",
        currentTool === 'cursor' && "cursor-pointer"
      )}
      onMouseDown={startDrawing}
      onMouseMove={draw}
      onMouseUp={stopDrawing}
      onMouseLeave={stopDrawing}
      onClick={handleClick}
      style={{ zIndex: 15 }}
    />
  );
} 