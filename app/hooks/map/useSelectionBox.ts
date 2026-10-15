"use client"

import { useCallback, useState } from "react"
import type { LayerImage } from "../../types/layerImage"
import type { DrawingObject } from "../../components/DrawingLayer"

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
 * player only gets their own tokens and drawings.
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
  const [selectionStart, setSelectionStart] = useState<Point | null>(null)
  const [selectionEnd, setSelectionEnd] = useState<Point | null>(null)
  const isSelecting = selectionStart !== null

  const toMap = useCallback(
    (e: React.MouseEvent): Point | null => {
      const rect = gridRef.current?.getBoundingClientRect()
      return rect ? { x: (e.clientX - rect.left) / zoomLevel, y: (e.clientY - rect.top) / zoomLevel } : null
    },
    [gridRef, zoomLevel]
  )

  const startSelection = useCallback(
    (e: React.MouseEvent) => {
      const point = toMap(e)
      if (e.button !== 0 || !point) return
      setSelectionStart(point)
      setSelectionEnd(point)
      e.preventDefault()
    },
    [toMap]
  )

  const moveSelection = useCallback(
    (e: React.MouseEvent) => {
      if (!selectionStart) return
      const point = toMap(e)
      if (point) setSelectionEnd(point)
      e.preventDefault()
    },
    [selectionStart, toMap]
  )

  const endSelection = useCallback(() => {
    if (!selectionStart || !selectionEnd) {
      setSelectionStart(null)
      setSelectionEnd(null)
      return
    }
    const minX = Math.min(selectionStart.x, selectionEnd.x)
    const maxX = Math.max(selectionStart.x, selectionEnd.x)
    const minY = Math.min(selectionStart.y, selectionEnd.y)
    const maxY = Math.max(selectionStart.y, selectionEnd.y)
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
    // Clear on the next tick so the click that ends the drag doesn't deselect everything.
    setTimeout(() => {
      setSelectionStart(null)
      setSelectionEnd(null)
    }, 10)
  }, [selectionStart, selectionEnd, gridSize, currentUserRole, currentUserId, middleLayerImages, topLayerImages, drawings, setSelectedIds, setSelectedDrawingIds])

  return { isSelecting, selectionStart, selectionEnd, startSelection, moveSelection, endSelection }
}
