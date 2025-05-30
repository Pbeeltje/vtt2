import { useCallback } from "react"
import { toast } from "@/components/ui/use-toast"
import type { LayerImage } from "../types/layerImage"

interface UseDragAndDropProps {
  gridRef: React.RefObject<HTMLDivElement>
  gridSize: number
  zoomLevel: number
  currentSceneId?: number | null
  currentUserId?: number | null
  currentUserRole?: string | null
  middleLayerImages: LayerImage[]
  topLayerImages: LayerImage[]
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  draggingIds: string[] | null
  setDraggingIds: React.Dispatch<React.SetStateAction<string[] | null>>
  dragOffset: { x: number; y: number } | null
  setDragOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>
  generateUniqueId: (baseId: string) => string
  updateItemPosition: (id: string, dx: number, dy: number) => { middleLayer: LayerImage[], topLayer: LayerImage[] }
  onUpdateImages?: (middleLayer: LayerImage[], topLayer: LayerImage[]) => void
  onPlayerPlaceToken?: (token: LayerImage, sceneId: number) => void
  onPlayerUpdateTokenPosition?: (token: LayerImage, sceneId: number) => void
}

export const useDragAndDrop = ({
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
}: UseDragAndDropProps) => {

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
            CharacterId: imageData.characterId,
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

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  const handleItemDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    // Permission check for dragging
    if (isToken && currentUserRole === 'player' && item.character?.userId !== currentUserId) {
      toast({ title: "Permission Denied", description: "You can only drag your own character tokens.", variant: "destructive" });
      e.preventDefault();
      return;
    }
    if (!isToken && currentUserRole === 'player') {
      toast({ title: "Permission Denied", description: "Players cannot drag map images.", variant: "destructive" });
      e.preventDefault();
      return;
    }

    let dragIds = selectedIds; 
    if (selectedIds.length === 0) { 
      setSelectedIds([item.id]); 
      dragIds = [item.id]; 
    } else if (!selectedIds.includes(item.id)) { 
      e.preventDefault();
      return; 
    } 
    
    setDraggingIds(dragIds); 
    const rect = e.currentTarget.getBoundingClientRect(); 
    setDragOffset({ x: (e.clientX - rect.left), y: (e.clientY - rect.top) }); 
    
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
          console.warn("Error setting drag image, drag might have been cancelled or image too complex.", error);
        }
      } 
    } 
  }, [selectedIds, gridSize, currentUserRole, currentUserId]);

  const handleItemDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingIds || !dragOffset || e.clientX === 0 || e.clientY === 0) return;
    
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const referenceItem = middleLayerImages.find((i) => i.id === draggingIds[0]) || 
                         topLayerImages.find((i) => i.id === draggingIds[0]);
    if (!referenceItem) return;
    
    const adjustedX = (e.clientX - rect.left) / zoomLevel;
    const adjustedY = (e.clientY - rect.top) / zoomLevel;
    const newX = Math.floor((adjustedX - dragOffset.x / zoomLevel) / gridSize) * gridSize;
    const newY = Math.floor((adjustedY - dragOffset.y / zoomLevel) / gridSize) * gridSize;
    const dx = newX - referenceItem.x;
    const dy = newY - referenceItem.y;
    
    const { middleLayer, topLayer } = updateItemPosition(referenceItem.id, dx, dy);
    onUpdateImages?.(middleLayer, topLayer);
  }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages, zoomLevel])

  const handleItemDragEnd = useCallback(() => {
    const draggedItem = draggingIds && (middleLayerImages.find(img => img.id === draggingIds[0]) || 
                                       topLayerImages.find(img => img.id === draggingIds[0]));

    if (currentUserRole === 'player' && 
        draggedItem && 
        topLayerImages.some(token => token.id === draggedItem.id) && 
        draggedItem.character?.userId === currentUserId && 
        currentSceneId) {
      console.log("[MainContent.tsx] Player finished dragging their own token. Calling onPlayerUpdateTokenPosition.", draggedItem);
      onPlayerUpdateTokenPosition?.(draggedItem, currentSceneId);
    } else if (currentUserRole === 'DM') {
      onUpdateImages?.(middleLayerImages, topLayerImages);
    }

    setDraggingIds(null); 
    setDragOffset(null); 
  }, [draggingIds, middleLayerImages, topLayerImages, onUpdateImages, currentUserRole, currentUserId, currentSceneId, onPlayerUpdateTokenPosition]);

  return {
    handleDrop,
    handleDragOver,
    handleItemDragStart,
    handleItemDrag,
    handleItemDragEnd,
  }
} 