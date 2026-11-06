"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerImage } from "../../types/layerImage"
import { startGesture, type Gesture } from "./gesture"

/** Screen pixels the handle must travel before the resize starts (less is an accidental nudge). */
const RESIZE_THRESHOLD_PX = 10

interface UseItemResizeProps {
  enabled: boolean
  zoomLevel: number
  gridSize: number
  /** Applies a size change to the item with this id (tokens snap to the grid, map images don't). */
  resizeItem: (id: string, width: number, height: number) => void
}

/**
 * Drag a token's or map image's corner handle to resize it (DM only). Runs as a map gesture
 * (./gesture); Escape puts the item back to its original size.
 */
export function useItemResize({ enabled, zoomLevel, gridSize, resizeItem }: UseItemResizeProps) {
  const [resizingId, setResizingId] = useState<string | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const latest = useRef({ zoomLevel, gridSize, resizeItem })
  latest.current = { zoomLevel, gridSize, resizeItem }

  const startResize = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, item: LayerImage, isToken: boolean) => {
      if (!enabled) return
      e.preventDefault()
      e.stopPropagation()
      const id = item.id
      const from = { x: e.clientX, y: e.clientY, width: item.width || gridSize, height: item.height || gridSize }
      let started = false

      const gesture = startGesture(e, {
        kind: "resize",
        button: e.button,
        onMove: (ev) => {
          const { zoomLevel: zoom, gridSize: size, resizeItem: resize } = latest.current
          if (!started && Math.hypot(ev.clientX - from.x, ev.clientY - from.y) < RESIZE_THRESHOLD_PX) return
          started = true
          const dx = (ev.clientX - from.x) / zoom
          const dy = (ev.clientY - from.y) / zoom
          if (isToken) {
            resize(id, Math.max(size, Math.floor((from.width + dx) / size) * size), Math.max(size, Math.floor((from.height + dy) / size) * size))
          } else {
            resize(id, Math.max(size * 0.5, from.width + dx), Math.max(size * 0.5, from.height + dy))
          }
        },
        onEnd: (commit) => {
          gestureRef.current = null
          setResizingId(null)
          if (started && !commit) latest.current.resizeItem(id, from.width, from.height)
          return started
        },
      })
      if (!gesture) return
      gestureRef.current = gesture
      setResizingId(id)
    },
    [enabled, gridSize]
  )

  useEffect(() => () => gestureRef.current?.cancel(), [])

  return { resizingId, startResize }
}
