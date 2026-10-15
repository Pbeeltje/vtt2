import { useRef, useState, useEffect, useCallback, useMemo } from "react"
import type { LayerImage } from "../types/layerImage"

interface UseMainContentProps {
  backgroundImage: string | null
  middleLayerImages: LayerImage[]
  topLayerImages: LayerImage[]
  gridSize: number
  sceneScale: number
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  sceneBorderSize?: number
}

export const useMainContent = ({
  backgroundImage,
  middleLayerImages,
  topLayerImages,
  gridSize,
  sceneScale,
  zoomLevel,
  setZoomLevel,
  sceneBorderSize,
}: UseMainContentProps) => {
  // Refs
  const gridRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Constants
  const IMAGE_MAX_SIZE = 1200
  const IMAGE_MIN_SIZE = 50

  // State
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [imageDimensions, setImageDimensions] = useState<{ width: number; height: number } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null)
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])

  // Status modal state
  const [statusModal, setStatusModal] = useState<{
    isOpen: boolean;
    type: 'guard' | 'strength' | 'mp';
    currentValue: number;
    maxValue: number;
    characterId: number;
    character: any;
  } | null>(null)

  // Drawing state
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<string>("")

  // Effects
  useEffect(() => {
    if (backgroundImage) {
      const img = new window.Image()
      img.src = backgroundImage
      img.onload = () => {
        const scaledWidth = Math.round(img.width * sceneScale);
        const scaledHeight = Math.round(img.height * sceneScale);
        setImageDimensions({ width: scaledWidth, height: scaledHeight })
      }
    } else {
      setImageDimensions(null)
    }
  }, [backgroundImage, sceneScale])

  useEffect(() => {
    try {
      const savedZoom = parseFloat(localStorage.getItem('dmScreenZoomLevel') ?? '')
      if (savedZoom >= 0.5 && savedZoom <= 3) setZoomLevel(savedZoom)
    } catch {
      /* storage unavailable */
    }
  }, [setZoomLevel])

  useEffect(() => {
    try {
      localStorage.setItem('dmScreenZoomLevel', zoomLevel.toString())
    } catch {
      /* storage unavailable */
    }
  }, [zoomLevel])

  const borderFraction = sceneBorderSize ?? 0.2
  const borderWidth = useMemo(
    () => (imageDimensions ? Math.round(imageDimensions.width * borderFraction) : 0),
    [imageDimensions, borderFraction]
  )
  const borderHeight = useMemo(
    () => (imageDimensions ? Math.round(imageDimensions.height * borderFraction) : 0),
    [imageDimensions, borderFraction]
  )

  // Utility functions
  const generateUniqueId = useCallback((baseId: string) => 
    `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, [])

  const adjustImageSize = useCallback((width: number, height: number): { width: number; height: number } => {
    let newWidth = width;
    let newHeight = height;
    const aspectRatio = width / height;
    
    if (width > IMAGE_MAX_SIZE || height > IMAGE_MAX_SIZE) {
      if (width > height) {
        newWidth = IMAGE_MAX_SIZE;
        newHeight = Math.round(IMAGE_MAX_SIZE / aspectRatio);
      } else {
        newHeight = IMAGE_MAX_SIZE;
        newWidth = Math.round(IMAGE_MAX_SIZE * aspectRatio);
      }
    }
    
    if (newWidth < IMAGE_MIN_SIZE || newHeight < IMAGE_MIN_SIZE) {
      if (newWidth < newHeight) {
        newWidth = IMAGE_MIN_SIZE;
        newHeight = Math.round(IMAGE_MIN_SIZE / aspectRatio);
      } else {
        newHeight = IMAGE_MIN_SIZE;
        newWidth = Math.round(IMAGE_MIN_SIZE * aspectRatio);
      }
    }
    
    return { width: newWidth, height: newHeight };
  }, [])

  const snapToGrid = useCallback((layer: LayerImage[], newGridSize: number) => {
    return layer.map((item) => ({
      ...item,
      x: Math.floor(item.x / newGridSize) * newGridSize,
      y: Math.floor(item.y / newGridSize) * newGridSize,
      ...(item.width === gridSize && item.height === gridSize ? { width: newGridSize, height: newGridSize } : {}),
    }))
  }, [gridSize])

  /** Moves the given items by (dx, dy): tokens snap to the grid, map images move freely. */
  const updateItemPosition = useCallback((ids: string[], dx: number, dy: number) => {
    const updateLayer = (layer: LayerImage[], isTopLayer: boolean) => layer.map((item) => {
      if (!ids.includes(item.id)) return item;
      
      if (isTopLayer) {
        // Tokens (top layer): snap to grid
        return {
          ...item,
          x: Math.floor((item.x + dx) / gridSize) * gridSize,
          y: Math.floor((item.y + dy) / gridSize) * gridSize
        };
      } else {
        // Map images (middle layer): free movement
        return {
          ...item,
          x: item.x + dx,
          y: item.y + dy
        };
      }
    });
    
    const newMiddleLayer = updateLayer(middleLayerImages, false);
    const newTopLayer = updateLayer(topLayerImages, true);
    return { middleLayer: newMiddleLayer, topLayer: newTopLayer };
  }, [gridSize, middleLayerImages, topLayerImages])

  return {
    // Refs
    gridRef,
    containerRef,
    
    // State
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
    borderWidth,
    borderHeight,
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
    
    // Utility functions
    generateUniqueId,
    adjustImageSize,
    snapToGrid,
    updateItemPosition,
    
    // Constants
    IMAGE_MAX_SIZE,
    IMAGE_MIN_SIZE,
  }
} 