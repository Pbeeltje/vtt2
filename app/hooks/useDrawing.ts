import { useCallback } from "react"
import { toast } from "@/components/ui/use-toast"
import type { NewDrawingData } from '../components/Home'
import type { DarknessPath } from '../components/main-content/DarknessLayer'

interface UseDrawingProps {
  gridRef: React.RefObject<HTMLDivElement>
  currentTool: 'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush'
  currentColor: string
  zoomLevel: number
  currentSceneId?: number | null
  currentUserId?: number | null
  currentUserRole?: string | null
  isDrawing: boolean
  setIsDrawing: React.Dispatch<React.SetStateAction<boolean>>
  currentPath: string
  setCurrentPath: React.Dispatch<React.SetStateAction<string>>
  selectedDrawingIds: string[]
  setSelectedDrawingIds: React.Dispatch<React.SetStateAction<string[]>>
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  onDrawingAdd: (data: NewDrawingData) => void | Promise<void>
  // Darkness functionality
  darknessPaths?: DarknessPath[]
  onDarknessChange?: (paths: DarknessPath[]) => void
}

export const useDrawing = ({
  gridRef,
  currentTool,
  currentColor,
  zoomLevel,
  currentSceneId,
  currentUserId,
  currentUserRole,
  isDrawing,
  setIsDrawing,
  currentPath,
  setCurrentPath,
  selectedDrawingIds,
  setSelectedDrawingIds,
  setSelectedIds,
  onDrawingAdd,
  darknessPaths,
  onDarknessChange,
}: UseDrawingProps) => {

  const startDrawing = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const isDarknessMode = currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
    
    console.log('[useDrawing] startDrawing called', { currentTool, isDarknessMode });
    
    if (currentTool !== 'brush' && !isDarknessMode) {
      console.log('[useDrawing] Tool not supported, returning');
      return;
    }
    
    if (!currentSceneId) {
      console.warn('[StartDrawing] Aborted: currentSceneId prop is null/undefined.');
      alert('Scene is not fully loaded yet. Please wait a moment and try drawing again.');
      return;
    }
    
    if (currentUserId === null || currentUserId === undefined) {
      console.warn('[StartDrawing] Aborted: currentUserId prop is null or undefined.');
      alert('User information is not loaded yet. Please wait a moment and try drawing again.');
      return;
    }
    
    if (e.button !== 0 || e.altKey) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    console.log('[useDrawing] Starting drawing', { x, y, isDarknessMode });
    
    setIsDrawing(true);
    setCurrentPath(`M${x},${y}`);
    e.preventDefault();
  }, [currentTool, zoomLevel, currentSceneId, currentUserId]);

  const draw = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const isDarknessMode = currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
    
    if (!isDrawing || (currentTool !== 'brush' && !isDarknessMode)) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    setCurrentPath(prev => `${prev} L${x},${y}`);
    e.preventDefault();
  }, [isDrawing, currentTool, zoomLevel]);

  const endDrawing = useCallback((e?: React.MouseEvent<any>) => {
    const isDarknessMode = currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
    
    if (!isDrawing || !currentPath || (currentTool !== 'brush' && !isDarknessMode)) return;
    
    e?.preventDefault();
    
    if (!currentSceneId) {
      console.warn('[EndDrawing] Aborted: currentSceneId prop is not set.');
      setIsDrawing(false);
      setCurrentPath('');
      return;
    }
    
    if (currentUserId === null || currentUserId === undefined) {
      console.warn('[EndDrawing] Aborted: currentUserId prop is null or undefined.');
      setIsDrawing(false);
      setCurrentPath('');
      return;
    }

    const sceneIdNum = typeof currentSceneId === 'string' ? parseInt(currentSceneId, 10) : currentSceneId;
    if (sceneIdNum === null || isNaN(sceneIdNum)) {
      console.error("[EndDrawing] Invalid sceneId:", currentSceneId);
      setIsDrawing(false);
      setCurrentPath('');
      return;
    }

    if (isDarknessMode) {
      // Handle darkness path
      console.log('[useDrawing] Creating darkness path', { darknessPaths, onDarknessChange });
      if (onDarknessChange && darknessPaths) {
        const newPath: DarknessPath = {
          id: `darkness-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          path: currentPath,
          type: currentTool === 'darknessEraser' ? 'erase' : 'paint',
          createdAt: new Date().toISOString(),
        };
        console.log('[useDrawing] Adding darkness path:', newPath);
        onDarknessChange([...darknessPaths, newPath]);
      } else {
        console.warn('[useDrawing] Missing darkness props', { onDarknessChange: !!onDarknessChange, darknessPaths: !!darknessPaths });
      }
    } else {
      // Handle regular drawing
      const drawingPayload: NewDrawingData = { 
        path: currentPath,
        color: currentColor,
      };
      onDrawingAdd(drawingPayload);
    }
    
    setIsDrawing(false); 
    setCurrentPath('');
  }, [isDrawing, currentPath, currentTool, currentColor, currentSceneId, currentUserId, onDrawingAdd, darknessPaths, onDarknessChange]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      endDrawing();
    }
  }, [isDrawing, endDrawing]);

  const handleDrawingClick = useCallback((e: React.MouseEvent<SVGPathElement>, drawing: {id: string, path: string, color: string, sceneId: number, createdBy: number, createdAt: string}) => {
    e.stopPropagation();
    if (currentTool === 'brush') return;
    
    if (currentUserRole === 'player' && drawing.createdBy !== currentUserId) {
      toast({ title: "Permission Denied", description: "You can only select your own drawings.", variant: "destructive" });
      return;
    }
    
    if (e.shiftKey) {
      setSelectedDrawingIds((prev) => 
        prev.includes(drawing.id) ? prev.filter((id) => id !== drawing.id) : [...prev, drawing.id]
      );
    } else {
      setSelectedDrawingIds([drawing.id]);
    }
    
    setSelectedIds([]);
  }, [currentTool, currentUserRole, currentUserId, setSelectedDrawingIds, setSelectedIds]);

  return {
    startDrawing,
    draw,
    endDrawing,
    handleMouseLeave,
    handleDrawingClick,
  }
} 