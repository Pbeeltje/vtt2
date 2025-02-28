"use client"

import { useRef, useState, useEffect } from "react"
import Image from "next/image"
import type { LayerImage } from "../types/layerImage"

interface MainContentProps {
  backgroundImage: string | null
  middleLayerImages: LayerImage[] | undefined
  topLayerImages: LayerImage[] | undefined
  onUpdateImages?: (middleLayer: LayerImage[], topLayer: LayerImage[]) => void // Callback to update parent state
}

export default function MainContent({
  backgroundImage,
  middleLayerImages = [],
  topLayerImages = [],
  onUpdateImages,
}: MainContentProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const GRID_SIZE = 50 // Grid cell size in pixels
  const [selectedId, setSelectedId] = useState<string | null>(null) // Track selected image/token
  const [draggingId, setDraggingId] = useState<string | null>(null) // Track which item is being dragged
  const [resizingId, setResizingId] = useState<string | null>(null) // Track which image is being resized
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData("imageId")
    const category = e.dataTransfer.getData("category")
    const url = e.dataTransfer.getData("url")
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE

    const image: LayerImage = { id: imageId, url: url || "", x, y }
    if (category === "Image") {
      image.width = GRID_SIZE * 2 // Default size for images
      image.height = GRID_SIZE * 2
    } else if (category === "Token") {
      image.width = GRID_SIZE // Tokens fixed to grid size
      image.height = GRID_SIZE
    }
    window.dispatchEvent(new CustomEvent("dropImage", { detail: { category, image, x, y } }))
  }

  const handleItemDragStart = (e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    setDraggingId(item.id)
    setSelectedId(item.id)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left - (isToken ? 0 : (item.width || GRID_SIZE) / 2),
      y: e.clientY - rect.top - (isToken ? 0 : (item.height || GRID_SIZE) / 2),
    })
    const dragImage = document.createElement("img")
    dragImage.src = item.url
    e.dataTransfer.setDragImage(dragImage, 0, 0) // Hide default drag preview
  }

  const handleItemDrag = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId || !dragOffset) return
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.floor((e.clientX - rect.left - dragOffset.x) / GRID_SIZE) * GRID_SIZE
    const y = Math.floor((e.clientY - rect.top - dragOffset.y) / GRID_SIZE) * GRID_SIZE

    updateItemPosition(draggingId, x, y)
  }

  const handleItemDragEnd = () => {
    setDraggingId(null)
    setDragOffset(null)
    if (onUpdateImages) {
      onUpdateImages(middleLayerImages, topLayerImages)
    }
  }

  const handleResizeStart = (e: React.MouseEvent<HTMLDivElement>, item: LayerImage) => {
    e.stopPropagation()
    setResizingId(item.id)
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: item.width || GRID_SIZE,
      height: item.height || GRID_SIZE,
    })
  }

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingId || !resizeStart) return
    const dx = e.clientX - resizeStart.x
    const dy = e.clientY - resizeStart.y
    const newWidth = Math.max(GRID_SIZE, Math.floor((resizeStart.width + dx) / GRID_SIZE) * GRID_SIZE)
    const newHeight = Math.max(GRID_SIZE, Math.floor((resizeStart.height + dy) / GRID_SIZE) * GRID_SIZE)

    updateItemSize(resizingId, newWidth, newHeight)
  }

  const handleResizeEnd = () => {
    setResizingId(null)
    setResizeStart(null)
    if (onUpdateImages) {
      onUpdateImages(middleLayerImages, topLayerImages)
    }
  }

  const updateItemPosition = (id: string, x: number, y: number) => {
    const updateLayer = (layer: LayerImage[]) =>
      layer.map((item) => (item.id === id ? { ...item, x, y } : item))
    if (middleLayerImages.some((img) => img.id === id)) {
      middleLayerImages = updateLayer(middleLayerImages)
    } else if (topLayerImages.some((img) => img.id === id)) {
      topLayerImages = updateLayer(topLayerImages)
    }
  }

  const updateItemSize = (id: string, width: number, height: number) => {
    const updateLayer = (layer: LayerImage[]) =>
      layer.map((item) => (item.id === id ? { ...item, width, height } : item))
    if (middleLayerImages.some((img) => img.id === id)) {
      middleLayerImages = updateLayer(middleLayerImages)
    }
  }

  const handleDelete = (e: KeyboardEvent) => {
    if (e.key === "Delete" && selectedId) {
      const newMiddleLayer = middleLayerImages.filter((img) => img.id !== selectedId)
      const newTopLayer = topLayerImages.filter((img) => img.id !== selectedId)
      if (onUpdateImages) {
        onUpdateImages(newMiddleLayer, newTopLayer)
      }
      setSelectedId(null)
    }
  }

  useEffect(() => {
    window.addEventListener("mousemove", handleResizeMove)
    window.addEventListener("mouseup", handleResizeEnd)
    window.addEventListener("keydown", handleDelete)
    return () => {
      window.removeEventListener("mousemove", handleResizeMove)
      window.removeEventListener("mouseup", handleResizeEnd)
      window.removeEventListener("keydown", handleDelete)
    }
  }, [resizingId, resizeStart, selectedId, middleLayerImages, topLayerImages])

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
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />
        {middleLayerImages.map((img) => (
          <div
            key={img.id}
            className={`absolute ${selectedId === img.id ? "border-2 border-blue-500" : ""}`}
            style={{ left: img.x, top: img.y, zIndex: 10 }}
            draggable
            onDragStart={(e) => handleItemDragStart(e, img, false)}
            onDrag={(e) => handleItemDrag(e)}
            onDragEnd={handleItemDragEnd}
            onClick={() => setSelectedId(img.id)}
          >
            <Image
              src={img.url}
              alt="Middle layer image"
              width={img.width || GRID_SIZE * 2}
              height={img.height || GRID_SIZE * 2}
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
            className={`absolute ${selectedId === img.id ? "border-2 border-blue-500" : ""}`}
            style={{ left: img.x, top: img.y, zIndex: 20 }}
            draggable
            onDragStart={(e) => handleItemDragStart(e, img, true)}
            onDrag={(e) => handleItemDrag(e)}
            onDragEnd={handleItemDragEnd}
            onClick={() => setSelectedId(img.id)}
          >
            <Image
              src={img.url}
              alt="Token"
              width={GRID_SIZE}
              height={GRID_SIZE}
              objectFit="contain"
            />
          </div>
        ))}
      </div>
    </div>
  )
}