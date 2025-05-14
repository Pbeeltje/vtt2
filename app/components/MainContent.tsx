"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast" 
import type { LayerImage } from "../types/layerImage"
import DrawingToolbar from "./DrawingToolbar"
import type { DrawingObject } from './DrawingLayer'; 
import type { NewDrawingData } from './Home';     

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
  
  const [isDrawing, setIsDrawing] = useState(false)
  const [currentPath, setCurrentPath] = useState<string>("")
  const [selectedDrawingIds, setSelectedDrawingIds] = useState<string[]>([])

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
    const savedZoom = localStorage.getItem('dmScreenZoomLevel')
    if (savedZoom) {
      setZoomLevel(parseFloat(savedZoom))
    }
  }, [setZoomLevel])

  useEffect(() => {
    localStorage.setItem('dmScreenZoomLevel', zoomLevel.toString())
  }, [zoomLevel])

  const generateUniqueId = useCallback((baseId: string) => `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, [])
  const adjustImageSize = useCallback((width: number, height: number): { width: number; height: number } => { let newWidth = width; let newHeight = height; const aspectRatio = width / height; if (width > IMAGE_MAX_SIZE || height > IMAGE_MAX_SIZE) { if (width > height) { newWidth = IMAGE_MAX_SIZE; newHeight = Math.round(IMAGE_MAX_SIZE / aspectRatio); } else { newHeight = IMAGE_MAX_SIZE; newWidth = Math.round(IMAGE_MAX_SIZE * aspectRatio); } } if (newWidth < IMAGE_MIN_SIZE || newHeight < IMAGE_MIN_SIZE) { if (newWidth < newHeight) { newWidth = IMAGE_MIN_SIZE; newHeight = Math.round(IMAGE_MIN_SIZE / aspectRatio); } else { newHeight = IMAGE_MIN_SIZE; newWidth = Math.round(IMAGE_MIN_SIZE * aspectRatio); } } return { width: newWidth, height: newHeight }; }, [])
  const snapToGrid = useCallback((layer: LayerImage[], newGridSize: number) => { return layer.map((item) => ({ ...item, x: Math.floor(item.x / newGridSize) * newGridSize, y: Math.floor(item.y / newGridSize) * newGridSize, ...(item.width === gridSize && item.height === gridSize ? { width: newGridSize, height: newGridSize } : {}), })) }, [gridSize])
  const updateItemPosition = useCallback((id: string, dx: number, dy: number) => { const updateLayer = (layer: LayerImage[]) => layer.map((item) => draggingIds?.includes(item.id) ? { ...item, x: Math.floor((item.x + dx) / gridSize) * gridSize, y: Math.floor((item.y + dy) / gridSize) * gridSize } : item ); const newMiddleLayer = updateLayer(middleLayerImages); const newTopLayer = updateLayer(topLayerImages); return { middleLayer: newMiddleLayer, topLayer: newTopLayer }; }, [draggingIds, gridSize, middleLayerImages, topLayerImages])
  const updateItemSize = useCallback((id: string, width: number, height: number) => { const updateLayer = (layer: LayerImage[]) => layer.map((item) => (item.id === id ? { ...item, width, height } : item)); const newMiddleLayer = updateLayer(middleLayerImages); return { middleLayer: newMiddleLayer, topLayer: topLayerImages }; }, [middleLayerImages, topLayerImages])
  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const imageId = e.dataTransfer.getData("imageId");
    const category = e.dataTransfer.getData("category");
    const url = e.dataTransfer.getData("url");
    const characterIdStr = e.dataTransfer.getData("characterId");
    const characterData = e.dataTransfer.getData("character");
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect || !currentSceneId) {
      console.warn("Drop aborted: Missing grid ref or currentSceneId");
      return;
    }

    const adjustedX = (e.clientX - rect.left) / zoomLevel;
    const adjustedY = (e.clientY - rect.top) / zoomLevel;
    const x = Math.floor(adjustedX / gridSize) * gridSize;
    const y = Math.floor(adjustedY / gridSize) * gridSize;

    const image = new window.Image();
    image.src = url;
    await new Promise((resolve) => { image.onload = resolve });

    const uniqueId = generateUniqueId(imageId);

    const imageData: LayerImage = {
      id: uniqueId,
      url: url || "",
      x,
      y,
    };

    if (category === "Image") {
      imageData.width = image.width; 
      imageData.height = image.height;
    } else if (category === "Token") {
      imageData.width = gridSize;
      imageData.height = gridSize;
      if (characterIdStr && characterData) {
        try {
          const parsedCharacter = JSON.parse(characterData);
          imageData.characterId = parseInt(characterIdStr);
          imageData.character = { 
            Name: parsedCharacter.Name,
            Path: parsedCharacter.Path,
            Guard: parsedCharacter.Guard ?? 0,
            MaxGuard: parsedCharacter.MaxGuard ?? 0,
            Strength: parsedCharacter.Strength ?? 0,
            MaxStrength: parsedCharacter.MaxStrength ?? 0,
            Mp: parsedCharacter.Mp ?? 0,
            MaxMp: parsedCharacter.MaxMp ?? 0,
            userId: parsedCharacter.userId,
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

    if (category === "Token" && currentUserRole === 'player' && imageData.character?.userId === currentUserId && currentSceneId) {
      console.log("[MainContent.tsx] Player dropped their own token. Calling onPlayerPlaceToken.", imageData);
      onPlayerPlaceToken?.(imageData, currentSceneId);
    }

  }, [gridSize, generateUniqueId, middleLayerImages, topLayerImages, onUpdateImages, zoomLevel, currentUserRole, currentUserId, currentSceneId, onPlayerPlaceToken]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => { e.preventDefault() }, [])
  const handleItemDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => { 
    // Permission check for dragging
    if (isToken && currentUserRole === 'player' && item.character?.userId !== currentUserId) {
      toast({ title: "Permission Denied", description: "You can only drag your own character tokens.", variant: "destructive" });
      e.preventDefault(); // Prevent drag operation
      return;
    }
    if (!isToken && currentUserRole === 'player') {
      toast({ title: "Permission Denied", description: "Players cannot drag map images.", variant: "destructive" });
      e.preventDefault(); // Prevent drag operation
      return;
    }

    let dragIds = selectedIds; 
    if (selectedIds.length === 0) { 
      setSelectedIds([item.id]); 
      dragIds = [item.id]; 
    } else if (!selectedIds.includes(item.id)) { 
      // If multiple items are selected, only allow dragging if the clicked item is part of the selection.
      // This prevents accidental drags of unselected items when a group is selected.
      e.preventDefault();
      return; 
    } 
    setDraggingIds(dragIds); 
    const rect = e.currentTarget.getBoundingClientRect(); 
    setDragOffset({ x: (e.clientX - rect.left), y: (e.clientY - rect.top), }); 
    const canvas = document.createElement("canvas"); 
    const ctx = canvas.getContext("2d"); 
    if (ctx) { 
      canvas.width = item.width || gridSize; 
      canvas.height = item.height || gridSize; 
      const img = new window.Image(); 
      img.src = item.url; 
      img.onload = () => { 
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height); 
        try {
          e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2); 
        } catch (error) {
          // This can happen in some browsers if the drag was cancelled by e.preventDefault() almost immediately.
          // Or if the canvas is too large or complex.
          console.warn("Error setting drag image, drag might have been cancelled or image too complex.", error);
        }
      } 
    } 
  }, [selectedIds, gridSize, currentUserRole, currentUserId, toast]);
  const handleItemDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => { if (!draggingIds || !dragOffset || e.clientX === 0 || e.clientY === 0) return; const rect = gridRef.current?.getBoundingClientRect(); if (!rect) return; const referenceItem = middleLayerImages.find((i) => i.id === draggingIds[0]) || topLayerImages.find((i) => i.id === draggingIds[0]); if (!referenceItem) return; const adjustedX = (e.clientX - rect.left) / zoomLevel; const adjustedY = (e.clientY - rect.top) / zoomLevel; const newX = Math.floor((adjustedX - dragOffset.x / zoomLevel) / gridSize) * gridSize; const newY = Math.floor((adjustedY - dragOffset.y / zoomLevel) / gridSize) * gridSize; const dx = newX - referenceItem.x; const dy = newY - referenceItem.y; const { middleLayer, topLayer } = updateItemPosition(referenceItem.id, dx, dy); onUpdateImages?.(middleLayer, topLayer); }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages, zoomLevel])
  const handleItemDragEnd = useCallback(() => {
    const draggedItem = draggingIds && (middleLayerImages.find(img => img.id === draggingIds[0]) || topLayerImages.find(img => img.id === draggingIds[0]));

    if (currentUserRole === 'player' && 
        draggedItem && 
        topLayerImages.some(token => token.id === draggedItem.id) && // Check if it's a token
        draggedItem.character?.userId === currentUserId && 
        currentSceneId) {
      // Player finished dragging their own token
      console.log("[MainContent.tsx] Player finished dragging their own token. Calling onPlayerUpdateTokenPosition.", draggedItem);
      onPlayerUpdateTokenPosition?.(draggedItem, currentSceneId);
    } else if (currentUserRole === 'DM') {
      // DM finished dragging, onUpdateImages will trigger save via Home.tsx
      onUpdateImages?.(middleLayerImages, topLayerImages);
    }
    // For players, if it wasn't their token, or not a token, no server update is called here.
    // The onUpdateImages in handleItemDrag provided local visual feedback.
    // If DM, onUpdateImages is called to potentially trigger a save in Home.tsx.

    setDraggingIds(null); 
    setDragOffset(null); 
    // No longer universally call onUpdateImages for players here, as it might trigger incorrect save attempts in Home.tsx
    // The specific player update is handled by onPlayerUpdateTokenPosition.
    // DM changes are handled by their onUpdateImages call above.
  }, [draggingIds, middleLayerImages, topLayerImages, onUpdateImages, currentUserRole, currentUserId, currentSceneId, onPlayerUpdateTokenPosition]);
  const handleResizeStart = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => { 
    // Permission check for resizing
    // Assuming only non-token images (middle layer) have resize handles and players cannot resize them.
    // Tokens are typically fixed to gridSize.
    if (currentUserRole === 'player') {
      toast({ title: "Permission Denied", description: "Players cannot resize map images.", variant: "destructive" });
      e.preventDefault();
      return;
    }
    e.preventDefault(); 
    e.stopPropagation(); 
    setResizingId(item.id); 
    setResizeStart({ x: e.clientX, y: e.clientY, width: item.width || gridSize, height: item.height || gridSize, }); 
  }, [gridSize, currentUserRole, toast]);
  const handleResizeMove = useCallback((e: MouseEvent) => { if (!resizingId || !resizeStart) return; const dx = (e.clientX - resizeStart.x) / zoomLevel; const dy = (e.clientY - resizeStart.y) / zoomLevel; const newWidth = Math.max(gridSize, Math.floor((resizeStart.width + dx) / gridSize) * gridSize); const newHeight = Math.max(gridSize, Math.floor((resizeStart.height + dy) / gridSize) * gridSize); const { middleLayer, topLayer } = updateItemSize(resizingId, newWidth, newHeight); onUpdateImages?.(middleLayer, topLayer); }, [resizingId, resizeStart, gridSize, updateItemSize, onUpdateImages, zoomLevel])
  const handleResizeEnd = useCallback(() => { setResizingId(null); setResizeStart(null); onUpdateImages?.(middleLayerImages, topLayerImages); }, [middleLayerImages, topLayerImages, onUpdateImages])

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
          } else { nonPermissibleSelections.push(drawing.id); }
        }
      });
      if (nonPermissibleSelections.length > 0) {
          toast({ title: "Permission Denied", description: `You cannot delete drawings you didn't create. (${nonPermissibleSelections.length} item(s))`, variant: "destructive" });
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
            // DM can delete any token, will be filtered out later
          } else if (currentUserRole === 'player') {
            if (token.character?.userId === currentUserId) {
              playerTokensToDelete.push(id);
            } else {
              nonPermissibleTokens.push(id);
            }
          }
        } else {
          // It's an image from middleLayer (or not found in topLayer)
          // For now, assume only DMs can delete middleLayer images
          if (currentUserRole !== 'DM') {
            // If it's a middle layer image and user is not DM
            const middleImage = middleLayerImages.find(img => img.id === id);
            if (middleImage) { // Check if it actually exists in middle layer
                 nonPermissibleTokens.push(id); // Add to non-permissible if player tries to delete middle layer
            }
          }
        }
      });

      if (nonPermissibleTokens.length > 0) {
        toast({ title: "Permission Denied", description: `You do not have permission to delete some selected items. (${nonPermissibleTokens.length} item(s))`, variant: "destructive" });
      }

      // Call API for player-owned tokens
      playerTokensToDelete.forEach(tokenId => {
        onPlayerRequestTokenDelete?.(tokenId);
      });

      // Optimistic UI update
      // DM can delete any selected item (tokens or middle layer images)
      // Player can only delete their own tokens (API call initiated) and no middle layer images
      
      if (currentUserRole === 'DM') {
        newMiddleLayer = middleLayerImages.filter((img) => !selectedIds.includes(img.id));
        newTopLayer = topLayerImages.filter((img) => !selectedIds.includes(img.id));
      } else if (currentUserRole === 'player') {
        // Player only deletes their own tokens from top layer, middle layer remains untouched by player delete actions
        newTopLayer = topLayerImages.filter((img) => !playerTokensToDelete.includes(img.id));
        // Middle layer images are not modified by player delete attempts here
      }
      
      onUpdateImages?.(newMiddleLayer, newTopLayer);
      setSelectedIds([]);
    }
  }, [selectedIds, middleLayerImages, topLayerImages, onUpdateImages, selectedDrawingIds, drawings, currentUserRole, currentUserId, onDrawingsDelete, onPlayerRequestTokenDelete]);

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => { const target = e.target as HTMLElement; const isClickingToken = target.classList.contains('token-image') || target.closest('.token-image') || target.closest('[draggable="true"]'); if (!isClickingToken && currentTool !== 'brush') { setSelectedIds([]); setSelectedDrawingIds([]); } }, [currentTool]);
  const handleItemClick = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => { e.stopPropagation(); if (currentTool === 'brush') return; if (e.shiftKey) { setSelectedIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id]); } else { setSelectedIds([item.id]); } setSelectedDrawingIds([]); }, [currentTool])
  const handleDrawingClick = useCallback((e: React.MouseEvent<SVGPathElement>, drawing: {id: string, path: string, color: string, sceneId: number, createdBy: number, createdAt: string}) => {
    e.stopPropagation(); if (currentTool === 'brush') return;
    if (currentUserRole === 'player' && drawing.createdBy !== currentUserId) { toast({ title: "Permission Denied", description: "You can only select your own drawings.", variant: "destructive" }); return; }
    if (e.shiftKey) { setSelectedDrawingIds((prev) => prev.includes(drawing.id) ? prev.filter((id) => id !== drawing.id) : [...prev, drawing.id]); } 
    else { setSelectedDrawingIds([drawing.id]); }
    setSelectedIds([]); 
  }, [currentTool, currentUserRole, currentUserId])
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => { if (e.ctrlKey) { e.preventDefault(); const delta = e.deltaY > 0 ? -0.1 : 0.1; setZoomLevel(prev => Math.max(0.5, Math.min(3, prev + delta))); } else if (e.shiftKey) { e.preventDefault(); const newSize = Math.min(200, Math.max(20, gridSize + (e.deltaY < 0 ? 5 : -5))); onGridSizeChange(newSize); const newMiddleLayer = snapToGrid(middleLayerImages, newSize); const newTopLayer = snapToGrid(topLayerImages, newSize); onUpdateImages?.(newMiddleLayer, newTopLayer); } }, [gridSize, middleLayerImages, topLayerImages, onUpdateImages, snapToGrid, onGridSizeChange, setZoomLevel])
  const handleKeyDown = useCallback((e: KeyboardEvent) => { if (selectedIds.length === 1) { const id = selectedIds[0]; const item = middleLayerImages.find((i) => i.id === id) || topLayerImages.find((i) => i.id === id); if (!item) return; let dx = 0; let dy = 0; switch (e.key) { case "ArrowUp": dy = -gridSize; break; case "ArrowDown": dy = gridSize; break; case "ArrowLeft": dx = -gridSize; break; case "ArrowRight": dx = gridSize; break; default: return; } const { middleLayer, topLayer } = updateItemPosition(id, dx, dy); onUpdateImages?.(middleLayer, topLayer); } }, [selectedIds, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages])
  const handleColorChange = useCallback((color: string) => { onGridColorChange(color === "hidden" ? "transparent" : color === "gray" ? "rgba(0,0,0,0.1)" : color); setShowColorMenu(false); }, [onGridColorChange])
  const handleStatusUpdate = (value: number) => { if (!statusModal) return; const { type, characterId, character } = statusModal; const updatedCharacter = { Name: character.Name, Path: character.Path || (type === 'mp' ? "Magic User" : "Warrior"), Guard: type === 'guard' ? value : character.Guard || 0, MaxGuard: character.MaxGuard || 0, Strength: type === 'strength' ? value : character.Strength || 0, MaxStrength: character.MaxStrength || 0, Mp: type === 'mp' ? value : character.Mp || 0, MaxMp: character.MaxMp || 0 }; const updatedTopLayer = topLayerImages.map(item => item.characterId === characterId ? { ...item, character: updatedCharacter } : item ); onUpdateImages?.(middleLayerImages, updatedTopLayer); setStatusModal(null); fetch(`/api/characters/${characterId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ [type === 'guard' ? 'Guard' : type === 'strength' ? 'Strength' : 'Mp']: value, CharacterId: characterId }), }).catch(() => { const revertedTopLayer = topLayerImages.map(item => item.characterId === characterId ? { ...item, character } : item ); onUpdateImages?.(middleLayerImages, revertedTopLayer); }); };
  const handleNavigationDragStart = useCallback((e?: React.MouseEvent<HTMLDivElement>) => { if (e) { const isAltClick = e.button === 0 && e.altKey; const isMiddleClick = e.button === 1; const isLeftClickWithCursor = e.button === 0 && currentTool === 'cursor'; if (isMiddleClick || isAltClick || isLeftClickWithCursor) { if (isLeftClickWithCursor) { const target = e.target as HTMLElement; const isClickingToken = target.classList.contains('token-image') || target.closest('.token-image') || target.closest('[draggable="true"]'); if (isClickingToken) { return; } } setIsPanning(true); setPanStart({ x: e.clientX, y: e.clientY }); e.preventDefault(); } } }, [currentTool]);
  const handleNavigationDrag = useCallback((e?: React.MouseEvent<HTMLDivElement>) => { if (isPanning && panStart && e) { const dx = e.clientX - panStart.x; const dy = e.clientY - panStart.y; const containerEl = containerRef.current; if (containerEl) { containerEl.scrollLeft = panOffset.x - dx; containerEl.scrollTop = panOffset.y - dy; } e.preventDefault(); } }, [isPanning, panStart, panOffset]);
  const handleNavigationDragEnd = useCallback((e?: React.MouseEvent<HTMLDivElement>) => { if (isPanning) { const containerEl = containerRef.current; if (containerEl) { setPanOffset({ x: containerEl.scrollLeft, y: containerEl.scrollTop }); } setIsPanning(false); setPanStart(null); e?.preventDefault(); } }, [isPanning]);
  const handleZoomIn = useCallback(() => { setZoomLevel(prev => Math.min(prev + 0.1, 3)) }, [setZoomLevel])
  const handleZoomOut = useCallback(() => { setZoomLevel(prev => Math.max(prev - 0.1, 0.5)) }, [setZoomLevel])
  const handleZoomReset = useCallback(() => { setZoomLevel(1); setPanOffset({ x: 0, y: 0 }) }, [setZoomLevel])

  const startDrawing = useCallback((e: React.MouseEvent<HTMLDivElement>) => { if (currentTool !== 'brush') return; if (!currentSceneId) { console.warn('[StartDrawing] Aborted: currentSceneId prop is null/undefined.'); alert('Scene is not fully loaded yet. Please wait a moment and try drawing again.'); return; } if (currentUserId === null || currentUserId === undefined) { console.warn('[StartDrawing] Aborted: currentUserId prop is null or undefined.'); alert('User information is not loaded yet. Please wait a moment and try drawing again.'); return; } if (e.button !== 0 || e.altKey) return; const rect = gridRef.current?.getBoundingClientRect(); if (!rect) return; const x = (e.clientX - rect.left) / zoomLevel; const y = (e.clientY - rect.top) / zoomLevel; setIsDrawing(true); setCurrentPath(`M${x},${y}`); e.preventDefault(); }, [currentTool, zoomLevel, currentSceneId, currentUserId]);
  const draw = useCallback((e: React.MouseEvent<HTMLDivElement>) => { if (!isDrawing || currentTool !== 'brush') return; const rect = gridRef.current?.getBoundingClientRect(); if (!rect) return; const x = (e.clientX - rect.left) / zoomLevel; const y = (e.clientY - rect.top) / zoomLevel; setCurrentPath(prev => `${prev} L${x},${y}`); e.preventDefault(); }, [isDrawing, currentTool, zoomLevel]);
  
  const endDrawing = useCallback((e?: React.MouseEvent<any>) => {
    if (!isDrawing || !currentPath || currentTool !== 'brush') return;
    e?.preventDefault();
    if (!currentSceneId) { console.warn('[EndDrawing] Aborted: currentSceneId prop is not set.'); setIsDrawing(false); setCurrentPath(''); return; }
    if (currentUserId === null || currentUserId === undefined) { console.warn('[EndDrawing] Aborted: currentUserId prop is null or undefined.'); setIsDrawing(false); setCurrentPath(''); return; }
    
    const tempDrawingId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    // Ensure sceneId is a number for the object
    const sceneIdNum = typeof currentSceneId === 'string' ? parseInt(currentSceneId, 10) : currentSceneId;
    if (sceneIdNum === null || isNaN(sceneIdNum)) {
      console.error("[EndDrawing] Invalid sceneId:", currentSceneId);
      setIsDrawing(false); setCurrentPath(''); return;
    }

    // sceneIdNum is already validated above.
    // We only need to pass path and color, as other details are handled by Home.tsx or server.
    const drawingPayload: NewDrawingData = { 
      path: currentPath,
      color: currentColor,
      // sceneId: sceneIdNum, // sceneId will be added by Home.tsx
      // createdBy: currentUserId, // createdBy will be added by server (from session)
    };
    
    onDrawingAdd(drawingPayload);
    setIsDrawing(false); 
    setCurrentPath('');
    
  }, [isDrawing, currentPath, currentTool, currentColor, currentSceneId, currentUserId, onDrawingAdd, zoomLevel]); 
  
  const handleMouseLeave = useCallback(() => { if (isDrawing) { endDrawing(); } }, [isDrawing, endDrawing]);

  const handleDeleteAllDrawings = useCallback(() => {
    if (currentUserRole !== 'DM') {
      toast({ title: "Permission Denied", description: "Only DMs can delete all drawings.", variant: "destructive" });
      return;
    }
    if (drawings && drawings.length > 0) {
      if (window.confirm(`Are you sure you want to delete all ${drawings.length} drawings on this scene? This cannot be undone.`)) {
        const allDrawingIds = drawings.map(d => d.id);
        onDrawingsDelete(allDrawingIds);
        toast({ title: "Drawings Cleared", description: "All drawings on the scene have been queued for deletion." });
      }
    } else {
      toast({ title: "No Drawings", description: "There are no drawings on the scene to delete." });
    }
  }, [drawings, currentUserRole, onDrawingsDelete]);

  const handleTokenDoubleClick = (item: LayerImage) => {
    if (!item.character || !item.characterId) {
      return;
    }

    if (currentUserRole === 'DM') {
      onOpenCharacterSheet?.(item.character);
    } else if (currentUserRole === 'player') {
      if (item.character.userId === currentUserId) {
        onOpenCharacterSheet?.(item.character);
      } else {
        toast({ title: "Permission Denied", description: "You can only view details for your own characters.", variant: "destructive" });
      }
    } else {
        toast({ title: "Permission Denied", description: "You do not have permission to view character details.", variant: "destructive" });
    }
  };

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => { handleDelete(e); handleKeyDown(e) }
    window.addEventListener("mousemove", handleResizeMove); window.addEventListener("mouseup", handleResizeEnd)
    window.addEventListener("keydown", handleGlobalKeyDown)
    const handleGlobalMouseUp = () => { handleNavigationDragEnd() }
    window.addEventListener("mouseup", handleGlobalMouseUp)
    return () => {
      window.removeEventListener("mousemove", handleResizeMove);
      window.removeEventListener("mouseup", handleResizeEnd);
      window.removeEventListener("keydown", handleGlobalKeyDown);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    }
  }, [handleResizeMove, handleResizeEnd, handleDelete, handleKeyDown, handleNavigationDragEnd])

  // Removed local drawing fetch useEffect

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
          <div className="absolute top-2 left-2 z-30" style={{ position: 'sticky', transform: 'none' }}>
            <DrawingToolbar
              currentTool={currentTool}
              onToolChange={onToolChange}
              currentColor={currentColor}
              onColorChange={onColorChange}
              gridColor={gridColor}
              onGridColorChange={onGridColorChange}
              currentUserRole={currentUserRole}
              onDeleteAllDrawings={handleDeleteAllDrawings}
            />
            <div className="flex items-center space-x-2">
              <button onClick={handleZoomOut} className="w-6 h-6 flex items-center justify-center bg-stone-300 hover:stone-500 rounded-full" title="Zoom Out">
                <span className="text-sm">−</span>
              </button>
              <div className="text-xs font-medium w-12 text-center bg-stone-300 rounded">
                {Math.round(zoomLevel * 100)}%
              </div>
              <button onClick={handleZoomIn} className="w-6 h-6 flex items-center justify-center bg-stone-300 hover:stone-500 rounded-full" title="Zoom In">
                <span className="text-sm">+</span>
              </button>
              <button onClick={handleZoomReset} className="ml-1 px-2 py-1 text-xs bg-stone-300 hover:stone-500 rounded" title="Reset Zoom">
                Reset
              </button>
            </div>
          </div>
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
              backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center",
              width: "100%", height: "100%",
            }}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleGridClick}
            onMouseDown={(e) => {
              if (currentTool === 'brush') { startDrawing(e); e.stopPropagation(); } 
              else { handleNavigationDragStart(e); }
            }}
            onMouseMove={(e) => {
              if (isDrawing && currentTool === 'brush') { draw(e); e.stopPropagation(); } 
              else { handleNavigationDrag(e); }
            }}
            onMouseUp={(e) => {
              if (isDrawing && currentTool === 'brush') { endDrawing(e); e.stopPropagation(); } 
              else { handleNavigationDragEnd(e); }
            }}
            onMouseLeave={(e) => {
              if (isDrawing) { endDrawing(e); }
              handleNavigationDragEnd(e);
            }}
          >
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
                backgroundSize: `${gridSize}px ${gridSize}px`,
                width: "100%", height: "100%",
              }}
            />
            {middleLayerImages.map((img) => (
              <div
                key={img.id}
                className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
                style={{ left: img.x, top: img.y, zIndex: 25 }}
                draggable={true}
                onDragStart={(e) => handleItemDragStart(e, img, false)}
                onDrag={(e) => handleItemDrag(e)}
                onDragEnd={handleItemDragEnd}
                onClick={(e) => handleItemClick(e, img)}
              >
                <Image src={img.url} alt="Middle layer image" width={img.width || gridSize * 2} height={img.height || gridSize * 2} style={{ objectFit: 'contain' }} />
                <div className="absolute bottom-0 right-0 w-4 h-4 bg-gray-500 cursor-se-resize" onMouseDown={(e) => handleResizeStart(e, img)} />
              </div>
            ))}
            <svg className="absolute inset-0 w-full h-full" style={{ zIndex: 20 }}>
              {drawings.map((drawing) => ( 
                <path
                  key={drawing.id}
                  d={drawing.path}
                  stroke={selectedDrawingIds.includes(drawing.id) ? "blue" : drawing.color}
                  strokeWidth={selectedDrawingIds.includes(drawing.id) ? "5" : "3"}
                  fill="none" strokeLinejoin="round" strokeLinecap="round"
                  onClick={(e) => handleDrawingClick(e, drawing)}
                  className={`${currentTool === 'cursor' ? 'cursor-pointer' : ''}`}
                  style={{ pointerEvents: currentTool === 'cursor' ? 'auto' : 'none' }}
                />
              ))}
              {isDrawing && currentPath && (
                <path d={currentPath} stroke={currentColor} strokeWidth="3" fill="none" strokeLinejoin="round" strokeLinecap="round" />
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
                onDoubleClick={() => handleTokenDoubleClick(img)}
              >
                <div className="relative">
                  <Image src={img.url} alt="Token" width={gridSize} height={gridSize} style={{ objectFit: 'contain' }} className="token-image" />
                  {selectedIds.includes(img.id) && img.character && (
                    <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 whitespace-nowrap" style={{ zIndex: 30 }}>
                      <span className="text-sm font-semibold text-black" style={{ textShadow: `-1px -1px 0 white, 1px -1px 0 white, -1px 1px 0 white, 1px 1px 0 white` }}>
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
                      <div className="status-circle guard-circle relative bg-white rounded-full p-1">
                        <div className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center text-sm cursor-pointer hover:bg-green-50"
                          onClick={() => setStatusModal({ isOpen: true, type: 'guard', currentValue: character.Guard, maxValue: character.MaxGuard, characterId: img.characterId!, character })}>
                          {character.Guard}/{character.MaxGuard}
                        </div>
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">Gd</div>
                      </div>
                      <div className="status-circle strength-circle relative bg-white rounded-full p-1">
                        <div className="w-8 h-8 rounded-full border-2 border-red-500 flex items-center justify-center text-sm cursor-pointer hover:bg-red-50"
                          onClick={() => setStatusModal({ isOpen: true, type: 'strength', currentValue: character.Strength, maxValue: character.MaxStrength, characterId: img.characterId!, character })}>
                          {character.Strength}/{character.MaxStrength}
                        </div>
                        <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">Str</div>
                      </div>
                      {character.Path === "Magic User" && (
                        <div className="status-circle mp-circle relative bg-white rounded-full p-1">
                          <div className="w-8 h-8 rounded-full border-2 border-blue-500 flex items-center justify-center text-sm cursor-pointer hover:bg-blue-50"
                            onClick={() => setStatusModal({ isOpen: true, type: 'mp', currentValue: character.Mp, maxValue: character.MaxMp, characterId: img.characterId!, character })}>
                            {character.Mp}/{character.MaxMp}
                          </div>
                          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 text-[10px] text-gray-500">Mp</div>
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[100]" onClick={() => setStatusModal(null)}>
          <div className="bg-white p-6 rounded-lg shadow-lg z-[101]" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">Update {statusModal.type === 'guard' ? 'Guard' : statusModal.type === 'strength' ? 'Strength' : 'MP'}</h3>
            <div className="flex flex-col gap-4">
              <div className="flex items-center space-x-2">
                <input
                  type="number" min="0"
                  value={statusModal.currentValue === 0 ? '' : statusModal.currentValue}
                  onChange={(e) => {
                    const value = e.target.value === '' ? '' : parseInt(e.target.value);
                    setStatusModal(prev => prev ? { ...prev, currentValue: value === '' ? 0 : value } : null);
                  }}
                  className="w-24 px-2 py-1 border rounded" autoFocus
                />
                <span>/ {statusModal.maxValue}</span>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => handleStatusUpdate(statusModal.currentValue)} className="bg-blue-500 hover:bg-blue-600 text-white">Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
