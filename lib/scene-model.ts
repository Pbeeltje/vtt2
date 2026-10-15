// The scene's map state (DMImage.SceneData JSON), shared by the API routes and the browser.
// No Node or React imports: both sides use these helpers.
import type { LayerImage } from "../app/types/layerImage"
import type { DarknessPath } from "../app/components/main-content/DarknessLayer"

export const DEFAULT_GRID_SIZE = 50
export const DEFAULT_GRID_COLOR = "rgba(0,0,0,0.1)"
export const DEFAULT_BORDER_SIZE = 0.2

export interface SceneState {
  gridSize: number
  gridColor: string
  elements: { middleLayer: LayerImage[]; topLayer: LayerImage[] }
  scale: number
  borderSize: number
  darknessPaths: DarknessPath[]
  isDarknessLayerVisible: boolean
  /** Bumped by the server on every write; saves must name the version they started from. */
  version: number
  savedAt?: string
}

/** State for a scene that has no saved data yet (grid hidden until the DM picks a colour). */
export function emptySceneState(): SceneState {
  return {
    gridSize: DEFAULT_GRID_SIZE,
    gridColor: "transparent",
    elements: { middleLayer: [], topLayer: [] },
    scale: 1,
    borderSize: DEFAULT_BORDER_SIZE,
    darknessPaths: [],
    isDarknessLayerVisible: false,
    version: 0,
  }
}

const finite = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback

/** Normalizes stored or received scene data; fills defaults for older saves. */
export function normalizeSceneState(data: unknown): SceneState {
  if (!data || typeof data !== "object") return emptySceneState()
  const d = data as Record<string, any>
  return {
    gridSize: finite(d.gridSize, DEFAULT_GRID_SIZE),
    gridColor: typeof d.gridColor === "string" && d.gridColor ? d.gridColor : DEFAULT_GRID_COLOR,
    elements: {
      middleLayer: Array.isArray(d.elements?.middleLayer) ? d.elements.middleLayer : [],
      topLayer: Array.isArray(d.elements?.topLayer) ? d.elements.topLayer : [],
    },
    scale: finite(d.scale, 1),
    borderSize: typeof d.borderSize === "number" && d.borderSize >= 0 ? d.borderSize : DEFAULT_BORDER_SIZE,
    darknessPaths: Array.isArray(d.darknessPaths) ? compactDarknessPaths(d.darknessPaths) : [],
    isDarknessLayerVisible: Boolean(d.isDarknessLayerVisible),
    version: typeof d.version === "number" && Number.isInteger(d.version) ? d.version : 0,
    ...(typeof d.savedAt === "string" ? { savedAt: d.savedAt } : {}),
  }
}

/** The order DarknessLayer draws fog ops in: oldest first, ties broken by id. */
function darknessRenderOrder(a: DarknessPath, b: DarknessPath): number {
  const t = (a.createdAt || "").localeCompare(b.createdAt || "")
  if (t !== 0) return t
  return String(a.id ?? "").localeCompare(String(b.id ?? ""))
}

const rectKey = (r: NonNullable<DarknessPath["cellRect"]>) => `${r.x},${r.y},${r.width},${r.height}`

/**
 * Drops fog ops that can't change what the mask looks like, so painting the same cells over and
 * over doesn't grow the scene forever. Both rules keep the rendered mask the same:
 * - a cell op is fully redrawn by any later cell op with the same rect, so only the last one stays;
 * - paint before the first erase is fog on fog (the mask starts as all fog), so it goes.
 * The second rule runs on what the first leaves, so compacting again changes nothing.
 * Survivors keep their array order. Returns `paths` itself when nothing is dropped.
 */
export function compactDarknessPaths(paths: DarknessPath[]): DarknessPath[] {
  const ordered = paths.filter((p) => p && typeof p === "object").sort(darknessRenderOrder)
  const lastForRect = new Map<string, DarknessPath>()
  for (const p of ordered) if (p.cellRect) lastForRect.set(rectKey(p.cellRect), p)
  const dropped = new Set<DarknessPath>()
  let erased = false
  for (const p of ordered) {
    if (p.cellRect && lastForRect.get(rectKey(p.cellRect)) !== p) dropped.add(p)
    else if (p.type === "erase") erased = true
    else if (p.type === "paint" && !erased) dropped.add(p)
  }
  return dropped.size === 0 ? paths : paths.filter((p) => !dropped.has(p))
}

/**
 * What the scene lists (GET /api/scenes, GET /api/images) carry instead of the whole SceneData:
 * enough for the scene settings dialog, "clear scene data", and the DM's start scene.
 */
export type SceneSummary = { HasSceneData: boolean; Scale: number; BorderSize: number; SavedAt: string | null }

export function sceneSummary(state: SceneState | null): SceneSummary {
  return {
    HasSceneData: state !== null,
    Scale: state?.scale ?? 1,
    BorderSize: state?.borderSize ?? DEFAULT_BORDER_SIZE,
    SavedAt: state?.savedAt ?? null,
  }
}

export function parseSceneData(raw: string | null | undefined): SceneState {
  if (!raw) return emptySceneState()
  try {
    return normalizeSceneState(JSON.parse(raw))
  } catch {
    return emptySceneState()
  }
}

/** The character a token stands for. Older tokens only carry it inside `character`. */
export function tokenCharacterId(token: Partial<LayerImage> | undefined | null): number | null {
  const id = Number(token?.characterId ?? token?.character?.CharacterId)
  return Number.isInteger(id) && id > 0 ? id : null
}

/** Everything that matters for "did the map change", ignoring version bookkeeping and key order. */
export function sceneContentKey(state: SceneState): string {
  return JSON.stringify([
    state.gridSize,
    state.gridColor,
    state.elements.middleLayer,
    state.elements.topLayer,
    state.scale,
    state.borderSize,
    state.darknessPaths,
    state.isDarknessLayerVisible,
  ])
}

type WithId = { id: string }

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Three-way merge of a list of id'd items. Local edits (relative to `base`) win; otherwise the
 * remote version is taken. Items added on either side are kept; items deleted on either side go.
 */
function mergeById<T extends WithId>(base: T[], local: T[], remote: T[]): T[] {
  const baseById = new Map(base.map((item) => [item.id, item]))
  const localById = new Map(local.map((item) => [item.id, item]))
  const remoteIds = new Set(remote.map((item) => item.id))
  const merged: T[] = []
  for (const remoteItem of remote) {
    const localItem = localById.get(remoteItem.id)
    const baseItem = baseById.get(remoteItem.id)
    if (localItem) {
      merged.push(baseItem && sameJson(localItem, baseItem) ? remoteItem : localItem)
    } else if (!baseItem) {
      merged.push(remoteItem) // added remotely
    } // else: deleted locally
  }
  for (const localItem of local) {
    if (!remoteIds.has(localItem.id) && !baseById.has(localItem.id)) merged.push(localItem) // added locally
  }
  return merged
}

function pick<T>(base: T, local: T, remote: T): T {
  return sameJson(local, base) ? remote : local
}

/**
 * Combine local unsaved changes with a newer remote version of the same scene. `base` is the
 * last version both sides agreed on. The result carries the remote version number.
 */
export function mergeSceneStates(base: SceneState, local: SceneState, remote: SceneState): SceneState {
  return {
    gridSize: pick(base.gridSize, local.gridSize, remote.gridSize),
    gridColor: pick(base.gridColor, local.gridColor, remote.gridColor),
    elements: {
      middleLayer: mergeById(base.elements.middleLayer, local.elements.middleLayer, remote.elements.middleLayer),
      topLayer: mergeById(base.elements.topLayer, local.elements.topLayer, remote.elements.topLayer),
    },
    scale: pick(base.scale, local.scale, remote.scale),
    borderSize: pick(base.borderSize, local.borderSize, remote.borderSize),
    darknessPaths: mergeById(base.darknessPaths, local.darknessPaths, remote.darknessPaths),
    isDarknessLayerVisible: pick(base.isDarknessLayerVisible, local.isDarknessLayerVisible, remote.isDarknessLayerVisible),
    version: remote.version,
    ...(remote.savedAt ? { savedAt: remote.savedAt } : {}),
  }
}

/** Multiplies every "x,y" coordinate pair in an SVG path string. */
export function rescalePath(path: string, factor: number): string {
  return path.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_m, x, y) =>
    `${parseFloat(x) * factor},${parseFloat(y) * factor}`
  )
}

/** Moves everything on the map to match a new scene scale (sizes stay grid-based). */
export function rescaleSceneState(state: SceneState, newScale: number): SceneState {
  const factor = newScale / (state.scale || 1)
  if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return { ...state, scale: newScale }
  const move = (item: LayerImage): LayerImage => ({ ...item, x: item.x * factor, y: item.y * factor })
  return {
    ...state,
    scale: newScale,
    elements: {
      middleLayer: state.elements.middleLayer.map(move),
      topLayer: state.elements.topLayer.map(move),
    },
    darknessPaths: state.darknessPaths.map((p) => ({
      ...p,
      ...(p.path ? { path: rescalePath(p.path, factor) } : {}),
      ...(p.strokeWidth ? { strokeWidth: p.strokeWidth * factor } : {}),
      ...(p.cellRect
        ? {
            cellRect: {
              x: p.cellRect.x * factor,
              y: p.cellRect.y * factor,
              width: p.cellRect.width * factor,
              height: p.cellRect.height * factor,
            },
          }
        : {}),
    })),
  }
}
