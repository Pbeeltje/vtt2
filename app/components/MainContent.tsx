"use client"

import { useRef, useState, useEffect } from "react"
import Image from "next/image"
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
  const GRID_SIZE = 50 // Grid cell size in pixels
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [resizingId, setResizingId] = useState<string | null>(null)
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null)
  const [resizeStart, setResizeStart] = useState<{ x: number; y: number; width: number; height: number } | null>(null)

  // Generate a unique ID for each instance
  const generateUniqueId = (baseId: string) => `${baseId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const adjustImageSize = (width: number, height: number): { width: number; height: number } => {
    let newWidth = width
    let newHeight = height
    const aspectRatio = width / height

    if (width > 500 || height > 500) {
      if (width > height) {
        newWidth = 500
        newHeight = Math.round(500 / aspectRatio)
      } else {
        newHeight = 500
        newWidth = Math.round(500 * aspectRatio)
      }
    }

    if (newWidth < 50 || newHeight < 50) {
      if (newWidth < newHeight) {
        newWidth = 50
        newHeight = Math.round(50 / aspectRatio)
      } else {
        newHeight = 50
        newWidth = Math.round(50 * aspectRatio)
      }
    }

    return { width: newWidth, height: newHeight }
  }

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData("imageId")
    const category = e.dataTransfer.getData("category")
    const url = e.dataTransfer.getData("url")
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE

    const image = new window.Image()
    image.src = url
    await new Promise((resolve) => {
      image.onload = resolve
    })

    const uniqueId = generateUniqueId(imageId) // Generate unique ID for each drop
    const imageData: LayerImage = { id: uniqueId, url: url || "", x, y }
    if (category === "Image") {
      const { width, height } = adjustImageSize(image.width, image.height)
      imageData.width = width
      imageData.height = height
    } else if (category === "Token") {
      imageData.width = GRID_SIZE
      imageData.height = GRID_SIZE
    }
    window.dispatchEvent(new CustomEvent("dropImage", { detail: { category, image: imageData, x, y } }))
  }

  const handleItemDragStart = (e: React.DragEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
    setDraggingId(item.id)
    setSelectedId(item.id)
    const rect = e.currentTarget.getBoundingClientRect()
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    })
    // Set drag preview to current size
    const dragImage = new window.Image()
    dragImage.src = item.url
    dragImage.width = item.width || GRID_SIZE
    dragImage.height = item.height || GRID_SIZE
    e.dataTransfer.setDragImage(dragImage, (item.width || GRID_SIZE) / 2, (item.height || GRID_SIZE) / 2)
  }

  const handleItemDrag = (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggingId || !dragOffset || e.clientX === 0 || e.clientY === 0) return
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
    e.preventDefault()
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

  const handleGridClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === gridRef.current) {
      setSelectedId(null) // Deselect if clicking empty grid area
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
        onClick={handleGridClick}
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
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(img.id)
            }}
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
            onClick={(e) => {
              e.stopPropagation()
              setSelectedId(img.id)
            }}
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