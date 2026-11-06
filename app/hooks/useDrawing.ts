import { useCallback, useEffect, useRef } from "react"
import { clientToGridLogical } from "@/lib/utils"
import { toast } from "@/components/ui/use-toast"
import type { NewDrawingData } from "./useDrawings"
import type { DarknessPath, DrawingObject } from "../types/drawing"
import type { MapInteractionTool } from "../types/mapTool"
import { isFogCellTool, isFogStrokeTool, isCanvasStrokeTool } from "../types/mapTool"
import { cellPathData, gridCellsAlongLine, simplifyPoints, smoothPath, type Point } from "../lib/stroke"
import { startGesture, type Gesture } from "./map/gesture"

/** Samples closer than this many screen pixels to the last kept one are noise, not shape. */
const MIN_SAMPLE_SCREEN_PX = 1.5
/** How far (screen pixels) the saved line may stray from the drawn one when simplified. */
const SIMPLIFY_SCREEN_PX = 0.6

/** The stroke in progress. Lives in a ref: moving the pointer never re-renders React. */
type Stroke =
  | {
      kind: "line"
      tool: MapInteractionTool
      color: string
      fogBrushDiameter: number
      fogFill: boolean
      rect: DOMRect
      zoom: number
      points: Point[]
    }
  | {
      kind: "cells"
      tool: MapInteractionTool
      gridSize: number
      rect: DOMRect
      zoom: number
      visited: Set<string>
      cells: Array<[number, number]>
      last: { ix: number; iy: number }
      /** Preview path data, grown one square at a time. */
      d: string
    }

function newId(prefix: string) {
  // Not crypto.randomUUID(): it only exists on https/localhost, and LAN players use http.
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`
}

/** Coalesced samples of a pointer move (all the points a fast mouse reported since the last frame). */
function samplesOf(e: PointerEvent): Array<{ clientX: number; clientY: number }> {
  const coalesced = typeof e.getCoalescedEvents === "function" ? e.getCoalescedEvents() : []
  return coalesced.length > 0 ? coalesced : [e]
}

interface UseDrawingProps {
  gridRef: React.RefObject<HTMLDivElement>
  gridSize: number
  fogBrushDiameter: number
  /** Fog brush strokes also fill the area they enclose. */
  fogFill: boolean
  currentTool: MapInteractionTool
  currentColor: string
  zoomLevel: number
  currentSceneId?: number | null
  currentUserId?: number | null
  currentUserRole?: string | null
  setSelectedDrawingIds: React.Dispatch<React.SetStateAction<string[]>>
  onDrawingAdd: (data: NewDrawingData) => void | Promise<void>
  /** New fog ops, appended to the scene's fog in one update when the stroke ends. */
  onDarknessAdd?: (ops: DarknessPath[]) => void
}

/**
 * Freehand drawing and fog painting on the map.
 *
 * A stroke starts on the grid's mousedown and runs as a map gesture (./map/gesture): it keeps
 * going past the grid's edge and ends wherever the button is released (Escape cancels).
 * Every move re-reads where the grid is and its zoom, so scrolling or zooming mid-stroke keeps
 * the line under the pointer.
 * While drawing, the preview `<path>` (`previewRef`) is updated directly, once per frame, and the
 * finished stroke is committed once: a smoothed, simplified drawing, or one batch of fog ops.
 */
export function useDrawing({
  gridRef,
  gridSize,
  fogBrushDiameter,
  fogFill,
  currentTool,
  currentColor,
  zoomLevel,
  currentSceneId,
  currentUserId,
  currentUserRole,
  setSelectedDrawingIds,
  onDrawingAdd,
  onDarknessAdd,
}: UseDrawingProps) {
  const previewRef = useRef<SVGPathElement>(null)
  const strokeRef = useRef<Stroke | null>(null)
  const frameRef = useRef<number | null>(null)
  const gestureRef = useRef<Gesture | null>(null)
  // Commit with the latest callbacks, whatever render the stroke started in.
  const commitTargets = useRef({ onDrawingAdd, onDarknessAdd })
  commitTargets.current = { onDrawingAdd, onDarknessAdd }
  const zoomRef = useRef(zoomLevel || 1)
  zoomRef.current = zoomLevel || 1

  /** Where the grid is on screen right now (it moves when the map scrolls or zooms). */
  const refreshFrame = useCallback(() => {
    const stroke = strokeRef.current
    const rect = gridRef.current?.getBoundingClientRect()
    if (!stroke || !rect) return
    stroke.rect = rect
    stroke.zoom = zoomRef.current
  }, [gridRef])

  const renderPreview = useCallback(() => {
    frameRef.current = null
    const stroke = strokeRef.current
    const preview = previewRef.current
    if (!stroke || !preview) return
    preview.setAttribute("d", stroke.kind === "line" ? smoothPath(stroke.points) : stroke.d)
  }, [])

  const schedulePreview = useCallback(() => {
    if (frameRef.current === null) frameRef.current = requestAnimationFrame(renderPreview)
  }, [renderPreview])

  const addSample = useCallback((clientX: number, clientY: number) => {
    const stroke = strokeRef.current
    if (!stroke) return
    const p = clientToGridLogical(clientX, clientY, stroke.rect, stroke.zoom)
    if (stroke.kind === "line") {
      const last = stroke.points[stroke.points.length - 1]
      const min = MIN_SAMPLE_SCREEN_PX / stroke.zoom
      if (last && (p.x - last.x) ** 2 + (p.y - last.y) ** 2 < min * min) return
      stroke.points.push(p)
      return
    }
    const ix = Math.floor(p.x / stroke.gridSize)
    const iy = Math.floor(p.y / stroke.gridSize)
    if (ix === stroke.last.ix && iy === stroke.last.iy) return
    for (const [cx, cy] of gridCellsAlongLine(stroke.last.ix, stroke.last.iy, ix, iy)) {
      const key = `${cx},${cy}`
      if (stroke.visited.has(key)) continue
      stroke.visited.add(key)
      stroke.cells.push([cx, cy])
      stroke.d += cellPathData(cx, cy, stroke.gridSize)
    }
    stroke.last = { ix, iy }
  }, [])

  /** Ends the stroke; commits it (with the release point, if any) unless cancelled. */
  const finish = useCallback(
    (commit: boolean, release?: PointerEvent): boolean => {
      if (commit && release) {
        refreshFrame()
        addSample(release.clientX, release.clientY)
      }
      const stroke = strokeRef.current
      strokeRef.current = null
      gestureRef.current = null
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
      previewRef.current?.removeAttribute("d")
      if (!stroke || !commit) return false

      const { onDrawingAdd: addDrawing, onDarknessAdd: addDarkness } = commitTargets.current
      const createdAt = new Date().toISOString()
      if (stroke.kind === "cells") {
        if (!addDarkness || stroke.cells.length === 0) return true
        const type = stroke.tool === "darknessEraserCell" ? "erase" : "paint"
        const base = newId("darkness")
        addDarkness(
          stroke.cells.map(([ix, iy], i) => ({
            id: `${base}-${i}`,
            type,
            createdAt,
            cellRect: { x: ix * stroke.gridSize, y: iy * stroke.gridSize, width: stroke.gridSize, height: stroke.gridSize },
          }))
        )
        return true
      }

      const path = smoothPath(simplifyPoints(stroke.points, SIMPLIFY_SCREEN_PX / stroke.zoom))
      if (!path) return true
      if (isFogStrokeTool(stroke.tool)) {
        // Fill closes the loop back to the start, so the enclosed area is covered as well.
        const fill = stroke.fogFill && stroke.points.length > 2
        addDarkness?.([
          {
            id: newId("darkness"),
            path: fill ? `${path} Z` : path,
            type: stroke.tool === "darknessEraser" ? "erase" : "paint",
            createdAt,
            strokeWidth: stroke.fogBrushDiameter,
            ...(fill ? { fill: true } : {}),
          },
        ])
      } else {
        void addDrawing({ path, color: stroke.color })
      }
      return true
    },
    [refreshFrame, addSample]
  )

  const startDrawing = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const cells = isFogCellTool(currentTool)
      if (!isCanvasStrokeTool(currentTool) && !cells) return
      if (e.button !== 0 || e.altKey) return
      if (!currentSceneId || currentUserId === null || currentUserId === undefined) {
        toast({ title: "Not ready yet", description: "The scene is still loading. Try again in a moment." })
        return
      }
      if (cells && !onDarknessAdd) return
      const rect = gridRef.current?.getBoundingClientRect()
      if (!rect) return
      const gesture = startGesture(e, {
        kind: "stroke",
        button: 0,
        onMove: (ev) => {
          refreshFrame()
          for (const sample of samplesOf(ev)) addSample(sample.clientX, sample.clientY)
          schedulePreview()
        },
        onEnd: finish,
      })
      if (!gesture) return
      gestureRef.current = gesture
      e.preventDefault()

      const zoom = zoomLevel || 1
      const p = clientToGridLogical(e.clientX, e.clientY, rect, zoom)
      if (cells) {
        const ix = Math.floor(p.x / gridSize)
        const iy = Math.floor(p.y / gridSize)
        strokeRef.current = {
          kind: "cells",
          tool: currentTool,
          gridSize,
          rect,
          zoom,
          visited: new Set([`${ix},${iy}`]),
          cells: [[ix, iy]],
          last: { ix, iy },
          d: cellPathData(ix, iy, gridSize),
        }
      } else {
        strokeRef.current = { kind: "line", tool: currentTool, color: currentColor, fogBrushDiameter, fogFill, rect, zoom, points: [p] }
      }

      schedulePreview()
    },
    [currentTool, currentColor, currentSceneId, currentUserId, fogBrushDiameter, fogFill, gridRef, gridSize, zoomLevel, onDarknessAdd, addSample, schedulePreview, finish, refreshFrame]
  )

  // Leaving the map mid-stroke (scene switch, unmount) drops the stroke.
  useEffect(() => () => gestureRef.current?.cancel(), [])

  const handleDrawingClick = useCallback(
    (e: React.MouseEvent<SVGPathElement>, drawing: DrawingObject) => {
      e.stopPropagation()
      if (currentTool === "brush") return

      if (currentUserRole === "player" && drawing.createdBy !== currentUserId) {
        toast({ title: "Permission Denied", description: "You can only select your own drawings.", variant: "destructive" })
        return
      }

      if (e.shiftKey) {
        setSelectedDrawingIds((prev) => (prev.includes(drawing.id) ? prev.filter((id) => id !== drawing.id) : [...prev, drawing.id]))
      } else {
        setSelectedDrawingIds([drawing.id])
      }
    },
    [currentTool, currentUserRole, currentUserId, setSelectedDrawingIds]
  )

  return { previewRef, startDrawing, handleDrawingClick }
}
