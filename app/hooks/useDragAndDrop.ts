import { useCallback, useRef } from 'react'
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
  onDrop: (imageData: LayerImage) => void
  onFileDrop: (files: FileList) => void
  onPlayerRequestTokenDelete: (tokenId: string) => void
  user: { id: number; role: string } | null
  selectedSceneId: number | null
  borderWidth?: number
  borderHeight?: number
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
  onDrop,
  onFileDrop,
  onPlayerRequestTokenDelete,
  user,
  selectedSceneId,
  borderWidth = 0,
  borderHeight = 0,
}: UseDragAndDropProps) => {
  const draggedItem = useRef<LayerImage | null>(null)
  const isDragging = useRef(false)

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (!currentSceneId) {
      console.log('No currentSceneId, cannot drop');
      return
    }

    const files = e.dataTransfer.files
    const dataTransferData = e.dataTransfer.getData('application/json')
    const characterId = e.dataTransfer.getData('characterId')
    const characterData = e.dataTransfer.getData('character')
    
    console.log('Drop event data:', {
      files: files?.length || 0,
      dataTransferData,
      characterId,
      characterData,
      currentSceneId,
      user
    });

    if (files && files.length > 0) {
      // Handle file drop
      console.log('Handling file drop');
      onFileDrop(files)
    } else if (characterId && characterData) {
      // Handle character drop from CharacterList (check this first)
      try {
        const character = JSON.parse(characterData)
        console.log('Parsed character data:', character);
        
        const rect = e.currentTarget.getBoundingClientRect()
        const adjustedX = (e.clientX - rect.left - borderWidth) / zoomLevel
        const adjustedY = (e.clientY - rect.top - borderHeight) / zoomLevel
        
        // Tokens snap to grid
        const x = Math.floor(adjustedX / gridSize) * gridSize
        const y = Math.floor(adjustedY / gridSize) * gridSize

        const droppedToken: LayerImage = {
          id: `${characterId}-${Date.now()}`,
          url: character.TokenUrl || character.PortraitUrl || "/placeholder.svg",
          x,
          y,
          width: gridSize, // Tokens are sized to grid
          height: gridSize, // Tokens are sized to grid
          character: {
            CharacterId: character.CharacterId,
            Name: character.Name,
            Path: character.Path,
            Guard: character.Guard ?? 0,
            MaxGuard: character.MaxGuard ?? 0,
            Strength: character.Strength ?? 0,
            MaxStrength: character.MaxStrength ?? 0,
            Mp: character.Mp ?? 0,
            MaxMp: character.MaxMp ?? 0,
            userId: character.userId,
            TokenUrl: character.TokenUrl,
            PortraitUrl: character.PortraitUrl
          },
        }

        console.log('DM dropping character token:', droppedToken);
        console.log('Character URLs:', {
          TokenUrl: character.TokenUrl,
          PortraitUrl: character.PortraitUrl,
          finalUrl: droppedToken.url
        });
        onDrop(droppedToken)
      } catch (error) {
        console.error('Error parsing character data:', error)
      }
    } else if (dataTransferData) {
      try {
        const imageData = JSON.parse(dataTransferData)
        console.log('Parsed image data:', imageData);
        
        // Check if this is an existing item being dragged around
        const isExistingItem = draggedItem.current !== null && draggedItem.current.id === imageData.imageId
        const isToken = isExistingItem ? draggedItem.current?.character !== undefined : imageData.category === "Token"
        
        console.log('Is existing item:', isExistingItem, 'Is token:', isToken, 'Dragged item:', draggedItem.current);

        if (isToken && user?.role === 'player') {
          // Player dropping their own token
          if (draggedItem.current && draggedItem.current.character?.userId === user.id) {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left - borderWidth) / 1 // Assuming zoom level of 1 for now
            const y = (e.clientY - rect.top - borderHeight) / 1

            const updatedToken = {
              ...draggedItem.current,
              x,
              y,
            }

            console.log('Player placing token:', updatedToken);
            onPlayerPlaceToken?.(updatedToken, currentSceneId)
          }
        } else {
          // DM dropping UI image or token
          let realCategory = imageData.category
          
          // If this has character data, it's a character token - don't fetch from database
          if (!characterId && !characterData) {
            try {
              const res = await fetch(`/api/images/${imageData.imageId}`)
              if (res.ok) {
                const img = await res.json()
                realCategory = img.Category || img.category || realCategory
              }
            } catch (err) {
              console.warn('Failed to fetch image category from backend, using drag data', err)
            }
          }

          const rect = gridRef.current?.getBoundingClientRect()
          if (!rect) {
            console.error('Grid ref is null, cannot get bounding rect')
            return
          }
          const mouseX = (e.clientX - rect.left - borderWidth) / zoomLevel;
          const mouseY = (e.clientY - rect.top - borderHeight) / zoomLevel;
          setDragOffset({
            x: mouseX - imageData.x,
            y: mouseY - imageData.y
          })

          let x, y, width, height
          
          if (realCategory === "Token") {
            x = Math.floor(mouseX / gridSize) * gridSize
            y = Math.floor(mouseY / gridSize) * gridSize
            width = gridSize
            height = gridSize
          } else if (realCategory === "Prop") {
            x = Math.floor(mouseX / gridSize) * gridSize
            y = Math.floor(mouseY / gridSize) * gridSize
            width = 100
            height = 100
          } else {
            x = mouseX
            y = mouseY
            width = 100
            height = 100
          }

          const droppedImage: LayerImage = {
            id: `${imageData.imageId}-${Date.now()}` || `dropped-${Date.now()}`,
            url: imageData.url,
            x,
            y,
            width,
            height,
            category: realCategory,
            character: realCategory === "Token" ? draggedItem.current?.character : undefined,
          }

          console.log('DM dropping image (with real category):', droppedImage);
          onDrop(droppedImage)
        }
      } catch (error) {
        console.error('Error parsing drop data:', error)
      }
    } else {
      console.log('No valid drop data found');
    }
  }, [currentSceneId, user, onDrop, onFileDrop, onPlayerPlaceToken, gridSize, zoomLevel])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }, [])

  const handleItemDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    // Permission check for dragging
    if (isToken && currentUserRole === 'player' && item.character?.userId !== currentUserId) {
      toast({ title: "Permission Denied", description: "You can only drag your own character tokens.", variant: "destructive" })
      e.preventDefault()
      return
    }
    if (!isToken && currentUserRole === 'player') {
      toast({ title: "Permission Denied", description: "Players cannot drag map images.", variant: "destructive" })
      e.preventDefault()
      return
    }

    let dragIds = selectedIds
    if (selectedIds.length === 0) { 
      setSelectedIds([item.id])
      dragIds = [item.id]
    } else if (!selectedIds.includes(item.id)) { 
      e.preventDefault()
      return
    } 
    
    setDraggingIds(dragIds)
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    const mouseX = (e.clientX - rect.left - borderWidth) / zoomLevel;
    const mouseY = (e.clientY - rect.top - borderHeight) / zoomLevel;
    setDragOffset({
      x: mouseX - item.x,
      y: mouseY - item.y
    })
    
    // Set data transfer data to prevent file upload detection
    e.dataTransfer.setData("imageId", item.id)
    e.dataTransfer.setData("category", isToken ? "Token" : (typeof (item as any).category === "string" && (item as any).category === "Prop" ? "Prop" : "Image"))
    e.dataTransfer.setData("image-url", item.url)
    e.dataTransfer.setData("isExistingItem", "true")
    
    // Clear any files from data transfer
    e.dataTransfer.clearData("Files")
    
    const canvas = document.createElement("canvas")
    const ctx = canvas.getContext("2d")
    if (ctx) { 
      canvas.width = item.width || gridSize
      canvas.height = item.height || gridSize
      const img = new window.Image()
      img.src = item.url
      img.onload = () => { 
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        try {
          e.dataTransfer.setDragImage(canvas, canvas.width / 2, canvas.height / 2) 
        } catch (error) {
          console.warn("Error setting drag image, drag might have been cancelled or image too complex.", error)
        }
      } 
    } 

    isDragging.current = true
    draggedItem.current = item
  }, [selectedIds, gridSize, currentUserRole, currentUserId])

  const handleItemDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingIds || !dragOffset || e.clientX === 0 || e.clientY === 0) return
    
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const referenceItem = middleLayerImages.find((i) => i.id === draggingIds[0]) || 
                         topLayerImages.find((i) => i.id === draggingIds[0])
    if (!referenceItem) return
    
    const mouseX = (e.clientX - rect.left - borderWidth) / zoomLevel;
    const mouseY = (e.clientY - rect.top - borderHeight) / zoomLevel;
    
    // Check if this is a token (top layer) or map image (middle layer)
    const isToken = topLayerImages.some(token => token.id === referenceItem.id)
    
    let newX, newY
    
    if (isToken) {
      // Tokens: snap to grid
      newX = Math.floor((mouseX - dragOffset.x) / gridSize) * gridSize
      newY = Math.floor((mouseY - dragOffset.y) / gridSize) * gridSize
    } else {
      // Map images: free movement (no grid snapping)
      newX = mouseX - dragOffset.x
      newY = mouseY - dragOffset.y
    }
    
    const dx = newX - referenceItem.x
    const dy = newY - referenceItem.y

    // Debug logging
    console.log('[handleItemDrag]', {
      mouseX, mouseY,
      dragOffsetX: dragOffset.x, dragOffsetY: dragOffset.y,
      newX, newY,
      referenceItemX: referenceItem.x, referenceItemY: referenceItem.y,
      dx, dy,
      isToken,
      zoomLevel, borderWidth, borderHeight
    });
    
    const { middleLayer, topLayer } = updateItemPosition(referenceItem.id, dx, dy)
    onUpdateImages?.(middleLayer, topLayer)
  }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages, zoomLevel])

  const handleItemDragEnd = useCallback(() => {
    const draggedItem = draggingIds && (middleLayerImages.find(img => img.id === draggingIds[0]) || 
                                       topLayerImages.find(img => img.id === draggingIds[0]))

    if (currentUserRole === 'player' && 
        draggedItem && 
        topLayerImages.some(token => token.id === draggedItem.id) && 
        draggedItem.character?.userId === currentUserId && 
        currentSceneId) {
      onPlayerUpdateTokenPosition?.(draggedItem, currentSceneId)
    } else if (currentUserRole === 'DM') {
      onUpdateImages?.(middleLayerImages, topLayerImages)
    }

    setDraggingIds(null)
    setDragOffset(null)
  }, [draggingIds, middleLayerImages, topLayerImages, onUpdateImages, currentUserRole, currentUserId, currentSceneId, onPlayerUpdateTokenPosition])

  const handleTokenMove = useCallback((tokenId: string, newX: number, newY: number) => {
    if (!draggedItem.current || !currentSceneId) return

    const isToken = draggedItem.current.character !== undefined
    
    if (isToken && currentUserRole === 'player') {
      // Player moving their own token
      if (draggedItem.current.character?.userId === currentUserId) {
        const updatedToken = {
          ...draggedItem.current,
          x: newX,
          y: newY,
        }
        onPlayerUpdateTokenPosition?.(updatedToken, currentSceneId)
      }
    }
  }, [currentSceneId, currentUserRole, currentUserId, onPlayerUpdateTokenPosition])

  const handleTokenDelete = useCallback((tokenId: string) => {
    if (currentUserRole === 'player') {
      onPlayerRequestTokenDelete(tokenId)
    }
  }, [currentUserRole, onPlayerRequestTokenDelete])

  return {
    handleDrop,
    handleDragOver,
    handleItemDragStart,
    handleItemDrag,
    handleItemDragEnd,
    handleTokenMove,
    handleTokenDelete,
    isDragging: isDragging.current,
  }
} 