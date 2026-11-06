"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from "../../types/drawing"
import { startGesture, type Gesture } from "./gesture"

type Point = { x: number; y: number }

interface UseSelectionBoxProps {
  gridRef: React.RefObject<HTMLDivElement>
  zoomLevel: number
  gridSize: number
  middleLayerImages: LayerImage[]
  topLayerImages: LayerImage[]
  drawings: DrawingObject[]
  currentUserRole?: string | null
  currentUserId?: number | null
  setSelectedIds: (ids: string[]) => void
  setSelectedDrawingIds: (ids: string[]) => void
}

/** Bounding box of every "x,y" pair in an SVG path. */
function pathBounds(path: string) {
  const points = (path.match(/-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?/g) ?? []).map((pair) => pair.split(",").map(Number))
  if (points.length === 0) return null
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) }
}

/**
 * Drag a rectangle on empty map space to select what's inside: everything for the DM; a
 * player only gets their own tokens and drawings. Runs as a map gesture (./gesture): it keeps
 * going outside the map, and Escape cancels it, keeping the previous selection.
 */
export function useSelectionBox({
  gridRef,
  zoomLevel,
  gridSize,
  middleLayerImages,
  topLayerImages,
  drawings,
  currentUserRole,
  currentUserId,
  setSelectedIds,
  setSelectedDrawingIds,
}: UseSelectionBoxProps) {
  /** The box being dragged (map coordinates), or null. */
  const [box, setBox] = useState<{ start: Point; end: Point } | null>(null)
  const boxRef = useRef(box)
  const gestureRef = useRef<Gesture | null>(null)

  // The box outlives the render it started in; select from the latest map when it ends.
  const latest = useRef({ zoomLevel, gridSize, middleLayerImages, topLayerImages, drawings, currentUserRole, currentUserId, setSelectedIds, setSelectedDrawingIds })
  latest.current = { zoomLevel, gridSize, middleLayerImages, topLayerImages, drawings, currentUserRole, currentUserId, setSelectedIds, setSelectedDrawingIds }

  const toMap = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = gridRef.current?.getBoundingClientRect()
      const zoom = latest.current.zoomLevel
      return rect ? { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom } : null
    },
    [gridRef]
  )

  const show = useCallback((next: { start: Point; end: Point } | null) => {
    boxRef.current = next
    setBox(next)
  }, [])

  /** Selects what the box covers (unless cancelled). */
  const finish = useCallback((commit: boolean): boolean => {
    const current = boxRef.current
    gestureRef.current = null
    show(null)
    if (!commit || !current) return false
    const { gridSize, middleLayerImages, topLayerImages, drawings, currentUserRole, currentUserId, setSelectedIds, setSelectedDrawingIds } = latest.current
    const minX = Math.min(current.start.x, current.end.x)
    const maxX = Math.max(current.start.x, current.end.x)
    const minY = Math.min(current.start.y, current.end.y)
    const maxY = Math.max(current.start.y, current.end.y)
    const overlaps = (item: LayerImage) =>
      item.x < maxX && item.x + (item.width || gridSize) > minX && item.y < maxY && item.y + (item.height || gridSize) > minY
    const isDM = currentUserRole === "DM"

    const itemIds = [
      ...(isDM ? middleLayerImages.filter(overlaps) : []),
      ...topLayerImages.filter((t) => overlaps(t) && (isDM || t.character?.userId === currentUserId)),
    ].map((item) => item.id)

    const drawingIds = drawings
      .filter((d) => isDM || d.createdBy === currentUserId)
      .filter((d) => {
        const b = d.path ? pathBounds(d.path) : null
        return b !== null && b.minX < maxX && b.maxX > minX && b.minY < maxY && b.maxY > minY
      })
      .map((d) => d.id)

    setSelectedIds(itemIds)
    setSelectedDrawingIds(drawingIds)
    return true
  }, [show])

  const startSelection = useCallback(
    (e: React.MouseEvent) => {
      const point = toMap(e.clientX, e.clientY)
      if (e.button !== 0 || !point) return
      const gesture = startGesture(e, {
        kind: "select",
        button: 0,
        onMove: (ev) => {
          const end = toMap(ev.clientX, ev.clientY)
          if (end && boxRef.current) show({ start: boxRef.current.start, end })
        },
        onEnd: finish,
      })
      if (!gesture) return
      e.preventDefault()
      gestureRef.current = gesture
      show({ start: point, end: point })
    },
    [toMap, finish, show]
  )

  useEffect(() => () => gestureRef.current?.cancel(), [])

  const rect = box
    ? { x: Math.min(box.start.x, box.end.x), y: Math.min(box.start.y, box.end.y), width: Math.abs(box.end.x - box.start.x), height: Math.abs(box.end.y - box.start.y) }
    : null

  return { selectionRect: rect, startSelection }
}
