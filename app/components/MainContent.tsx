"use client"

import { useRef, useState, useEffect, useCallback } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { getUserFromCookie } from "@/lib/auth"
import type { LayerImage } from "../types/layerImage"

interface MainContentProps {
  backgroundImage: string | null
  middleLayerImages: LayerImage[] | undefined
  topLayerImages: LayerImage[] | undefined
  onUpdateImages?: (middleLayer: LayerImage[], topLayer: LayerImage[]) => void
}

export default function MainContent({
  backgroundImage,
  middleLayerImages = [],
  topLayerImages = [],
  onUpdateImages,
}: MainContentProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const [gridSize, setGridSize] = useState(50)
  const IMAGE_MAX_SIZE = 1200
  const IMAGE_MIN_SIZE = 50
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [draggingIds, setDraggingIds] = useState<string[] | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [gridColor, setGridColor] = useState("rgba(0,0,0,0.1)")
  const [showColorMenu, setShowColorMenu] = useState(false)

  useEffect(() => {
    const fetchUser = async () => {
      const user = await getUserFromCookie()
      setUserRole(user?.role || null)
    }
    fetchUser()
  }, [])

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
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.floor((e.clientX - rect.left) / gridSize) * gridSize
    const y = Math.floor((e.clientY - rect.top) / gridSize) * gridSize

    const image = new window.Image()
    image.src = url
    await new Promise((resolve) => {
      image.onload = resolve
    })

    const uniqueId = generateUniqueId(imageId)
    const imageData: LayerImage = { id: uniqueId, url: url || "", x, y }
    if (category === "Image") {
      const { width, height } = adjustImageSize(image.width, image.height)
      imageData.width = width
      imageData.height = height
    } else if (category === "Token") {
      imageData.width = gridSize
      imageData.height = gridSize
    }
    window.dispatchEvent(new CustomEvent("dropImage", { detail: { category, image: imageData, x, y } }))
  }, [gridSize, adjustImageSize, generateUniqueId])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }, [])

  const handleItemDragStart = useCallback((e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    if (selectedIds.length === 0) {
      setSelectedIds([item.id])
    } else if (!selectedIds.includes(item.id)) {
      return
    }
    setDraggingIds(selectedIds)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
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

    const newX = Math.floor((e.clientX - rect.left - dragOffset.x) / gridSize) * gridSize
    const newY = Math.floor((e.clientY - rect.top - dragOffset.y) / gridSize) * gridSize
    const dx = newX - referenceItem.x
    const dy = newY - referenceItem.y

    const { middleLayer, topLayer } = updateItemPosition(referenceItem.id, dx, dy)
    onUpdateImages?.(middleLayer, topLayer) // Update parent state during drag
  }, [draggingIds, dragOffset, gridSize, middleLayerImages, topLayerImages, updateItemPosition, onUpdateImages])

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
    const dx = e.clientX - resizeStart.x
    const dy = e.clientY - resizeStart.y
    const newWidth = Math.max(gridSize, Math.floor((resizeStart.width + dx) / gridSize) * gridSize)
    const newHeight = Math.max(gridSize, Math.floor((resizeStart.height + dy) / gridSize) * gridSize)

    const { middleLayer, topLayer } = updateItemSize(resizingId, newWidth, newHeight)
    onUpdateImages?.(middleLayer, topLayer) // Update parent state during resize
  }, [resizingId, resizeStart, gridSize, updateItemSize, onUpdateImages])

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
  }, [selectedIds, middleLayerImages, topLayerImages, onUpdateImages])

  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === gridRef.current) {
      setSelectedIds([])
    }
  }, [])

  const handleItemClick = useCallback((e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    e.stopPropagation()
    if (e.shiftKey) {
      setSelectedIds((prev) => prev.includes(item.id) ? prev.filter((id) => id !== item.id) : [...prev, item.id])
    } else {
      setSelectedIds([item.id])
    }
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (e.shiftKey && userRole === "DM") {
      e.preventDefault()
      const newSize = Math.min(200, Math.max(20, gridSize + (e.deltaY < 0 ? 5 : -5)))
      setGridSize(newSize)
      const newMiddleLayer = snapToGrid(middleLayerImages, newSize)
      const newTopLayer = snapToGrid(topLayerImages, newSize)
      onUpdateImages?.(newMiddleLayer, newTopLayer)
    }
  }, [userRole, gridSize, middleLayerImages, topLayerImages, onUpdateImages, snapToGrid])

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
    setGridColor(color === "hidden" ? "transparent" : color === "gray" ? "rgba(0,0,0,0.1)" : color)
    setShowColorMenu(false)
  }, [])

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      handleDelete(e)
      handleKeyDown(e)
    }
    window.addEventListener("mousemove", handleResizeMove)
    window.addEventListener("mouseup", handleResizeEnd)
    window.addEventListener("keydown", handleGlobalKeyDown)
    return () => {
      window.removeEventListener("mousemove", handleResizeMove)
      window.removeEventListener("mouseup", handleResizeEnd)
      window.removeEventListener("keydown", handleGlobalKeyDown)
    }
  }, [handleResizeMove, handleResizeEnd, handleDelete, handleKeyDown])

  return (
    <div className="flex flex-col h-full w-full overflow-hidden">
      <div
        ref={gridRef}
        className="flex-grow relative"
        style={{
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : "none",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onClick={handleGridClick}
        onWheel={handleWheel}
      >
        {userRole === "DM" && (
          <div className="absolute top-2 left-2 z-30">
            <div
              className="w-6 h-6 rounded-full cursor-pointer border border-black"
              style={{ backgroundColor: gridColor === "transparent" ? "gray" : gridColor }}
              onClick={() => setShowColorMenu(!showColorMenu)}
            />
            {showColorMenu && (
              <div className="absolute top-8 left-0 bg-white border rounded p-1.5 flex flex-col gap-1.5 scale-75 origin-top-left">
                <Button onClick={() => handleColorChange("white")} className="bg-white text-black h-6 text-xs">White</Button>
                <Button onClick={() => handleColorChange("black")} className="bg-black text-white h-6 text-xs">Black</Button>
                <Button onClick={() => handleColorChange("red")} className="bg-red-500 text-white h-6 text-xs">Red</Button>
                <Button onClick={() => handleColorChange("green")} className="bg-green-500 text-white h-6 text-xs">Green</Button>
                <Button onClick={() => handleColorChange("gray")} className="bg-gray-500 text-white h-6 text-xs">Gray</Button>
                <Button onClick={() => handleColorChange("hidden")} className="bg-gray-700 text-white h-6 text-xs">Hidden</Button>
              </div>
            )}
          </div>
        )}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, ${gridColor} 1px, transparent 1px), linear-gradient(to bottom, ${gridColor} 1px, transparent 1px)`,
            backgroundSize: `${gridSize}px ${gridSize}px`,
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
              objectFit="contain"
            />
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-500 cursor-se-resize"
              onMouseDown={(e) => handleResizeStart(e, img)}
            />
          </div>
        ))}
        {topLayerImages.map((img) => (
          <div
            key={img.id}
            className={`absolute ${selectedIds.includes(img.id) ? "border-2 border-blue-500" : ""}`}
            style={{ left: img.x, top: img.y, zIndex: 20 }}
            draggable={true}
            onDragStart={(e) => handleItemDragStart(e, img, true)}
            onDrag={(e) => handleItemDrag(e)}
            onDragEnd={handleItemDragEnd}
            onClick={(e) => handleItemClick(e, img)}
          >
            <Image
              src={img.url}
              alt="Token"
              width={gridSize}
              height={gridSize}
              objectFit="contain"
            />
          </div>
        ))}
      </div>
    </div>
  )
}