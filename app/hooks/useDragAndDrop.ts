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
}: UseDragAndDropProps) => {
  const draggedItem = useRef<LayerImage | null>(null)
  const isDragging = useRef(false)

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    if (!selectedSceneId) {
      console.warn('No scene selected for drop')
      return
    }

    const files = e.dataTransfer.files
    const dataTransferData = e.dataTransfer.getData('application/json')

    if (files && files.length > 0) {
      // Handle file drop
      onFileDrop(files)
    } else if (dataTransferData) {
      try {
        const imageData = JSON.parse(dataTransferData)
        const isToken = draggedItem.current?.character !== undefined

        if (isToken && user?.role === 'player') {
          // Player dropping their own token
          if (draggedItem.current && draggedItem.current.character?.userId === user.id) {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = (e.clientX - rect.left) / 1 // Assuming zoom level of 1 for now
            const y = (e.clientY - rect.top) / 1

            const updatedToken = {
              ...draggedItem.current,
              x,
              y,
            }

            onPlayerPlaceToken?.(updatedToken, selectedSceneId)
          }
        } else {
          // DM dropping UI image or token
          const rect = e.currentTarget.getBoundingClientRect()
          const x = (e.clientX - rect.left) / 1
          const y = (e.clientY - rect.top) / 1

          const droppedImage: LayerImage = {
            id: imageData.imageId || `dropped-${Date.now()}`,
            url: imageData.url,
            x,
            y,
            width: 100,
            height: 100,
            category: imageData.category,
            character: draggedItem.current?.character,
          }

          onDrop(droppedImage)
        }
      } catch (error) {
        console.error('Error parsing drop data:', error)
      }
    }
  }, [selectedSceneId, user, onDrop, onFileDrop, onPlayerPlaceToken])

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
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({ x: (e.clientX - rect.left), y: (e.clientY - rect.top) })
    
    // Set data transfer data to prevent file upload detection
    e.dataTransfer.setData("imageId", item.id)
    e.dataTransfer.setData("category", isToken ? "Props" : "Image")
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
    
    const adjustedX = (e.clientX - rect.left) / zoomLevel
    const adjustedY = (e.clientY - rect.top) / zoomLevel
    
    // Check if this is a token (top layer) or map image (middle layer)
    const isToken = topLayerImages.some(token => token.id === referenceItem.id)
    
    let newX, newY
    
    if (isToken) {
      // Tokens: snap to grid
      newX = Math.floor((adjustedX - dragOffset.x / zoomLevel) / gridSize) * gridSize
      newY = Math.floor((adjustedY - dragOffset.y / zoomLevel) / gridSize) * gridSize
    } else {
      // Map images: free movement (no grid snapping)
      newX = adjustedX - dragOffset.x / zoomLevel
      newY = adjustedY - dragOffset.y / zoomLevel
    }
    
    const dx = newX - referenceItem.x
    const dy = newY - referenceItem.y
    
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