"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getUserFromCookie } from "@/lib/auth"
import type { LayerImage } from "../types/layerImage"
import DrawingToolbar from "./DrawingToolbar"

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
  currentTool: 'brush' | 'cursor'
  onToolChange: (tool: 'brush' | 'cursor') => void
  currentColor: string
  onColorChange: (color: string) => void
  sceneScale: number
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
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
}: MainContentProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const IMAGE_MAX_SIZE = 1200
  const IMAGE_MIN_SIZE = 50
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: 'guard' | 'strength' | 'mp';
    currentValue: number;
    maxValue: number;
    characterId: number;
    character: any;
  } | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  
  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<string>("")
  const [drawings, setDrawings] = useState<Array<{id: string, path: string, color: string, sceneId: string, createdBy: number, createdAt: string}>>([])
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])
  const [userId, setUserId] = useState<number | null>(null)
  const [sceneId, setSceneId] = useState<string | null>(null)
  const [isLoadingDrawings, setIsLoadingDrawings] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUserFromCookie()
      setUserRole(user?.role || null)
      setUserId(user?.id || null)
    }
    fetchUser()
  }, [])

  useEffect(() => {
    if (backgroundImage) {
      const match = backgroundImage.match(/\/api\/images\/([^\/]+)/)
      if (match && match[1]) {
        const newSceneId = match[1];
        
        // Only update if scene has changed
        if (newSceneId !== sceneId) {
          console.log(`Switching from scene ${sceneId} to ${newSceneId}`);
          
          // Clear drawing state
          setCurrentPath('');
          setIsDrawing(false);
          setSelectedDrawingIds([]);
          
          // Set new scene ID
          setSceneId(newSceneId);
        }
      }
    } else {
      // Clear all drawing state when no scene is loaded
      setDrawings([]);
      setCurrentPath('');
      setIsDrawing(false);
      setSelectedDrawingIds([]);
      setSceneId(null);
    }
  }, [backgroundImage, sceneId])

  useEffect(() => {
    if (backgroundImage) {
      const img = new window.Image()
      img.src = backgroundImage
      img.onload = () => {
        // Apply scale to image dimensions
        const scaledWidth = Math.round(img.width * sceneScale);
        const scaledHeight = Math.round(img.height * sceneScale);
        setImageDimensions({ width: scaledWidth, height: scaledHeight })
      }
    } else {
      setImageDimensions(null)
    }
  }, [backgroundImage, sceneScale])

  useEffect(() => {
    const savedZoom = localStorage.getItem('dmScreenZoomLevel')
    if (savedZoom) {
      setZoomLevel(parseFloat(savedZoom))
    }
  }, [setZoomLevel])

  useEffect(() => {
    localStorage.setItem('dmScreenZoomLevel', zoomLevel.toString())
  }, [zoomLevel])

  const generateUniqueId = useCallback((baseId: string) => `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, [])

  const adjustImageSize = useCallback((width: number, height: number): { width: number; height: number } => {
    let newWidth = width
    let newHeight = height
    const aspectRatio = width / height

    if (width > IMAGE_MAX_SIZE || height > IMAGE_MAX_SIZE) {
      if (width > height) {
        newWidth = IMAGE_MAX_SIZE
        newHeight = Math.round(IMAGE_MAX_SIZE / aspectRatio)
      } else {
        newHeight = IMAGE_MAX_SIZE
        newWidth = Math.round(IMAGE_MAX_SIZE * aspectRatio)
      }
    }

    if (newWidth < IMAGE_MIN_SIZE || newHeight < IMAGE_MIN_SIZE) {
      if (newWidth < newHeight) {
        newWidth = IMAGE_MIN_SIZE
        newHeight = Math.round(IMAGE_MIN_SIZE / aspectRatio)
      } else {
        newHeight = IMAGE_MIN_SIZE
        newWidth = Math.round(IMAGE_MIN_SIZE * aspectRatio)
      }
    }

    return { width: newWidth, height: newHeight }
  }, [])

  const snapToGrid = useCallback((layer: LayerImage[], newGridSize: number) => {
    return layer.map((item) => ({
      ...item,
      x: Math.floor(item.x / newGridSize) * newGridSize,
      y: Math.floor(item.y / newGridSize) * newGridSize,
      ...(item.width === gridSize && item.height === gridSize ? { width: newGridSize, height: newGridSize } : {}),
    }))
  }, [gridSize])

  const updateItemPosition = useCallback((id: string, dx: number, dy: number) => {
    const updateLayer = (layer: LayerImage[]) =>
      layer.map((item) =>
        draggingIds?.includes(item.id)
          ? { ...item, x: Math.floor((item.x + dx) / gridSize) * gridSize, y: Math.floor((item.y + dy) / gridSize) * gridSize }
          : item
      )
    const newMiddleLayer = updateLayer(middleLayerImages)
    const newTopLayer = updateLayer(topLayerImages)
    return { middleLayer: newMiddleLayer, topLayer: newTopLayer }
  }, [draggingIds, gridSize, middleLayerImages, topLayerImages])

  const updateItemSize = useCallback((id: string, width: number, height: number) => {
    const updateLayer = (layer: LayerImage[]) =>
      layer.map((item) => (item.id === id ? { ...item, width, height } : item))
    const newMiddleLayer = updateLayer(middleLayerImages)
    return { middleLayer: newMiddleLayer, topLayer: topLayerImages }
  }, [middleLayerImages, topLayerImages])

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData("imageId")
    const category = e.dataTransfer.getData("category")
    const url = e.dataTransfer.getData("url")
    const characterId = e.dataTransfer.getData("characterId")
    const characterData = e.dataTransfer.getData("character")
    
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    // Adjust for zoom level when calculating position
    const adjustedX = (e.clientX - rect.left) / zoomLevel
    const adjustedY = (e.clientY - rect.top) / zoomLevel

    const x = Math.floor(adjustedX / gridSize) * gridSize
    const y = Math.floor(adjustedY / gridSize) * gridSize

    const image = new window.Image()
    image.src = url
    await new Promise((resolve) => {
      image.onload = resolve
    })

    const uniqueId = generateUniqueId(imageId)
    const imageData: LayerImage = { id: uniqueId, url: url || "", x, y }
    if (category === "Image") {
      // Keep original size for scene images
      imageData.width = image.width
      imageData.height = image.height
    } else if (category === "Token") {
      imageData.width = gridSize
      imageData.height = gridSize
      if (characterId && characterData) {
        try {
          const parsedCharacter = JSON.parse(characterData)
          imageData.characterId = parseInt(characterId)
          imageData.character = {
            Name: parsedCharacter.Name,
            Path: parsedCharacter.Path,
            Guard: parsedCharacter.Guard ?? 0,
            MaxGuard: parsedCharacter.MaxGuard ?? 0,
            Strength: parsedCharacter.Strength ?? 0,
            MaxStrength: parsedCharacter.MaxStrength ?? 0,
            Mp: parsedCharacter.Mp ?? 0,
            MaxMp: parsedCharacter.MaxMp ?? 0
          }
        } catch (error) {
          console.error('MainContent - Error parsing character data:', error);
        }
      }
    }
    if (category === "Image") {
      onUpdateImages?.([...middleLayerImages, imageData], topLayerImages)
    } else if (category === "Token") {
      onUpdateImages?.(middleLayerImages, [...topLayerImages, imageData])
    }
  }, [gridSize, adjustImageSize, generateUniqueId, middleLayerImages, topLayerImages, onUpdateImages, zoomLevel])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  const handleItemDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    let dragIds = selectedIds
    if (selectedIds.length === 0) {
      // If nothing is selected, select this item and start dragging it immediately
      setSelectedIds([item.id])
      dragIds = [item.id]
    } else if (!selectedIds.includes(item.id)) {
      // If something is selected but not this item, don't drag
      return
    }
    setDraggingIds(dragIds)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: (e.clientX - rect.left),
      y: (e.clientY - rect.top),
    })
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (ctx) {
      canvas.width = item.width || gridSize
      canvas.height = item.height || gridSize
      const img = new window.Image()
      img.src = item.url
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2)
      }
    }
  }, [selectedIds, gridSize])

  const handleItemDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingIds || !dragOffset || e.clientX === 0 || e.clientY === 0) return
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const referenceItem = middleLayerImages.find((i) => i.id === draggingIds[0]) || topLayerImages.find((i) => i.id === draggingIds[0])
    if (!referenceItem) return

    // Adjust for zoom level when calculating position
    const adjustedX = (e.clientX - rect.left) / zoomLevel
    const adjustedY = (e.clientY - rect.top) / zoomLevel
    
    const newX = Math.floor((adjustedX - dragOffset.x / zoomLevel) / gridSize) * gridSize
    const newY = Math.floor((adjustedY - dragOffset.y / zoomLevel) / gridSize) * gridSize
    
    const dx = newX - referenceItem.x
    const dy = newY - referenceItem.y

    const { middleLayer, topLayer } = updateItemPosition(referenceItem.id, dx, dy)
    onUpdateImages?.(middleLayer, topLayer)
  }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages, zoomLevel])

  const handleItemDragEnd = useCallback(() => {
    setDraggingIds(null)
    setDragOffset(null)
    onUpdateImages?.(middleLayerImages, topLayerImages)
  }, [middleLayerImages, topLayerImages, onUpdateImages])

  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    e.preventDefault()
    e.stopPropagation()
    setResizingId(item.id)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: item.width || gridSize,
      height: item.height || gridSize,
    })
  }, [gridSize])

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!resizingId || !resizeStart) return
    
    // Adjust for zoom level when calculating resize
    const dx = (e.clientX - resizeStart.x) / zoomLevel
    const dy = (e.clientY - resizeStart.y) / zoomLevel
    
    const newWidth = Math.max(gridSize, Math.floor((resizeStart.width + dx) / gridSize) * gridSize)
    const newHeight = Math.max(gridSize, Math.floor((resizeStart.height + dy) / gridSize) * gridSize)

    const { middleLayer, topLayer } = updateItemSize(resizingId, newWidth, newHeight)
    onUpdateImages?.(middleLayer, topLayer)
  }, [resizingId, resizeStart, gridSize, updateItemSize, onUpdateImages, zoomLevel])

  const handleResizeEnd = useCallback(() => {
    setResizingId(null)
    setResizeStart(null)
    onUpdateImages?.(middleLayerImages, topLayerImages)
  }, [middleLayerImages, topLayerImages, onUpdateImages])

  const handleDelete = useCallback((e: KeyboardEvent) => {
    if (e.key === "Delete" && selectedIds.length > 0) {
      const newMiddleLayer = middleLayerImages.filter((img) => !selectedIds.includes(img.id))
      const newTopLayer = topLayerImages.filter((img) => !selectedIds.includes(img.id))
      onUpdateImages?.(newMiddleLayer, newTopLayer)
      setSelectedIds([])
    }
    if (e.key === "Delete" && selectedDrawingIds.length > 0) {
      // Update local state for immediate UI response
      const newDrawings = drawings.filter((drawing) => !selectedDrawingIds.includes(drawing.id))
      setDrawings(newDrawings)
      
      // Delete drawings from the database
      selectedDrawingIds.forEach(id => {
        fetch(`/api/drawings?id=${id}`, {
          method: 'DELETE',
        }).catch(error => {
          console.error('Error deleting drawing:', error);
        });
      });
      
      // Clear selection
      setSelectedDrawingIds([])
    }
  }, [selectedIds, middleLayerImages, topLayerImages, onUpdateImages, selectedDrawingIds, drawings])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Check if we're clicking on the background and not on a token or image
    const target = e.target as HTMLElement;
    const isClickingToken = target.classList.contains('token-image') || 
                           target.closest('.token-image') ||
                           target.closest('[draggable="true"]');
    
    if (!isClickingToken && currentTool !== 'brush') {
      setSelectedIds([]);
      setSelectedDrawingIds([]);
    }
  }, [currentTool]);

  const handleItemClick = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    e.stopPropagation()
    if (currentTool === 'brush') return;
    
    if (e.shiftKey) {
      setSelectedIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])
    } else {
      setSelectedIds([item.id])
    }
  }, [currentTool])

  const handleDrawingClick = useCallback((e: React.MouseEvent<SVGPathElement>, drawing: {id: string, path: string, color: string, sceneId: string, createdBy: number, createdAt: string}) => {
    e.stopPropagation()
    if (currentTool === 'brush') return;
    
    if (e.shiftKey) {
      setSelectedDrawingIds((prev) => prev.includes(drawing.id) ? prev.filter((id) => id !== drawing.id) : [...prev, drawing.id])
    } else {
      setSelectedDrawingIds([drawing.id])
    }
  }, [currentTool])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta)))
    } else if (e.shiftKey && userRole === "DM") {
      e.preventDefault()
      const newSize = Math.min(200, Math.max(20, gridSize + (e.deltaY < 0 ? 5 : -5)))
      onGridSizeChange(newSize)
      const newMiddleLayer = snapToGrid(middleLayerImages, newSize)
      const newTopLayer = snapToGrid(topLayerImages, newSize)
      onUpdateImages?.(newMiddleLayer, newTopLayer)
    }
  }, [userRole, gridSize, middleLayerImages, topLayerImages, onUpdateImages, snapToGrid, onGridSizeChange])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (selectedIds.length === 1) {
      const id = selectedIds[0]
      const item = middleLayerImages.find((i) => i.id === id) || topLayerImages.find((i) => i.id === id)
      if (!item) return

      let dx = 0
      let dy = 0
      switch (e.key) {
        case "ArrowUp":
          dy = -gridSize
          break
        case "ArrowDown":
          dy = gridSize
          break
        case "ArrowLeft":
          dx = -gridSize
          break
        case "ArrowRight":
          dx = gridSize
          break
        default:
          return
      }
      const { middleLayer, topLayer } = updateItemPosition(id, dx, dy)
      onUpdateImages?.(middleLayer, topLayer)
    }
  }, [selectedIds, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages])

  const handleColorChange = useCallback((color: string) => {
    onGridColorChange(color === "hidden" ? "transparent" : color === "gray" ? "rgba(0,0,0,0.1)" : color)
    setShowColorMenu(false)
  }, [onGridColorChange])

  const handleStatusUpdate = (value: number) => {
    if (!statusModal) return;
    
    const { type, characterId, character } = statusModal;

    // Create the updated character with the new value first
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

    // Immediately update the UI
    const updatedTopLayer = topLayerImages.map(item => {
      if (item.characterId === characterId) {
        return {
          ...item,
          character: updatedCharacter
        };
      }
      return item;
    });

    // Force a state update with the new data
    onUpdateImages?.(middleLayerImages, updatedTopLayer);
    setStatusModal(null);

    // Update the database asynchronously
    fetch(`/api/characters/${characterId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        [type === 'guard' ? 'Guard' : type === 'strength' ? 'Strength' : 'Mp']: value,
        CharacterId: characterId
      }),
    }).catch(() => {
      // If the database update fails, revert the UI change
      const revertedTopLayer = topLayerImages.map(item => 
        item.characterId === characterId
          ? { ...item, character }
          : item
      );
      onUpdateImages?.(middleLayerImages, revertedTopLayer);
    });
  };

  const handleNavigationDragStart = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    // Only start panning on middle mouse button or Alt+left click
    // OR when using cursor tool with left click (not on a token)
    if (e) {
      const isAltClick = e.button === 0 && e.altKey;
      const isMiddleClick = e.button === 1;
      const isLeftClickWithCursor = e.button === 0 && currentTool === 'cursor';
      
      if (isMiddleClick || isAltClick || isLeftClickWithCursor) {
        // Check if we're clicking on a token or image when using cursor tool
        if (isLeftClickWithCursor) {
          const target = e.target as HTMLElement;
          const isClickingToken = target.classList.contains('token-image') || 
                                target.closest('.token-image') ||
                                target.closest('[draggable="true"]');
          
          // Don't start panning if clicking on a token
          if (isClickingToken) {
            return;
          }
        }
        
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
        e.preventDefault();
      }
    }
  }, [currentTool]);

  const handleNavigationDrag = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning && panStart && e) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      
      const containerEl = containerRef.current;
      if (containerEl) {
        // Update scroll position based on mouse movement
        containerEl.scrollLeft = panOffset.x - dx;
        containerEl.scrollTop = panOffset.y - dy;
      }
      
      e.preventDefault();
    }
  }, [isPanning, panStart, panOffset]);

  const handleNavigationDragEnd = useCallback((e?: React.MouseEvent<HTMLDivElement>) => {
    if (isPanning) {
      const containerEl = containerRef.current;
      if (containerEl) {
        setPanOffset({
          x: containerEl.scrollLeft,
          y: containerEl.scrollTop
        });
      }
      
      setIsPanning(false);
      setPanStart(null);
      e?.preventDefault();
    }
  }, [isPanning]);

  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(prev + 0.1, 3)) // Max zoom: 3x
  }, [setZoomLevel])

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5)) // Min zoom: 0.5x
  }, [setZoomLevel])

  const handleZoomReset = useCallback(() => {
    setZoomLevel(1) // Reset to 1x zoom
    setPanOffset({ x: 0, y: 0 }) // Reset pan offset
  }, [setZoomLevel])

  // Drawing handlers
  const startDrawing = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (currentTool !== 'brush') return;
    
    // Prevent drawing from starting if we're panning
    if (e.button !== 0 || e.altKey) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Adjust for zoom level when calculating position
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    setIsDrawing(true);
    setCurrentPath(`M${x},${y}`);
    
    // Prevent default to avoid text selection
    e.preventDefault();
  }, [currentTool, zoomLevel]);
  
  const draw = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || currentTool !== 'brush') return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    // Adjust for zoom level when calculating position
    const x = (e.clientX - rect.left) / zoomLevel;
    const y = (e.clientY - rect.top) / zoomLevel;
    
    setCurrentPath(prev => `${prev} L${x},${y}`);
    
    // Prevent default to avoid text selection
    e.preventDefault();
  }, [isDrawing, currentTool, zoomLevel]);
  
  const endDrawing = useCallback((e?: React.MouseEvent<any>) => {
    if (!isDrawing || !currentPath || currentTool !== 'brush') return;
    
    // Prevent default to avoid text selection
    e?.preventDefault();
    
    // Don't save if no scene is selected
    if (!sceneId) {
      setIsDrawing(false);
      setCurrentPath('');
      return;
    }
    
    // Generate a unique ID for the drawing
    const drawingId = `drawing-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create the new drawing object
    const newDrawing = {
      id: drawingId,
      path: currentPath,
      color: currentColor,
      sceneId: sceneId,
      createdBy: userId || 0,
      createdAt: new Date().toISOString()
    };
    
    // Update local state with the new drawing
    setDrawings(prevDrawings => [...prevDrawings, newDrawing]);
    
    // Reset drawing state
    setIsDrawing(false);
    setCurrentPath('');
    
    // Save the drawing to the database
    fetch('/api/drawings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newDrawing),
    }).catch((error) => {
      console.error('Error saving drawing:', error);
    });
  }, [isDrawing, currentPath, currentTool, currentColor, sceneId, userId]);
  
  const handleMouseLeave = useCallback(() => {
    if (isDrawing) {
      endDrawing();
    }
  }, [isDrawing, endDrawing]);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      handleDelete(e)
      handleKeyDown(e)
    }
    window.addEventListener("mousemove", handleResizeMove)
    window.addEventListener("mouseup", handleResizeEnd)
    window.addEventListener("keydown", handleGlobalKeyDown)
    
    // Add global mouse up handler for navigation
    const handleGlobalMouseUp = () => {
      handleNavigationDragEnd()
    }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    
    return () => {
      window.removeEventListener("mousemove", handleResizeMove)
      window.removeEventListener("mouseup", handleResizeEnd)
      window.removeEventListener("keydown", handleGlobalKeyDown)
      window.removeEventListener("mouseup", handleGlobalMouseUp)
    }
  }, [handleResizeMove, handleResizeEnd, handleDelete, handleKeyDown, handleNavigationDragEnd])

  useEffect(() => {
    if (sceneId) {
      setIsLoadingDrawings(true);
      fetch(`/api/drawings?sceneId=${sceneId}`)
        .then(response => response.json())
        .then(data => {
          setDrawings(data);
          setIsLoadingDrawings(false);
        })
        .catch(error => {
          console.error('Error loading drawings:', error);
          setIsLoadingDrawings(false);
        });
    } else {
      setDrawings([]);
    }
  }, [sceneId]);

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div 
        ref={containerRef}
        className="flex-grow relative overflow-auto"
        style={{ 
          cursor: isPanning ? 'grabbing' : 'grab',
          userSelect: 'none' // Prevent text selection during dragging
        }}
        onWheel={handleWheel}
        onMouseDown={handleNavigationDragStart}
        onMouseMove={handleNavigationDrag}
        onMouseUp={handleNavigationDragEnd}
        onMouseLeave={handleNavigationDragEnd}
      >
        {userRole === "DM" && (
          <div className="absolute top-2 left-2 z-30" style={{ 
            position: 'sticky',
            transform: 'none'
          }}>
            <DrawingToolbar
              currentTool={currentTool}
              onToolChange={onToolChange}
              currentColor={currentColor}
              onColorChange={onColorChange}
              gridColor={gridColor}
              onGridColorChange={onGridColorChange}
            />
                    <div className="flex items-center space-x-2">
          <button 
            onClick={handleZoomOut}
            className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full"
            title="Zoom Out"
          >
            <span className="text-sm">−</span>
          </button>
          <div className="text-xs font-medium w-12 text-center bg-white rounded">
            {Math.round(zoomLevel * 100)}%
          </div>
          <button 
            onClick={handleZoomIn}
            className="w-6 h-6 flex items-center justify-center bg-gray-200 hover:bg-gray-300 rounded-full"
            title="Zoom In"
          >
            <span className="text-sm">+</span>
          </button>
          <button 
            onClick={handleZoomReset}
            className="ml-1 px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
            title="Reset Zoom"
          >
            Reset
          </button>
        </div>
          </div>
        )}
        <div
          ref={gridRef}
          className="relative"
          style={{
            cursor: currentTool === "brush" ? "crosshair" : "default",
            transform: `scale(${zoomLevel})`,
            transformOrigin: "0 0",
            width: imageDimensions?.width || "100%",
            height: imageDimensions?.height || "100%",
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
              backgroundSize: "contain",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "center",
              width: "100%",
              height: "100%",
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleGridClick}
            onMouseDown={(e) => {
              if (currentTool === 'brush') {
                startDrawing(e);
                // Prevent navigation drag when using brush tool
                e.stopPropagation();
              } else {
                handleNavigationDragStart(e);
              }
            }}
            onMouseMove={(e) => {
              if (isDrawing && currentTool === 'brush') {
                draw(e);
                // Prevent navigation drag when drawing
                e.stopPropagation();
              } else {
                handleNavigationDrag(e);
              }
            }}
            onMouseUp={(e) => {
              if (isDrawing && currentTool === 'brush') {
                endDrawing(e);
                // Prevent navigation drag end when finishing drawing
                e.stopPropagation();
              } else {
                handleNavigationDragEnd(e);
              }
            }}
            onMouseLeave={(e) => {
              if (isDrawing) {
                endDrawing(e);
              }
              handleNavigationDragEnd(e);
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                width: "100%",
                height: "100%",
              }}
            />
            {middleLayerImages.map((img) => (
              <div
                key={img.id}
                className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
                style={{ left: img.x, top: img.y, zIndex: 10 }}
                draggable={true}
                onDragStart={(e) => handleItemDragStart(e, img, false)}
                onDrag={(e) => handleItemDrag(e)}
                onDragEnd={handleItemDragEnd}
                onClick={(e) => handleItemClick(e, img)}
              >
                <Image
                  src={img.url}
                  alt="Middle layer image"
                  width={img.width || gridSize * 2}
                  height={img.height || gridSize * 2}
                  style={{ objectFit: 'contain' }}
                />
                <div
                  className="absolute bottom-0 right-0 w-4 h-4 bg-gray-500 cursor-se-resize"
                  onMouseDown={(e) => handleResizeStart(e, img)}
                />
              </div>
            ))}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
              {drawings.map((drawing) => (
                <path
                  key={drawing.id}
                  d={drawing.path}
                  stroke={selectedDrawingIds.includes(drawing.id) ? "blue" : drawing.color}
                  strokeWidth={selectedDrawingIds.includes(drawing.id) ? "5" : "3"}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  onClick={(e) => handleDrawingClick(e, drawing)}
                  className={`${currentTool === 'cursor' ? 'cursor-pointer' : ''}`}
                  style={{ pointerEvents: currentTool === 'cursor' ? 'auto' : 'none' }}
                />
              ))}
              {isDrawing && currentPath && (
                <path
                  d={currentPath}
                  stroke={currentColor}
                  strokeWidth="3"
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </svg>
            {topLayerImages.map((img) => (
              <div
                key={img.id}
                className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
                style={{ left: img.x, top: img.y, zIndex: 30 }}
                draggable={true}
                onDragStart={(e) => handleItemDragStart(e, img, true)}
                onDrag={(e) => handleItemDrag(e)}
                onDragEnd={handleItemDragEnd}
                onClick={(e) => handleItemClick(e, img)}
              >
                <div className="relative">
                  <Image
                    src={img.url}
                    alt="Token"
                    width={gridSize}
                    height={gridSize}
                    style={{ objectFit: 'contain' }}
                    className="token-image"
                  />
                  {selectedIds.includes(img.id) && img.character && (
                    <div 
                      className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap"
                      style={{ zIndex: 30 }}
                    >
                      <span className="text-sm font-semibold text-black" style={{ 
                        textShadow: `
                          -1px -1px 0 white,
                          1px -1px 0 white,
                          -1px 1px 0 white,
                          1px 1px 0 white
                        `
                      }}>
                        {img.character.Name}
                      </span>
                    </div>
                  )}
                </div>
                {(() => {
                  if (!selectedIds.includes(img.id) || !img.character) return null;
                  
                  const character = img.character;
                  return (
                    <div className="status-circles-container absolute -top-12 left-0 right-0 flex justify-center space-x-3" style={{ zIndex: 50 }}>
                      {/* Guard Circle */}
                      <div className="status-circle guard-circle relative bg-white rounded-full p-1">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center text-sm cursor-pointer hover:bg-green-50"
                          onClick={() => setStatusModal({
                            isOpen: true,
                            type: 'guard',
                            currentValue: character.Guard,
                            maxValue: character.MaxGuard,
                            characterId: img.characterId!,
                            character
                          })}
                        >
                          {character.Guard}/{character.MaxGuard}
                        </div>
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                          Gd
                        </div>
                      </div>
                      {/* Strength Circle */}
                      <div className="status-circle strength-circle relative bg-white rounded-full p-1">
                        <div 
                          className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-sm cursor-pointer hover:bg-red-50"
                          onClick={() => setStatusModal({
                            isOpen: true,
                            type: 'strength',
                            currentValue: character.Strength,
                            maxValue: character.MaxStrength,
                            characterId: img.characterId!,
                            character
                          })}
                        >
                          {character.Strength}/{character.MaxStrength}
                        </div>
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                          Str
                        </div>
                      </div>
                      {/* MP Circle (only for Magic Users) */}
                      {character.Path === "Magic User" && (
                        <div className="status-circle mp-circle relative bg-white rounded-full p-1">
                          <div 
                            className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-sm cursor-pointer hover:bg-blue-50"
                            onClick={() => setStatusModal({
                              isOpen: true,
                              type: 'mp',
                              currentValue: character.Mp,
                              maxValue: character.MaxMp,
                              characterId: img.characterId!,
                              character
                            })}
                          >
                            {character.Mp}/{character.MaxMp}
                          </div>
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">
                            Mp
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      </div>
      {statusModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]"
          onClick={() => setStatusModal(null)}
        >
          <div 
            className="bg-white p-6 rounded-lg shadow-lg z-[101]"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">
              Update {statusModal.type === 'guard' ? 'Guard' : statusModal.type === 'strength' ? 'Strength' : 'MP'}
            </h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min="0"
                  value={statusModal.currentValue === 0 ? '' : statusModal.currentValue}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseInt(e.target.value);
                    setStatusModal(prev => prev ? { ...prev, currentValue: value === '' ? 0 : value } : null);
                  }}
                  className="w-24 px-2 py-1 border rounded"
                  autoFocus
                />
                <span>/ {statusModal.maxValue}</span>
              </div>
              <div className="flex justify-end">
                <Button 
                  onClick={() => handleStatusUpdate(statusModal.currentValue)}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      </div>
  )
}