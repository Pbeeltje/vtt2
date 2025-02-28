"use client"

import { useRef, useEffect } from "react"
import Image from "next/image"

interface MainContentProps {
  backgroundImage: string | null
  middleLayerImages: { id: string; url: string; x: number; y: number }[] | undefined
  topLayerImages: { id: string; url: string; x: number; y: number }[] | undefined
}

export default function MainContent({ backgroundImage, middleLayerImages = [], topLayerImages = [] }: MainContentProps) {
  const gridRef = useRef<HTMLDivElement>(null)
  const GRID_SIZE = 50 // Grid cell size in pixels

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const imageId = e.dataTransfer.getData("imageId")
    const category = e.dataTransfer.getData("category")
    const url = e.dataTransfer.getData("url") // Ensure URL is set in dragStart
    const rect = gridRef.current?.getBoundingClientRect()
    if (!rect) return

    const x = Math.floor((e.clientX - rect.left) / GRID_SIZE) * GRID_SIZE
    const y = Math.floor((e.clientY - rect.top) / GRID_SIZE) * GRID_SIZE

    const image = { id: imageId, url: url || "", x, y }
    if (category === "Image" || category === "Token") {
      window.dispatchEvent(
        new CustomEvent("dropImage", { detail: { category, image, x, y } })
      )
    }
  }

  useEffect(() => {
    const handleDropEvent = (e: Event) => {
      const { category, image, x, y } = (e as CustomEvent).detail
      if (category === "Image" || category === "Token") {
        // Handled in Home.tsx via onDropImage
      }
    }
    window.addEventListener("dropImage", handleDropEvent)
    return () => window.removeEventListener("dropImage", handleDropEvent)
  }, [])

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
        {/* Grid Overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(0,0,0,0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.1) 1px, transparent 1px)`,
            backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
          }}
        />
        {/* Middle Layer (Images) */}
        {middleLayerImages.map((img) => (
          <div
            key={img.id}
            className="absolute"
            style={{ left: img.x, top: img.y, zIndex: 10 }}
          >
            <Image src={img.url} alt="Middle layer image" width={GRID_SIZE} height={GRID_SIZE} objectFit="contain" />
          </div>
        ))}
        {/* Top Layer (Tokens) */}
        {topLayerImages.map((img) => (
          <div
            key={img.id}
            className="absolute"
            style={{ left: img.x, top: img.y, zIndex: 20 }}
          >
            <Image src={img.url} alt="Token" width={GRID_SIZE} height={GRID_SIZE} objectFit="contain" />
          </div>
        ))}
      </div>
    </div>
  )
}