"use client"

import { memo, useEffect, useRef } from "react"
import { darknessRenderOrder } from "@/lib/scene-model"
import type { DarknessPath } from "../../types/drawing"

export type { DarknessPath }

/** Backing-store cap (about 64 MB of RGBA), so a huge map at high zoom can't exhaust memory. */
const MAX_CANVAS_PIXELS = 16_000_000
/** Brush diameter of fog strokes saved before the diameter was stored. */
const LEGACY_STROKE_WIDTH = 50

interface DarknessLayerProps {
  /** The whole play area (map plus border), in scene pixels: the space fog ops are drawn in. */
  width: number
  height: number
  darknessPaths: DarknessPath[]
  /** The DM sees the fog at half strength so the map stays readable underneath. */
  isDM: boolean
  zoomLevel: number
}

/** Device pixels per scene pixel: sharp at the current zoom, within the memory cap. Quarter steps, so a zoom nudge rarely redraws. */
function canvasResolution(width: number, height: number, zoomLevel: number): number {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  const wanted = dpr * Math.max(1, zoomLevel || 1)
  const cap = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, width * height))
  return Math.max(0.25, Math.floor(Math.min(wanted, cap) * 4) / 4)
}

function drawOp(ctx: CanvasRenderingContext2D, op: DarknessPath) {
  // Paint lays fog down; erase cuts it away, revealing the map. Later ops win.
  ctx.globalCompositeOperation = op.type === "erase" ? "destination-out" : "source-over"
  if (op.cellRect) {
    ctx.fillRect(op.cellRect.x, op.cellRect.y, op.cellRect.width, op.cellRect.height)
  } else if (op.path) {
    const path = new Path2D(op.path)
    if (op.fill) ctx.fill(path)
    ctx.lineWidth = op.strokeWidth ?? LEGACY_STROKE_WIDTH
    ctx.stroke(path)
  }
}

/** `next` only adds ops after `drawn`, all of them later in render order than `last`: draw just those. */
function appendedOps(drawn: DarknessPath[], next: DarknessPath[], last: DarknessPath | null): DarknessPath[] | null {
  if (next.length < drawn.length) return null
  for (let i = 0; i < drawn.length; i++) if (next[i] !== drawn[i]) return null
  const added = next.slice(drawn.length).sort(darknessRenderOrder)
  if (last && added.length > 0 && darknessRenderOrder(added[0], last) < 0) return null
  return added
}

/**
 * Fog of war, painted on one canvas. The canvas starts all fog and replays the fog ops oldest
 * first. It only redraws when the fog, the map size or the resolution changes; a stroke that adds
 * ops on top is drawn on its own, without replaying the rest.
 */
function DarknessLayer({ width, height, darknessPaths, isDM, zoomLevel }: DarknessLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawnRef = useRef<{ ops: DarknessPath[]; last: DarknessPath | null } | null>(null)
  const resolution = canvasResolution(width, height, zoomLevel)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return
    const pxWidth = Math.max(1, Math.round(width * resolution))
    const pxHeight = Math.max(1, Math.round(height * resolution))
    const sameSize = canvas.width === pxWidth && canvas.height === pxHeight
    const drawn = drawnRef.current

    const added = sameSize && drawn ? appendedOps(drawn.ops, darknessPaths, drawn.last) : null
    let ops: DarknessPath[]
    if (added) {
      ops = added
    } else {
      // Full redraw. Setting the size clears the canvas and resets the context.
      canvas.width = pxWidth
      canvas.height = pxHeight
      ctx.setTransform(resolution, 0, 0, resolution, 0, 0)
      ctx.globalCompositeOperation = "source-over"
      ctx.fillStyle = "#000"
      ctx.fillRect(0, 0, width, height)
      ops = [...darknessPaths].sort(darknessRenderOrder)
    }
    ctx.fillStyle = "#000"
    ctx.strokeStyle = "#000"
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    for (const op of ops) drawOp(ctx, op)
    ctx.globalCompositeOperation = "source-over"
    const newest = ops.length > 0 ? ops[ops.length - 1] : null
    drawnRef.current = { ops: darknessPaths, last: added ? newest ?? drawn?.last ?? null : newest }
  }, [darknessPaths, width, height, resolution])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute left-0 top-0"
      style={{ width, height, zIndex: 45, opacity: isDM ? 0.5 : 1 }}
      aria-hidden
    />
  )
}

export default memo(DarknessLayer)
