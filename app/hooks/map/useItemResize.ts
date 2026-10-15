"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerImage } from "../../types/layerImage"

interface UseItemResizeProps {
  enabled: boolean
  zoomLevel: number
  gridSize: number
  /** Applies a size change to the item with this id (tokens snap to the grid, map images don't). */
  resizeItem: (id: string, width: number, height: number) => void
}

/** Drag a token's or map image's corner handle to resize it (DM only). */
export function useItemResize({ enabled, zoomLevel, gridSize, resizeItem }: UseItemResizeProps) {
  const [resizingId, setResizingId] = useState<string | null>(null)
  const start = useRef<{ x: number; y: number; width: number; height: number; isToken: boolean } | null>(null)

  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      start.current = { x: e.clientX, y: e.clientY, width: item.width || gridSize, height: item.height || gridSize, isToken }
      setResizingId(item.id)
    },
    [enabled, gridSize]
  )

  useEffect(() => {
    if (!resizingId) return
    const onMove = (e: MouseEvent) => {
      const s = start.current
      if (!s) return
      const dx = (e.clientX - s.x) / zoomLevel
      const dy = (e.clientY - s.y) / zoomLevel
      if (Math.abs(dx) < 10 && Math.abs(dy) < 10) return // ignore tiny accidental movement
      if (s.isToken) {
        resizeItem(
          resizingId,
          Math.max(gridSize, Math.floor((s.width + dx) / gridSize) * gridSize),
          Math.max(gridSize, Math.floor((s.height + dy) / gridSize) * gridSize)
        )
      } else {
        resizeItem(resizingId, Math.max(gridSize * 0.5, s.width + dx), Math.max(gridSize * 0.5, s.height + dy))
      }
    }
    const onUp = () => {
      start.current = null
      setResizingId(null)
    }
    window.addEventListener("mousemove", onMove)
    window.addEventListener("mouseup", onUp)
    return () => {
      window.removeEventListener("mousemove", onMove)
      window.removeEventListener("mouseup", onUp)
    }
  }, [resizingId, zoomLevel, gridSize, resizeItem])

  return { resizingId, startResize }
}
