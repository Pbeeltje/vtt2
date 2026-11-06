"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { startGesture, type Gesture } from "./gesture"

export const MIN_ZOOM = 0.5
export const MAX_ZOOM = 3
const ZOOM_STEP = 0.1
const ZOOM_STORAGE_KEY = "dmScreenZoomLevel"

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
 * Panning (right/middle mouse or Alt+drag, as a map gesture: ./gesture) and zooming. Ctrl+wheel zooms around the cursor;
 * the listener is non-passive so the browser page itself doesn't zoom too.
 */
export function useMapNavigation({ containerRef, gridRef, zoomLevel, setZoomLevel, onGridSizeWheel }: UseMapNavigationProps) {
  const [isPanning, setIsPanning] = useState(false)
  const zoomRef = useRef(zoomLevel)
  zoomRef.current = zoomLevel
  /** Map point (in unzoomed map pixels) that should stay under the screen point after a zoom. */
  const anchor = useRef<{ mapX: number; mapY: number; clientX: number; clientY: number } | null>(null)
  const onGridSizeWheelRef = useRef(onGridSizeWheel)
  onGridSizeWheelRef.current = onGridSizeWheel

  // The zoom is remembered per browser.
  useEffect(() => {
    try {
      const saved = parseFloat(localStorage.getItem(ZOOM_STORAGE_KEY) ?? "")
      if (saved >= MIN_ZOOM && saved <= MAX_ZOOM) setZoomLevel(saved)
    } catch {
      /* storage unavailable */
    }
  }, [setZoomLevel])

  useEffect(() => {
    try {
      localStorage.setItem(ZOOM_STORAGE_KEY, String(zoomLevel))
    } catch {
      /* storage unavailable */
    }
  }, [zoomLevel])

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

  const panRef = useRef<Gesture | null>(null)

  /** Right/middle button or Alt+left on the map: drag the view. Returns whether a pan started. */
  const startPan = useCallback(
    (e: React.MouseEvent) => {
      const isPanButton = e.button === 1 || e.button === 2 || (e.button === 0 && e.altKey)
      const container = containerRef.current
      if (!isPanButton || !container) return false
      // Even when no pan starts (another gesture is running), keep the browser's own middle-click
      // autoscroll from taking over.
      e.preventDefault()
      const from = { x: e.clientX, y: e.clientY, scrollLeft: container.scrollLeft, scrollTop: container.scrollTop }
      const gesture = startGesture(e, {
        kind: "pan",
        button: e.button,
        onMove: (ev) => {
          container.scrollLeft = from.scrollLeft - (ev.clientX - from.x)
          container.scrollTop = from.scrollTop - (ev.clientY - from.y)
        },
        onEnd: () => {
          panRef.current = null
          setIsPanning(false)
        },
      })
      if (!gesture) return false
      panRef.current = gesture
      setIsPanning(true)
      return true
    },
    [containerRef]
  )

  useEffect(() => () => panRef.current?.cancel(), [])

  return {
    isPanning,
    startPan,
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
