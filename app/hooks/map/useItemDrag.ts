"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/use-toast"
import { clientToGridLogical } from "@/lib/utils"
import type { LayerImage } from "../../types/layerImage"
import { dragPositions, isSamePlace, type PlacedItem, type Point } from "../../lib/map-items"
import { startGesture, type Gesture } from "./gesture"

/** Screen pixels the mouse must travel before a press on an item becomes a drag (less is a click). */
const DRAG_THRESHOLD_PX = 4

interface UseItemDragProps {
  gridRef: React.RefObject<HTMLDivElement>
  zoomLevel: number
  gridSize: number
  middleLayerImages: LayerImage[]
  topLayerImages: LayerImage[]
  selectedIds: string[]
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>
  /** Whether this user may move the item (the DM anything, a player their own tokens). */
  canMove: (item: LayerImage, isToken: boolean) => boolean
  /** The drag ended somewhere new: the moved items' new positions, committed once. */
  onMove: (positions: Map<string, Point>, moved: PlacedItem[]) => void
}

type Drag = {
  grabbed: PlacedItem
  /** The items that move, as they were when picked up. */
  items: PlacedItem[]
  startClient: Point
  grabPoint: Point
  started: boolean
  positions: Map<string, Point> | null
}

/**
 * Moving tokens and map images with the mouse.
 *
 * Pressing on an item selects it (or keeps the selection if it is part of it). Once the mouse has
 * moved a few pixels, the selection follows it: tokens snap to the grid, images move freely. While
 * dragging, only a preview (`dragPositions`) changes; the scene is updated once, on release. Escape
 * cancels. It runs as a map gesture (./gesture), so it keeps going outside the map.
 */
export function useItemDrag({
  gridRef,
  zoomLevel,
  gridSize,
  middleLayerImages,
  topLayerImages,
  selectedIds,
  setSelectedIds,
  canMove,
  onMove,
}: UseItemDragProps) {
  const [preview, setPreview] = useState<Map<string, Point> | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  const frameRef = useRef<number | null>(null)

  // The drag outlives the render it started in; read these when it ends.
  const latest = useRef({ zoomLevel, gridSize, onMove })
  latest.current = { zoomLevel, gridSize, onMove }

  const mapPoint = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const rect = gridRef.current?.getBoundingClientRect()
      return rect ? clientToGridLogical(clientX, clientY, rect, latest.current.zoomLevel) : null
    },
    [gridRef]
  )

  /** The gesture ended: commit the move unless cancelled. True when the items were dragged. */
  const finish = useCallback((commit: boolean): boolean => {
    const drag = dragRef.current
    dragRef.current = null
    gestureRef.current = null
    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
      frameRef.current = null
    }
    setPreview(null)
    if (!drag?.started) return false
    if (commit && drag.positions && !isSamePlace(drag.items, drag.positions)) {
      latest.current.onMove(drag.positions, drag.items)
    }
    return true
  }, [])

  const startItemDrag = useCallback(
    (e: React.MouseEvent, itemId: string) => {
      const top = topLayerImages.find((t) => t.id === itemId)
      const middle = top ? undefined : middleLayerImages.find((i) => i.id === itemId)
      const grabbedItem = top ?? middle
      const grabPoint = mapPoint(e.clientX, e.clientY)
      if (!grabbedItem || !grabPoint) return
      // Keeps the browser from dragging the <img> itself, or selecting text.
      e.preventDefault()

      // Shift+click adds to or removes from the selection (see the click handler); no drag.
      if (e.shiftKey) return

      const onPointerMove = (ev: PointerEvent) => {
        const drag = dragRef.current
        if (!drag) return
        if (!drag.started) {
          if (Math.hypot(ev.clientX - drag.startClient.x, ev.clientY - drag.startClient.y) < DRAG_THRESHOLD_PX) return
          if (!canMove(drag.grabbed.item, drag.grabbed.isToken)) {
            toast({
              title: "Permission denied",
              description: drag.grabbed.isToken ? "You can only move your own character tokens." : "Players cannot move map images.",
              variant: "destructive",
            })
            gestureRef.current?.cancel()
            return
          }
          drag.started = true
        }
        const now = mapPoint(ev.clientX, ev.clientY)
        if (!now) return
        drag.positions = dragPositions(drag.items, drag.grabbed, drag.grabPoint, now.x - drag.grabPoint.x, now.y - drag.grabPoint.y, latest.current.gridSize)
        if (frameRef.current === null) {
          frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null
            const positions = dragRef.current?.positions
            // Tokens only change cell now and then: skip frames where nothing moved.
            if (positions) setPreview((prev) => (prev && samePositions(prev, positions) ? prev : positions))
          })
        }
      }

      const gesture = startGesture(e, { kind: "drag", button: 0, onMove: onPointerMove, onEnd: finish })
      if (!gesture) return

      const inSelection = selectedIds.includes(itemId)
      if (!inSelection) setSelectedIds([itemId])
      const ids = new Set(inSelection ? selectedIds : [itemId])

      const grabbed: PlacedItem = { item: grabbedItem, isToken: Boolean(top) }
      const items: PlacedItem[] = [
        ...topLayerImages.filter((t) => ids.has(t.id)).map((item) => ({ item, isToken: true })),
        ...middleLayerImages.filter((i) => ids.has(i.id)).map((item) => ({ item, isToken: false })),
      ].filter(({ item, isToken }) => canMove(item, isToken))

      dragRef.current = { grabbed, items, startClient: { x: e.clientX, y: e.clientY }, grabPoint, started: false, positions: null }
      gestureRef.current = gesture
    },
    [topLayerImages, middleLayerImages, selectedIds, setSelectedIds, canMove, mapPoint, finish]
  )

  // Leaving the map mid-drag (scene switch, unmount) drops the drag.
  useEffect(() => () => gestureRef.current?.cancel(), [])

  return { dragPositions: preview, startItemDrag }
}

function samePositions(a: ReadonlyMap<string, Point>, b: ReadonlyMap<string, Point>): boolean {
  if (a.size !== b.size) return false
  for (const [id, p] of a) {
    const q = b.get(id)
    if (!q || q.x !== p.x || q.y !== p.y) return false
  }
  return true
}
