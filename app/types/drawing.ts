/** A freehand drawing on a scene, stored per drawing (see /api/drawings) and synced live. */
export interface DrawingObject {
  id: string
  /** SVG path data in scene pixels. */
  path: string
  color: string
  createdBy: number
  createdAt: string
  sceneId: number
}

/** One fog-of-war edit. The layer replays them oldest first: paint adds fog, erase reveals. */
export interface DarknessPath {
  id: string
  type: "erase" | "paint"
  createdAt: string
  /** Stroke-based edit (omit when using cellRect). */
  path?: string
  /** Brush diameter in scene pixels; defaults to 50 for legacy paths. */
  strokeWidth?: number
  /** Single grid cell in scene coordinates. */
  cellRect?: { x: number; y: number; width: number; height: number }
}
