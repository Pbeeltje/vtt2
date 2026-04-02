import { useCallback, useRef } from "react"
import { clientToGridLogical } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import type { NewDrawingData } from '../components/Home'
import type { DarknessPath } from '../components/main-content/DarknessLayer'
import type { MapInteractionTool } from "../types/mapTool"
import { isFogCellTool, isFogStrokeTool, isCanvasStrokeTool } from "../types/mapTool"

/** Grid indices from (gx0,gy0) to (gx1,gy1), inclusive; fills gaps when dragging fast. */
function gridCellsAlongLine(gx0: number, gy0: number, gx1: number, gy1: number): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  let x = gx0
  let y = gy0
  const dx = Math.abs(gx1 - gx0)
  const dy = Math.abs(gy1 - gy0)
  const sx = gx0 < gx1 ? 1 : gx0 > gx1 ? -1 : 0
  const sy = gy0 < gy1 ? 1 : gy0 > gy1 ? -1 : 0
  let err = dx - dy
  for (;;) {
    cells.push([x, y])
    if (x === gx1 && y === gy1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
  return cells
}

function makeFogCellPath(
  ix: number,
  iy: number,
  gridSize: number,
  tool: MapInteractionTool
): DarknessPath {
  return {
    id: `darkness-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    type: tool === "darknessEraserCell" ? "erase" : "paint",
    createdAt: new Date().toISOString(),
    cellRect: { x: ix * gridSize, y: iy * gridSize, width: gridSize, height: gridSize },
  }
}

interface UseDrawingProps {
  gridRef: React.RefObject<HTMLDivElement>
  gridSize: number
  fogBrushDiameter: number
  currentTool: MapInteractionTool
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
  gridSize,
  fogBrushDiameter,
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
  const fogCellInitialRef = useRef<DarknessPath[]>([])
  const fogCellAddedRef = useRef<DarknessPath[]>([])
  const fogCellVisitedRef = useRef<Set<string>>(new Set())
  const fogCellLastIdxRef = useRef<{ ix: number; iy: number } | null>(null)

  const resetFogCellDrag = useCallback(() => {
    fogCellInitialRef.current = []
    fogCellAddedRef.current = []
    fogCellVisitedRef.current = new Set()
    fogCellLastIdxRef.current = null
  }, [])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isCanvasStrokeTool(currentTool) && !isFogCellTool(currentTool)) {
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

    const { x, y } = clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel);

    if (isFogCellTool(currentTool)) {
      if (onDarknessChange && darknessPaths) {
        const ix = Math.floor(x / gridSize)
        const iy = Math.floor(y / gridSize)
        const key = `${ix},${iy}`
        fogCellInitialRef.current = [...darknessPaths]
        fogCellAddedRef.current = []
        fogCellVisitedRef.current = new Set([key])
        fogCellLastIdxRef.current = { ix, iy }
        const first = makeFogCellPath(ix, iy, gridSize, currentTool)
        fogCellAddedRef.current.push(first)
        onDarknessChange([...fogCellInitialRef.current, ...fogCellAddedRef.current])
        setIsDrawing(true)
        setCurrentPath("")
      }
      e.preventDefault()
      return
    }

    resetFogCellDrag()
    setIsDrawing(true);
    setCurrentPath(`M${x},${y}`);
    e.preventDefault();
  }, [currentTool, zoomLevel, currentSceneId, currentUserId, gridSize, darknessPaths, onDarknessChange, resetFogCellDrag]);
    
  const draw = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing) return

    if (isFogCellTool(currentTool)) {
      if (!onDarknessChange) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const { x, y } = clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel)
      const ix1 = Math.floor(x / gridSize)
      const iy1 = Math.floor(y / gridSize)
      const last = fogCellLastIdxRef.current
      if (!last) return
      if (last.ix === ix1 && last.iy === iy1) {
        e.preventDefault()
        return
      }
      const segment = gridCellsAlongLine(last.ix, last.iy, ix1, iy1)
      let anyNew = false
      for (const [ix, iy] of segment) {
        const k = `${ix},${iy}`
        if (fogCellVisitedRef.current.has(k)) continue
        fogCellVisitedRef.current.add(k)
        fogCellAddedRef.current.push(makeFogCellPath(ix, iy, gridSize, currentTool))
        anyNew = true
      }
      fogCellLastIdxRef.current = { ix: ix1, iy: iy1 }
      if (anyNew) {
        onDarknessChange([...fogCellInitialRef.current, ...fogCellAddedRef.current])
      }
      e.preventDefault()
      return
    }

    if (!isCanvasStrokeTool(currentTool)) return

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const { x, y } = clientToGridLogical(e.clientX, e.clientY, rect, zoomLevel);
    setCurrentPath(prev => `${prev} L${x},${y}`);
    e.preventDefault();
  }, [isDrawing, currentTool, zoomLevel, gridSize, onDarknessChange]);

  const endDrawing = useCallback((e?: React.MouseEvent<any>) => {
    if (!isDrawing) return

    if (isFogCellTool(currentTool)) {
      e?.preventDefault()
      resetFogCellDrag()
      setIsDrawing(false)
      setCurrentPath("")
      return
    }

    if (!currentPath || !isCanvasStrokeTool(currentTool)) return;
    
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

    if (isFogStrokeTool(currentTool)) {
      if (onDarknessChange && darknessPaths) {
        const newPath: DarknessPath = {
          id: `darkness-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          path: currentPath,
          type: currentTool === "darknessEraser" ? "erase" : "paint",
          createdAt: new Date().toISOString(),
          strokeWidth: fogBrushDiameter,
        };
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
  }, [isDrawing, currentPath, currentTool, currentSceneId, currentUserId, currentColor, onDrawingAdd, darknessPaths, onDarknessChange, fogBrushDiameter, resetFogCellDrag]);

  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      if (isFogCellTool(currentTool)) {
        resetFogCellDrag()
      }
      setIsDrawing(false);
      setCurrentPath('');
    }
  }, [isDrawing, currentTool, setIsDrawing, setCurrentPath, resetFogCellDrag]);

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
  }, [currentTool, currentUserRole, currentUserId, setSelectedDrawingIds]);

  const handleDrawingDelete = useCallback(async (drawingIds: string[]) => {
    if (drawingIds.length === 0) return;
    
    try {
      const response = await fetch('/api/drawings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ drawingIds }),
      });
      
      if (response.ok) {
        setSelectedDrawingIds([]);
        setSelectedIds([]);
      } else {
        throw new Error('Failed to delete drawings');
      }
    } catch (error) {
      console.error('Error deleting drawings:', error);
      toast({ title: "Error", description: "Failed to delete drawings.", variant: "destructive" });
    }
  }, [setSelectedDrawingIds, setSelectedIds]);

  return {
    startDrawing,
    draw,
    endDrawing,
    handleMouseLeave,
    handleDrawingClick,
    handleDrawingDelete,
  };
}; 