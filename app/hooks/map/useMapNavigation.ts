"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 3
const ZOOM_STEP = 0.1

const clampZoom = (z: number) => Math.round(Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z)) * 100) / 100

interface UseMapNavigationProps {
  containerRef: React.RefObject<HTMLDivElement>
  gridRef: React.RefObject<HTMLDivElement>
  zoomLevel: number
  setZoomLevel: React.Dispatch<React.SetStateAction<number>>
  /** Shift+wheel: resize the grid (DM only). */
  onGridSizeWheel?: (direction: 1 | -1) => void
}

/**
 * Panning (right/middle mouse or Alt+drag) and zooming. Ctrl+wheel zooms around the cursor;
 * the listener is non-passive so the browser page itself doesn't zoom too.
 */
export function useMapNavigation({ containerRef, gridRef, zoomLevel, setZoomLevel, onGridSizeWheel }: UseMapNavigationProps) {
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null)
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  /** Map point (in unzoomed map pixels) that should stay under the screen point after a zoom. */
  const anchor = useRef<{ mapX: number; mapY: number; clientX: number; clientY: number } | null>(null)
  const onGridSizeWheelRef = useRef(onGridSizeWheel)
  onGridSizeWheelRef.current = onGridSizeWheel

  const zoomAt = useCallback(
    (clientX: number, clientY: number, nextZoom: number) => {
      const grid = gridRef.current
      const next = clampZoom(nextZoom)
      if (!grid || next === zoomRef.current) return
      const rect = grid.getBoundingClientRect()
      anchor.current = {
        mapX: (clientX - rect.left) / zoomRef.current,
        mapY: (clientY - rect.top) / zoomRef.current,
        clientX,
        clientY,
      }
      setZoomLevel(next)
    },
    [gridRef, setZoomLevel]
  )

  // After the zoom renders, scroll so the anchored map point is back under the cursor.
  useLayoutEffect(() => {
    const a = anchor.current
    const grid = gridRef.current
    const container = containerRef.current
    anchor.current = null
    if (!a || !grid || !container) return
    const rect = grid.getBoundingClientRect()
    container.scrollLeft += rect.left + a.mapX * zoomLevel - a.clientX
    container.scrollTop += rect.top + a.mapY * zoomLevel - a.clientY
  }, [zoomLevel, gridRef, containerRef])

  const zoomAroundCenter = useCallback(
    (nextZoom: number) => {
      const container = containerRef.current
      if (!container) return setZoomLevel(clampZoom(nextZoom))
      const rect = container.getBoundingClientRect()
      zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, nextZoom)
    },
    [containerRef, setZoomLevel, zoomAt]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault()
        zoomAt(e.clientX, e.clientY, zoomRef.current + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP))
      } else if (e.shiftKey && onGridSizeWheelRef.current) {
        e.preventDefault()
        onGridSizeWheelRef.current(e.deltaY < 0 ? 1 : -1)
      }
    }
    container.addEventListener("wheel", onWheel, { passive: false })
    return () => container.removeEventListener("wheel", onWheel)
  }, [containerRef, zoomAt])

  const startPan = useCallback(
    (e: React.MouseEvent) => {
      const isPanButton = e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)
      const container = containerRef.current
      if (!isPanButton || !container) return false
      panStart.current = { x: e.clientX, y: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop }
      setIsPanning(true)
      e.preventDefault()
      return true
    },
    [containerRef]
  )

  const pan = useCallback(
    (e: React.MouseEvent) => {
      const start = panStart.current
      const container = containerRef.current
      if (!start || !container) return
      container.scrollLeft = start.scrollLeft - (e.clientX - start.x)
      container.scrollTop = start.scrollTop - (e.clientY - start.y)
      e.preventDefault()
    },
    [containerRef]
  )

  const endPan = useCallback(() => {
    if (!panStart.current) return
    panStart.current = null
    setIsPanning(false)
  }, [])

  useEffect(() => {
    window.addEventListener("mouseup", endPan)
    return () => window.removeEventListener("mouseup", endPan)
  }, [endPan])

  return {
    isPanning,
    startPan,
    pan,
    endPan,
    zoomIn: useCallback(() => zoomAroundCenter(zoomRef.current + ZOOM_STEP), [zoomAroundCenter]),
    zoomOut: useCallback(() => zoomAroundCenter(zoomRef.current - ZOOM_STEP), [zoomAroundCenter]),
    zoomReset: useCallback(() => {
      setZoomLevel(1)
      const container = containerRef.current
      if (container) {
        container.scrollLeft = 0
        container.scrollTop = 0
      }
    }, [containerRef, setZoomLevel]),
  }
}
