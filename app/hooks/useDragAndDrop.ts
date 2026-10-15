import { useCallback, useRef } from 'react'
import { clientToGridLogical } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import type { LayerImage } from "../types/layerImage"
import { createCharacterToken } from "../lib/tokens"

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
  updateItemPosition: (ids: string[], dx: number, dy: number) => { middleLayer: LayerImage[], topLayer: LayerImage[] }
  onUpdateImages?: (middleLayer: LayerImage[], topLayer: LayerImage[]) => void
  onPlayerUpdateTokenPosition?: (token: LayerImage) => void
  onDrop: (imageData: LayerImage) => void
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
  onPlayerUpdateTokenPosition,
  onDrop,
}: UseDragAndDropProps) => {
  const draggedItem = useRef<LayerImage | null>(null)
  const isDragging = useRef(false)

  const handleDrop = useCallback(async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    
    // Check if this is an existing item being dragged around
    const isExistingItem = e.dataTransfer.getData("isExistingItem")
    if (isExistingItem === "true") {
      return
    }
    
    if (!currentSceneId) {
      return
    }

    const files = e.dataTransfer.files
    const dataTransferData = e.dataTransfer.getData('application/json')
    const characterId = e.dataTransfer.getData('characterId')
    const characterData = e.dataTransfer.getData('character')

    if (files && files.length > 0) {
      // File drops are handled by GameGrid, not here
      return
    } else if (characterId && characterData) {
      // Handle character drop from CharacterList (check this first)
      try {
        const character = JSON.parse(characterData)
        
        const rect = e.currentTarget.getBoundingClientRect()
        const { x: adjustedX, y: adjustedY } = clientToGridLogical(
          e.clientX,
          e.clientY,
          rect,
          zoomLevel
        )
        
        // Tokens snap to grid
        const x = Math.floor(adjustedX / gridSize) * gridSize
        const y = Math.floor(adjustedY / gridSize) * gridSize
        onDrop(createCharacterToken(character, x, y, gridSize))
      } catch {
        /* invalid character payload */
      }
    } else if (dataTransferData) {
      try {
        const imageData = JSON.parse(dataTransferData)
        
        // Only DMs drop library images onto the map; players place character tokens (above).
        if (currentUserRole === 'DM') {
          // DM dropping from sidebar JSON (ImageList) or similar — category is already authoritative for Image/Prop.
          let realCategory: string = imageData.category ?? "Image"
          const fromSidebarList = realCategory === "Image" || realCategory === "Prop"
          if (!characterId && !characterData && !fromSidebarList) {
            try {
              const res = await fetch(`/api/images/${imageData.imageId}`, { credentials: "include" })
              if (res.ok) {
                const img = await res.json()
                realCategory = img.Category || img.category || realCategory
              }
            } catch {
              /* keep realCategory from payload */
            }
          }

          const rect = gridRef.current?.getBoundingClientRect()
          if (!rect) {
            return
          }
          const { x: mouseX, y: mouseY } = clientToGridLogical(
            e.clientX,
            e.clientY,
            rect,
            zoomLevel
          )
          setDragOffset({
            x: mouseX - (typeof imageData.x === "number" ? imageData.x : 0),
            y: mouseY - (typeof imageData.y === "number" ? imageData.y : 0),
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
            id: `${imageData.imageId}-${Date.now()}`,
            url: imageData.url,
            x,
            y,
            width,
            height,
            category: realCategory,
            character: realCategory === "Token" ? draggedItem.current?.character : undefined,
          }

          onDrop(droppedImage)
        }
      } catch {
        /* invalid JSON */
      }
    }
  }, [currentSceneId, currentUserRole, onDrop, gridSize, zoomLevel, setDragOffset, gridRef])

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
    const { x: mouseX, y: mouseY } = clientToGridLogical(
      e.clientX,
      e.clientY,
      rect,
      zoomLevel
    )
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
  }, [selectedIds, gridSize, currentUserRole, currentUserId, zoomLevel])

  const handleItemDrag = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingIds || !dragOffset || e.clientX === 0 || e.clientY === 0) return
    
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const refId = draggingIds[0]
    const refMiddle = middleLayerImages.find((i) => i.id === refId)
    const refTop = topLayerImages.find((i) => i.id === refId)
    const referenceItem = refMiddle ?? refTop
    if (!referenceItem) return

    const isTopLayerDrag = refMiddle === undefined && refTop !== undefined

    const { x: mouseX, y: mouseY } = clientToGridLogical(
      e.clientX,
      e.clientY,
      rect,
      zoomLevel
    )

    // Top-layer (tokens): place by grid cell under cursor so snap matches "that square", not grab-offset top-left.
    // Middle layer: keep grab point under cursor (free move).
    let dx: number
    let dy: number
    if (isTopLayerDrag) {
      const cellX = Math.floor(mouseX / gridSize) * gridSize
      const cellY = Math.floor(mouseY / gridSize) * gridSize
      dx = cellX - referenceItem.x
      dy = cellY - referenceItem.y
    } else {
      const newX = mouseX - dragOffset.x
      const newY = mouseY - dragOffset.y
      dx = newX - referenceItem.x
      dy = newY - referenceItem.y
    }

    const { middleLayer, topLayer } = updateItemPosition(draggingIds, dx, dy)
    onUpdateImages?.(middleLayer, topLayer)
  }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages, zoomLevel, gridRef])

  // The DM's moves are saved by the scene autosave; a player's token move is sent to the server.
  const handleItemDragEnd = useCallback(() => {
    const movedId = draggingIds?.[0]
    const movedToken = movedId ? topLayerImages.find((token) => token.id === movedId) : undefined
    if (currentUserRole === 'player' && movedToken && movedToken.character?.userId === currentUserId) {
      onPlayerUpdateTokenPosition?.(movedToken)
    }

    setDraggingIds(null)
    setDragOffset(null)
    draggedItem.current = null
    isDragging.current = false
  }, [draggingIds, topLayerImages, currentUserRole, currentUserId, onPlayerUpdateTokenPosition, setDraggingIds, setDragOffset])

  return {
    handleDrop,
    handleDragOver,
    handleItemDragStart,
    handleItemDrag,
    handleItemDragEnd,
  }
}
