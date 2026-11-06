// Geometry of things on the map: where tokens and images go when moved, and how big the play area is.
// Pure functions, shared by dragging, arrow-key nudges and grid resizing (see tests/map-items.test.ts).
import type { LayerImage } from "../types/layerImage"
import { sizeMultiplier } from "./tokens"

export type Point = { x: number; y: number }

/** A map item and which layer it lives on: tokens (top layer) snap to the grid, images (middle layer) move freely. */
export type PlacedItem = { item: LayerImage; isToken: boolean }

/** The top-left corner of the grid cell containing `value` (one axis). */
export const snapDown = (value: number, gridSize: number) => Math.floor(value / gridSize) * gridSize

/** Where an item lands when moved by (dx, dy): tokens snap to the cell their corner ends up in. */
export function movedPosition({ item, isToken }: PlacedItem, dx: number, dy: number, gridSize: number): Point {
  const x = item.x + dx
  const y = item.y + dy
  return isToken ? { x: snapDown(x, gridSize), y: snapDown(y, gridSize) } : { x, y }
}

/**
 * New positions for a group drag. `grabbed` is the item under the cursor, `grabPoint` the map point
 * where it was picked up, and (dx, dy) how far the cursor has moved since, in map pixels.
 *
 * Grabbing a token moves the group in whole cells: the cell of the token under the cursor follows
 * the cursor's cell, so a big token doesn't jump when picked up by its far corner, and the group
 * keeps its formation. Grabbing an image moves the group freely; tokens in it still snap, always
 * from where they started (so slow drags can't lose movement to rounding).
 */
export function dragPositions(
  items: PlacedItem[],
  grabbed: PlacedItem,
  grabPoint: Point,
  dx: number,
  dy: number,
  gridSize: number
): Map<string, Point> {
  let moveX = dx
  let moveY = dy
  if (grabbed.isToken) {
    moveX = snapDown(grabPoint.x + dx, gridSize) - snapDown(grabPoint.x, gridSize)
    moveY = snapDown(grabPoint.y + dy, gridSize) - snapDown(grabPoint.y, gridSize)
  }
  return new Map(items.map((placed) => [placed.item.id, movedPosition(placed, moveX, moveY, gridSize)]))
}

/** True when every item in `positions` is already where `items` has it (a drag that went nowhere). */
export function isSamePlace(items: PlacedItem[], positions: ReadonlyMap<string, Point>): boolean {
  return items.every(({ item }) => {
    const p = positions.get(item.id)
    return !p || (p.x === item.x && p.y === item.y)
  })
}

/** `layer` with the given items moved; the same array when none of them is in it. */
export function withPositions(layer: LayerImage[], positions: ReadonlyMap<string, Point>): LayerImage[] {
  let changed = false
  const next = layer.map((item) => {
    const p = positions.get(item.id)
    if (!p || (p.x === item.x && p.y === item.y)) return item
    changed = true
    return { ...item, x: p.x, y: p.y }
  })
  return changed ? next : layer
}

/**
 * Items after the grid size changes: everything snaps to the new grid, and items sized to the old
 * grid (character tokens by their size, plain one-cell tokens) are resized to match.
 */
export function fitToGrid(layer: LayerImage[], oldGridSize: number, newGridSize: number): LayerImage[] {
  return layer.map((item) => {
    const cells = sizeMultiplier(item.character?.Size)
    const fitsGrid = item.width === oldGridSize * cells && item.height === oldGridSize * cells
    return {
      ...item,
      x: snapDown(item.x, newGridSize),
      y: snapDown(item.y, newGridSize),
      ...(fitsGrid ? { width: newGridSize * cells, height: newGridSize * cells } : {}),
    }
  })
}

/** The scene's map image plus the border around it, in scene pixels. */
export type PlayArea = {
  /** The map image, as scaled by the scene. */
  mapWidth: number
  mapHeight: number
  /** Empty border on each side (left/right, top/bottom). */
  borderX: number
  borderY: number
  /** Everything: map plus both borders. */
  width: number
  height: number
}

export function playArea(mapWidth: number, mapHeight: number, borderFraction: number): PlayArea {
  const borderX = Math.round(mapWidth * borderFraction)
  const borderY = Math.round(mapHeight * borderFraction)
  return { mapWidth, mapHeight, borderX, borderY, width: mapWidth + borderX * 2, height: mapHeight + borderY * 2 }
}
