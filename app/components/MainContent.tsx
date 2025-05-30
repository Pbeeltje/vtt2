"use client"

import { useEffect, useCallback, useState } from "react"
import { toast } from "@/components/ui/use-toast" 
import type { LayerImage } from "../types/layerImage"
import DrawingToolbar from "./DrawingToolbar"
import type { DrawingObject } from './DrawingLayer'; 
import type { NewDrawingData } from './Home';
import { useMainContent } from "../hooks/useMainContent"
import { useDragAndDrop } from "../hooks/useDragAndDrop"
import { useDrawing } from "../hooks/useDrawing"
import GameGrid from "./main-content/GameGrid"
import ZoomControls from "./main-content/ZoomControls"
import StatusModal from "./main-content/StatusModal"
import type { DarknessPath } from "./main-content/DarknessLayer"

interface MainContentProps {
  backgroundImage: string | null
  middleLayerImages: LayerImage[] | undefined
  topLayerImages: LayerImage[] | undefined
  onUpdateImages?: (middleLayer: LayerImage[], topLayer: LayerImage[]) => void
  onUpdateCharacter?: (character: any) => void
  gridSize: number
  gridColor: string
  onGridSizeChange: (size: number) => void
  onGridColorChange: (color: string) => void
  currentTool: 'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush'
  onToolChange: (tool: 'brush' | 'cursor' | 'darknessEraser' | 'darknessBrush') => void
  currentColor: string
  onColorChange: (color: string) => void
  sceneScale: number
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  currentSceneId?: number | null 
  currentUserId?: number | null
  currentUserRole?: string | null
  drawings: DrawingObject[];
  onDrawingAdd: (data: NewDrawingData) => void | Promise<void>;
  onDrawingsDelete: (ids: string[]) => void | Promise<void>;
  onPlayerPlaceToken?: (token: LayerImage, sceneId: number) => void;
  onPlayerRequestTokenDelete?: (tokenId: string) => void;
  onPlayerUpdateTokenPosition?: (token: LayerImage, sceneId: number) => void;
  onOpenCharacterSheet?: (characterData: any) => void;
  // Darkness layer props
  darknessPaths?: DarknessPath[];
  onDarknessChange?: (paths: DarknessPath[]) => void;
  isDarknessLayerVisible?: boolean;
  onToggleDarknessLayer?: () => void;
}

export default function MainContent({
  backgroundImage,
  middleLayerImages = [],
  topLayerImages = [],
  onUpdateImages,
  onUpdateCharacter,
  gridSize,
  gridColor,
  onGridSizeChange,
  onGridColorChange,
  currentTool,
  onToolChange,
  currentColor,
  onColorChange,
  sceneScale = 1,
  zoomLevel,
  setZoomLevel,
  currentSceneId, 
  currentUserId,
  currentUserRole,
  drawings, 
  onDrawingAdd, 
  onDrawingsDelete,
  onPlayerPlaceToken,
  onPlayerRequestTokenDelete,
  onPlayerUpdateTokenPosition,
  onOpenCharacterSheet,
  darknessPaths = [],
  onDarknessChange,
  isDarknessLayerVisible = false,
  onToggleDarknessLayer,
}: MainContentProps) {
  
  // Handle darkness layer changes
  const handleDarknessChange = useCallback((paths: DarknessPath[]) => {
    console.log('[MainContent] handleDarknessChange called with paths:', paths);
    if (onDarknessChange) {
      onDarknessChange(paths)
    }
  }, [onDarknessChange])
  
  // Selection box state
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionStart, setSelectionStart] = useState<{ x: number; y: number } | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<{ x: number; y: number } | null>(null)
  
  // Main content hook for state and utilities
  const {
    gridRef,
    containerRef,
    selectedIds,
    setSelectedIds,
    draggingIds,
    setDraggingIds,
    resizingId,
    setResizingId,
    dragOffset,
    setDragOffset,
    resizeStart,
    setResizeStart,
    imageDimensions,
    isPanning,
    setIsPanning,
    panStart,
    setPanStart,
    panOffset,
    setPanOffset,
    selectedDrawingIds,
    setSelectedDrawingIds,
    statusModal,
    setStatusModal,
    isDrawing,
    setIsDrawing,
    currentPath,
    setCurrentPath,
    generateUniqueId,
    adjustImageSize,
    snapToGrid,
    updateItemPosition,
    updateItemSize,
  } = useMainContent({
    backgroundImage,
    middleLayerImages,
    topLayerImages,
    gridSize,
    sceneScale,
    zoomLevel,
    setZoomLevel,
    currentSceneId,
    currentUserId,
    currentUserRole,
    onUpdateImages,
  })

  // Drag and drop functionality
  const {
    handleDrop,
    handleDragOver,
    handleItemDragStart,
    handleItemDrag,
    handleItemDragEnd,
  } = useDragAndDrop({
    gridRef,
    gridSize,
    zoomLevel,
    currentSceneId,
    currentUserId,
    currentUserRole,
    middleLayerImages,
    topLayerImages,
    selectedIds,
    setSelectedIds,
    draggingIds,
    setDraggingIds,
    dragOffset,
    setDragOffset,
    generateUniqueId,
    updateItemPosition,
    onUpdateImages,
    onPlayerPlaceToken,
    onPlayerUpdateTokenPosition,
  })

  // Drawing functionality
  const {
    startDrawing,
    draw,
    endDrawing,
    handleMouseLeave,
    handleDrawingClick,
  } = useDrawing({
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
    onDarknessChange: handleDarknessChange,
  })

  // Resize handlers
  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    if (currentUserRole === 'player') {
      toast({ title: "Permission Denied", description: "Players cannot resize map images.", variant: "destructive" });
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    setResizingId(item.id);
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      width: item.width || gridSize, 
      height: item.height || gridSize,
    });
  }, [gridSize, currentUserRole, setResizingId, setResizeStart]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingId || !resizeStart) return;
    const dx = (e.clientX - resizeStart.x) / zoomLevel;
    const dy = (e.clientY - resizeStart.y) / zoomLevel;
    const newWidth = Math.max(gridSize, Math.floor((resizeStart.width + dx) / gridSize) * gridSize);
    const newHeight = Math.max(gridSize, Math.floor((resizeStart.height + dy) / gridSize) * gridSize);
    const { middleLayer, topLayer } = updateItemSize(resizingId, newWidth, newHeight);
    onUpdateImages?.(middleLayer, topLayer);
  }, [resizingId, resizeStart, gridSize, updateItemSize, onUpdateImages, zoomLevel])

  const handleResizeEnd = useCallback(() => {
    setResizingId(null);
    setResizeStart(null);
    onUpdateImages?.(middleLayerImages, topLayerImages);
  }, [middleLayerImages, topLayerImages, onUpdateImages, setResizingId, setResizeStart])

  // Selection and interaction handlers
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const isClickingToken = target.classList.contains('token-image') || 
                           target.closest('.token-image') || 
                           target.closest('[draggable="true"]');
    
    // Don't clear selections if we just finished selecting or if clicking on a token or using brush
    if (!isClickingToken && currentTool !== 'brush' && !isSelecting) {
      setSelectedIds([]);
      setSelectedDrawingIds([]);
    }
  }, [currentTool, setSelectedIds, setSelectedDrawingIds, isSelecting]);

  const handleItemClick = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    e.stopPropagation();
    if (currentTool === 'brush') return;
    
    if (e.shiftKey) {
      setSelectedIds((prev) => 
        prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]
      );
    } else {
      setSelectedIds([item.id]);
    }
    setSelectedDrawingIds([]);
  }, [currentTool, setSelectedIds, setSelectedDrawingIds])

  // Token interaction handlers
  const handleTokenDoubleClick = useCallback((item: LayerImage) => {
    if (!item.character || !item.characterId) return;

    if (currentUserRole === 'DM') {
      onOpenCharacterSheet?.(item.character);
    } else if (currentUserRole === 'player') {
      if (item.character.userId === currentUserId) {
        onOpenCharacterSheet?.(item.character);
      } else {
        toast({ 
          title: "Permission Denied", 
          description: "You can only view details for your own characters.", 
          variant: "destructive" 
        });
      }
    } else {
      toast({ 
        title: "Permission Denied", 
        description: "You do not have permission to view character details.", 
        variant: "destructive" 
      });
    }
  }, [currentUserRole, currentUserId, onOpenCharacterSheet]);

  const handleStatusClick = useCallback((type: 'guard' | 'strength' | 'mp', character: any, characterId: number) => {
    setStatusModal({
      isOpen: true,
      type,
      currentValue: type === 'guard' ? character.Guard : 
                   type === 'strength' ? character.Strength : character.Mp,
      maxValue: type === 'guard' ? character.MaxGuard : 
                type === 'strength' ? character.MaxStrength : character.MaxMp,
      characterId,
      character
    });
  }, [setStatusModal]);

  // Status update handler
  const handleStatusUpdate = useCallback((value: number) => {
    if (!statusModal) return;
    const { type, characterId, character } = statusModal;
    
    const updatedCharacter = {
      Name: character.Name,
      Path: character.Path || (type === 'mp' ? "Magic User" : "Warrior"),
      Guard: type === 'guard' ? value : character.Guard || 0,
      MaxGuard: character.MaxGuard || 0,
      Strength: type === 'strength' ? value : character.Strength || 0,
      MaxStrength: character.MaxStrength || 0,
      Mp: type === 'mp' ? value : character.Mp || 0,
      MaxMp: character.MaxMp || 0
    };
    
    const updatedTopLayer = topLayerImages.map(item =>
      item.characterId === characterId ? { ...item, character: updatedCharacter } : item
    );
    
    onUpdateImages?.(middleLayerImages, updatedTopLayer);
    setStatusModal(null);
    
    fetch(`/api/characters/${characterId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        [type === 'guard' ? 'Guard' : type === 'strength' ? 'Strength' : 'Mp']: value,
        CharacterId: characterId
      }),
    }).catch(() => {
      const revertedTopLayer = topLayerImages.map(item =>
        item.characterId === characterId ? { ...item, character } : item
      );
      onUpdateImages?.(middleLayerImages, revertedTopLayer);
    });
  }, [statusModal, topLayerImages, middleLayerImages, onUpdateImages, setStatusModal]);

  // Prop resize handler
  const handleResizeProp = useCallback((propId: string, scale: number) => {
    const updatedTopLayer = topLayerImages.map(item => {
      if (item.id === propId) {
        const currentWidth = item.width || gridSize;
        const currentHeight = item.height || gridSize;
        const newWidth = Math.max(gridSize * 0.5, Math.floor(currentWidth * scale)); // Minimum 50% of grid size
        const newHeight = Math.max(gridSize * 0.5, Math.floor(currentHeight * scale)); // Minimum 50% of grid size
        return { ...item, width: newWidth, height: newHeight };
      }
      return item;
    });
    
    onUpdateImages?.(middleLayerImages, updatedTopLayer);
  }, [topLayerImages, middleLayerImages, gridSize, onUpdateImages]);

  // Reset darkness handler
  const handleResetDarkness = useCallback(() => {
    if (window.confirm('Are you sure you want to reset the darkness layer? This will remove all erased areas and make the entire layer dark again.')) {
      onDarknessChange?.([]);
    }
  }, [onDarknessChange]);

  // Auto-switch tool when darkness layer is toggled off
  useEffect(() => {
    if (!isDarknessLayerVisible && (currentTool === 'darknessEraser' || currentTool === 'darknessBrush')) {
      onToolChange('cursor');
    }
  }, [isDarknessLayerVisible, currentTool, onToolChange]);

  // Selection box handlers
  const handleSelectionStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return; // Only left mouse button
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    setIsSelecting(true);
    setSelectionStart({ x, y });
    setSelectionEnd({ x, y });
    e.preventDefault();
  }, [zoomLevel]);

  const handleSelectionMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    setSelectionEnd({ x, y });
    e.preventDefault();
  }, [isSelecting, selectionStart, zoomLevel]);

  const handleSelectionEnd = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (!isSelecting || !selectionStart || !selectionEnd) {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
      return;
    }

    // Calculate selection box bounds
    const minX = Math.min(selectionStart.x, selectionEnd.x);
    const maxX = Math.max(selectionStart.x, selectionEnd.x);
    const minY = Math.min(selectionStart.y, selectionEnd.y);
    const maxY = Math.max(selectionStart.y, selectionEnd.y);

    // Find items within selection box
    const selectedItemIds: string[] = [];
    const selectedDrawingIds: string[] = [];

    // Check middle layer images
    middleLayerImages.forEach(item => {
      const itemRight = item.x + (item.width || gridSize);
      const itemBottom = item.y + (item.height || gridSize);
      
      if (item.x < maxX && itemRight > minX && item.y < maxY && itemBottom > minY) {
        if (currentUserRole === 'DM') {
          selectedItemIds.push(item.id);
        }
      }
    });

    // Check top layer tokens
    topLayerImages.forEach(item => {
      const itemRight = item.x + (item.width || gridSize);
      const itemBottom = item.y + (item.height || gridSize);
      
      if (item.x < maxX && itemRight > minX && item.y < maxY && itemBottom > minY) {
        if (currentUserRole === 'DM' || (currentUserRole === 'player' && item.character?.userId === currentUserId)) {
          selectedItemIds.push(item.id);
        }
      }
    });

    // Check drawings
    drawings.forEach(drawing => {
      // For drawings, we need to check if any part of the drawing path intersects with selection box
      // For simplicity, let's check if the drawing's bounding box intersects
      if (drawing.path && drawing.path.length > 0) {
        // Parse SVG path data to extract coordinates
        // Path format: "M150,100 L160,105 L170,110" etc.
        const pathPoints: { x: number; y: number }[] = [];
        
        // Extract all coordinate pairs from the path
        const coordMatches = drawing.path.match(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g);
        if (coordMatches) {
          coordMatches.forEach(match => {
            const [x, y] = match.split(',').map(Number);
            if (!isNaN(x) && !isNaN(y)) {
              pathPoints.push({ x, y });
            }
          });
        }
        
        if (pathPoints.length > 0) {
          const drawingMinX = Math.min(...pathPoints.map(p => p.x));
          const drawingMaxX = Math.max(...pathPoints.map(p => p.x));
          const drawingMinY = Math.min(...pathPoints.map(p => p.y));
          const drawingMaxY = Math.max(...pathPoints.map(p => p.y));
          
          if (drawingMinX < maxX && drawingMaxX > minX && drawingMinY < maxY && drawingMaxY > minY) {
            if (currentUserRole === 'DM' || (currentUserRole === 'player' && drawing.createdBy === currentUserId)) {
              selectedDrawingIds.push(drawing.id);
            }
          }
        }
      }
    });

    // Update selections FIRST
    setSelectedIds(selectedItemIds);
    setSelectedDrawingIds(selectedDrawingIds);

    // Reset selection box AFTER a short delay to prevent handleGridClick from clearing
    setTimeout(() => {
      setIsSelecting(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }, 10);
    
    e?.preventDefault();
  }, [isSelecting, selectionStart, selectionEnd, middleLayerImages, topLayerImages, drawings, gridSize, currentUserRole, currentUserId, setSelectedIds, setSelectedDrawingIds]);

  // Navigation drag handlers (now for right mouse button when not drawing)
  const handleNavigationDragStart = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const isRightClick = e.button === 2;
    const isMiddleClick = e.button === 1;
    const isAltClick = e.button === 0 && e.altKey;
    
    if (isMiddleClick || isAltClick || isRightClick) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY });
      e.preventDefault();
    }
  }, [setIsPanning, setPanStart]);

  const handleNavigationDrag = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStart) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const containerEl = containerRef.current;
      if (containerEl) {
        containerEl.scrollLeft = panOffset.x - dx;
        containerEl.scrollTop = panOffset.y - dy;
      }
      e.preventDefault();
    }
  }, [isPanning, panStart, panOffset, containerRef]);

  const handleNavigationDragEnd = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      const containerEl = containerRef.current;
      if (containerEl) {
        setPanOffset({ x: containerEl.scrollLeft, y: containerEl.scrollTop });
      }
      setIsPanning(false);
      setPanStart(null);
      e?.preventDefault();
    }
  }, [isPanning, containerRef, setPanOffset, setIsPanning, setPanStart]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)));
    } else if (e.shiftKey) {
      e.preventDefault();
      const newSize = Math.min(200, Math.max(20, gridSize + (e.deltaY < 0 ? 5 : -5)));
      onGridSizeChange(newSize);
      const newMiddleLayer = snapToGrid(middleLayerImages, newSize);
      const newTopLayer = snapToGrid(topLayerImages, newSize);
      onUpdateImages?.(newMiddleLayer, newTopLayer);
    }
  }, [gridSize, middleLayerImages, topLayerImages, onUpdateImages, snapToGrid, onGridSizeChange, setZoomLevel])

  // Keyboard handlers
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIds.length === 1) {
      const id = selectedIds[0];
      const item = middleLayerImages.find((i) => i.id === id) || topLayerImages.find((i) => i.id === id);
      if (!item) return;
      
      let dx = 0;
      let dy = 0;
      switch (e.key) {
        case "ArrowUp": dy = -gridSize; break;
        case "ArrowDown": dy = gridSize; break;
        case "ArrowLeft": dx = -gridSize; break;
        case "ArrowRight": dx = gridSize; break;
        default: return;
      }
      
      const { middleLayer, topLayer } = updateItemPosition(id, dx, dy);
      onUpdateImages?.(middleLayer, topLayer);
    }
  }, [selectedIds, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages])

  // Delete functionality
  const handleDelete = useCallback((e: KeyboardEvent) => {
    if (e.key !== "Delete") return;
    
    if (selectedDrawingIds.length > 0) {
      const drawingsMap = new Map(drawings.map(d => [d.id, d]));
      const permissibleIdsToDelete: string[] = [];
      const nonPermissibleSelections: string[] = [];
      
      selectedDrawingIds.forEach(id => {
        const drawing = drawingsMap.get(id);
        if (drawing) {
          if (currentUserRole === 'DM' || (currentUserRole === 'player' && drawing.createdBy === currentUserId)) {
            permissibleIdsToDelete.push(id);
          } else { 
            nonPermissibleSelections.push(drawing.id); 
          }
        }
      });
      
      if (nonPermissibleSelections.length > 0) {
        toast({ 
          title: "Permission Denied", 
          description: `You cannot delete drawings you didn't create. (${nonPermissibleSelections.length} item(s))`, 
          variant: "destructive" 
        });
      }
      
      if (permissibleIdsToDelete.length > 0) {
        onDrawingsDelete(permissibleIdsToDelete);
      }
      
      setSelectedDrawingIds([]);
      setSelectedIds([]);
    } else if (selectedIds.length > 0) {
      let newMiddleLayer = [...middleLayerImages];
      let newTopLayer = [...topLayerImages];
      const playerTokensToDelete: string[] = [];
      const nonPermissibleTokens: string[] = [];

      selectedIds.forEach(id => {
        const token = topLayerImages.find(img => img.id === id);
        if (token) {
          if (currentUserRole === 'DM') {
            // DM can delete any token
          } else if (currentUserRole === 'player') {
            if (token.character?.userId === currentUserId) {
              playerTokensToDelete.push(id);
            } else {
              nonPermissibleTokens.push(id);
            }
          }
        } else {
          const middleImage = middleLayerImages.find(img => img.id === id);
          if (middleImage && currentUserRole !== 'DM') {
            nonPermissibleTokens.push(id);
          }
        }
      });

      if (nonPermissibleTokens.length > 0) {
        toast({ 
          title: "Permission Denied", 
          description: `You do not have permission to delete some selected items. (${nonPermissibleTokens.length} item(s))`, 
          variant: "destructive" 
        });
      }

      playerTokensToDelete.forEach(tokenId => {
        onPlayerRequestTokenDelete?.(tokenId);
      });

      if (currentUserRole === 'DM') {
        newMiddleLayer = middleLayerImages.filter((img) => !selectedIds.includes(img.id));
        newTopLayer = topLayerImages.filter((img) => !selectedIds.includes(img.id));
      } else if (currentUserRole === 'player') {
        newTopLayer = topLayerImages.filter((img) => !playerTokensToDelete.includes(img.id));
      }
      
      onUpdateImages?.(newMiddleLayer, newTopLayer);
      setSelectedIds([]);
    }
  }, [selectedIds, middleLayerImages, topLayerImages, onUpdateImages, selectedDrawingIds, drawings, currentUserRole, currentUserId, onDrawingsDelete, onPlayerRequestTokenDelete, setSelectedDrawingIds, setSelectedIds]);

  const handleDeleteAllDrawings = useCallback(() => {
    if (currentUserRole !== 'DM') {
      toast({ 
        title: "Permission Denied", 
        description: "Only DMs can delete all drawings.", 
        variant: "destructive" 
      });
      return;
    }
    
    if (drawings && drawings.length > 0) {
      if (window.confirm(`Are you sure you want to delete all ${drawings.length} drawings on this scene? This cannot be undone.`)) {
        const allDrawingIds = drawings.map(d => d.id);
        onDrawingsDelete(allDrawingIds);
        toast({ 
          title: "Drawings Cleared", 
          description: "All drawings on the scene have been queued for deletion." 
        });
      }
    } else {
      toast({ 
        title: "No Drawings", 
        description: "There are no drawings on the scene to delete." 
      });
    }
  }, [drawings, currentUserRole, onDrawingsDelete]);

  // Zoom controls
  const handleZoomIn = useCallback(() => setZoomLevel(prev => Math.min(prev + 0.1, 3)), [setZoomLevel])
  const handleZoomOut = useCallback(() => setZoomLevel(prev => Math.max(prev - 0.1, 0.5)), [setZoomLevel])
  const handleZoomReset = useCallback(() => {
    setZoomLevel(1);
    setPanOffset({ x: 0, y: 0 });
    // Also reset the actual scroll position of the container
    if (containerRef.current) {
      containerRef.current.scrollLeft = 0;
      containerRef.current.scrollTop = 0;
    }
  }, [setZoomLevel, setPanOffset, containerRef]);

  // Event listeners
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      handleDelete(e);
      handleKeyDown(e);
    }
    
    const handleGlobalMouseUp = () => {
      handleNavigationDragEnd();
    }
    
    window.addEventListener("mousemove", handleResizeMove);
    window.addEventListener("mouseup", handleResizeEnd);
    window.addEventListener("keydown", handleGlobalKeyDown);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [handleResizeMove, handleResizeEnd, handleDelete, handleKeyDown, handleNavigationDragEnd])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div 
        ref={containerRef}
        className="flex-grow relative overflow-auto"
        style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect: 'none' }}
        onWheel={handleWheel}
        onMouseDown={handleNavigationDragStart}
        onMouseMove={handleNavigationDrag}
        onMouseUp={handleNavigationDragEnd}
        onMouseLeave={handleNavigationDragEnd}
      >
        <div className="absolute top-2 left-2 z-30">
          <DrawingToolbar
            currentTool={currentTool}
            onToolChange={onToolChange}
            currentColor={currentColor}
            onColorChange={onColorChange}
            gridColor={gridColor}
            onGridColorChange={onGridColorChange}
            currentUserRole={currentUserRole}
            onDeleteAllDrawings={handleDeleteAllDrawings}
            isDarknessLayerVisible={isDarknessLayerVisible}
            onToggleDarknessLayer={onToggleDarknessLayer}
            onResetDarkness={handleResetDarkness}
          />
          <ZoomControls
            zoomLevel={zoomLevel}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onZoomReset={handleZoomReset}
          />
        </div>

        <GameGrid
          gridRef={gridRef}
          backgroundImage={backgroundImage}
          imageDimensions={imageDimensions}
          zoomLevel={zoomLevel}
          currentTool={currentTool}
          gridSize={gridSize}
          gridColor={gridColor}
          middleLayerImages={middleLayerImages}
          topLayerImages={topLayerImages}
          selectedIds={selectedIds}
          selectedDrawingIds={selectedDrawingIds}
          drawings={drawings}
          isDrawing={isDrawing}
          currentPath={currentPath}
          currentColor={currentColor}
          resizingId={resizingId}
          darknessPaths={darknessPaths}
          isDarknessLayerVisible={isDarknessLayerVisible}
          currentUserRole={currentUserRole}
          isSelecting={isSelecting}
          selectionStart={selectionStart}
          selectionEnd={selectionEnd}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onGridClick={handleGridClick}
          onMouseDown={(e) => {
            const isDrawingTool = currentTool === 'brush' || currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
            if (isDrawingTool) {
              startDrawing(e);
              e.stopPropagation();
            } else if (e.button === 0) {
              // Left mouse button - check if clicking on a selectable item
              const target = e.target as HTMLElement;
              const isClickingSelectableItem = target.classList.contains('token-image') || 
                                             target.closest('.token-image') || 
                                             target.closest('[draggable="true"]') ||
                                             target.closest('path'); // SVG drawing paths
              
              if (!isClickingSelectableItem) {
                // Only start selection if clicking on empty space
                handleSelectionStart(e);
              }
            } else {
              // Right mouse button - navigation when not drawing
              handleNavigationDragStart(e);
            }
          }}
          onMouseMove={(e) => {
            const isDrawingTool = currentTool === 'brush' || currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
            if (isDrawing && isDrawingTool) {
              draw(e);
              e.stopPropagation();
            } else if (isSelecting && selectionStart) {
              // Selection box drag - only when we're actually in selection mode
              handleSelectionMove(e);
              e.stopPropagation(); // Prevent interference with item dragging
            } else if (isPanning && panStart) {
              // Navigation drag
              handleNavigationDrag(e);
            }
          }}
          onMouseUp={(e) => {
            const isDrawingTool = currentTool === 'brush' || currentTool === 'darknessEraser' || currentTool === 'darknessBrush';
            if (isDrawing && isDrawingTool) {
              endDrawing(e);
              e.stopPropagation();
            } else if (isSelecting) {
              // End selection
              handleSelectionEnd(e);
            } else {
              // End navigation
              handleNavigationDragEnd(e);
            }
          }}
          onMouseLeave={(e) => {
            if (isDrawing) {
              endDrawing(e);
            } else if (isSelecting) {
              handleSelectionEnd(e);
            }
            handleNavigationDragEnd(e);
          }}
          onContextMenu={(e) => e.preventDefault()} // Prevent right-click context menu
          onItemDragStart={handleItemDragStart}
          onItemDrag={handleItemDrag}
          onItemDragEnd={handleItemDragEnd}
          onItemClick={handleItemClick}
          onResizeStart={handleResizeStart}
          onDrawingClick={handleDrawingClick}
          onTokenDoubleClick={handleTokenDoubleClick}
          onStatusClick={handleStatusClick}
          onDarknessChange={handleDarknessChange}
          onResizeProp={handleResizeProp}
        />
      </div>
      
      <StatusModal
        statusModal={statusModal}
        onClose={() => setStatusModal(null)}
        onUpdate={handleStatusUpdate}
        onValueChange={(value) => setStatusModal(prev => prev ? { ...prev, currentValue: value } : null)}
      />
    </div>
  )
}

