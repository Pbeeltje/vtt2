import { describe, expect, it } from "vitest"
import {
  compactDarknessPaths,
  emptySceneState,
  mergeSceneStates,
  normalizeSceneState,
  parseSceneData,
  rescaleSceneState,
  sceneContentKey,
  tokenCharacterId,
  type SceneState,
} from "@/lib/scene-model"
import type { LayerImage } from "@/app/types/layerImage"
import type { DarknessPath } from "@/app/components/main-content/DarknessLayer"

const token = (id: string, x: number, y = 0): LayerImage => ({ id, url: "/t.png", x, y })

function scene(topLayer: LayerImage[], extra: Partial<SceneState> = {}): SceneState {
  return { ...emptySceneState(), elements: { middleLayer: [], topLayer }, ...extra }
}

describe("parseSceneData", () => {
  it("fills defaults for older saves without version or fog", () => {
    const state = parseSceneData(JSON.stringify({ gridSize: 40, elements: { topLayer: [token("a", 1)] } }))
    expect(state.version).toBe(0)
    expect(state.gridSize).toBe(40)
    expect(state.darknessPaths).toEqual([])
    expect(state.elements.middleLayer).toEqual([])
  })

  it("treats bad JSON as an empty scene", () => {
    expect(parseSceneData("{oops")).toEqual(emptySceneState())
  })
})

describe("tokenCharacterId", () => {
  it("reads characterId or the nested character id used by older tokens", () => {
    expect(tokenCharacterId({ characterId: 5 })).toBe(5)
    expect(tokenCharacterId({ character: { CharacterId: 7 } as LayerImage["character"] })).toBe(7)
    expect(tokenCharacterId({})).toBeNull()
  })
})

describe("mergeSceneStates", () => {
  const base = scene([token("dm", 0), token("player", 0)], { version: 3 })

  it("keeps the DM's edit and the player's concurrent move", () => {
    const local = scene([token("dm", 100), token("player", 0)], { version: 3 })
    const remote = scene([token("dm", 0), token("player", 50)], { version: 4 })
    const merged = mergeSceneStates(base, local, remote)
    expect(merged.elements.topLayer).toEqual([token("dm", 100), token("player", 50)])
    expect(merged.version).toBe(4)
  })

  it("keeps items added on either side and drops items deleted on either side", () => {
    const local = scene([token("player", 0), token("new-local", 1)], { version: 3 }) // deleted "dm"
    const remote = scene([token("dm", 0), token("new-remote", 2)], { version: 4 }) // deleted "player"
    const merged = mergeSceneStates(base, local, remote)
    expect(merged.elements.topLayer.map((t) => t.id)).toEqual(["new-remote", "new-local"])
  })

  it("takes remote scalar changes unless changed locally", () => {
    const local = { ...base, gridColor: "red" }
    const remote = { ...base, gridSize: 70, gridColor: "blue", version: 4 }
    const merged = mergeSceneStates(base, local, remote)
    expect(merged.gridColor).toBe("red")
    expect(merged.gridSize).toBe(70)
  })
})

describe("rescaleSceneState", () => {
  it("moves tokens, images and fog with the map", () => {
    const state = scene([token("a", 100, 50)], {
      scale: 1,
      darknessPaths: [
        { id: "f", type: "erase", createdAt: "", path: "M10,20 L30,40", strokeWidth: 10 },
        { id: "c", type: "paint", createdAt: "", cellRect: { x: 50, y: 50, width: 50, height: 50 } },
      ],
    })
    const scaled = rescaleSceneState(state, 2)
    expect(scaled.scale).toBe(2)
    expect(scaled.elements.topLayer[0]).toMatchObject({ x: 200, y: 100 })
    expect(scaled.darknessPaths[0]).toMatchObject({ path: "M20,40 L60,80", strokeWidth: 20 })
    expect(scaled.darknessPaths[1].cellRect).toEqual({ x: 100, y: 100, width: 100, height: 100 })
  })

  it("ignores version bookkeeping when comparing content", () => {
    expect(sceneContentKey(scene([], { version: 1 }))).toBe(sceneContentKey(scene([], { version: 9, savedAt: "x" })))
  })
})

describe("compactDarknessPaths", () => {
  const SIZE = 12
  const time = (at: number) => `2026-01-01T00:00:${String(at).padStart(2, "0")}`
  const cell = (id: string, type: DarknessPath["type"], at: number, x: number, y: number, w = 1, h = 1): DarknessPath =>
    ({ id, type, createdAt: time(at), cellRect: { x, y, width: w, height: h } })
  const stroke = (id: string, type: DarknessPath["type"], at: number, path: string, strokeWidth = 2): DarknessPath =>
    ({ id, type, createdAt: time(at), path, strokeWidth })

  /**
   * Draws the fog mask the way DarknessLayer does (all fog, then each op in time order, newest
   * wins per pixel) on a small pixel grid. A stroke covers the bounding box of its points grown by
   * half its width: crude, but compaction never looks at stroke shapes, so any fixed shape will do.
   */
  function render(paths: DarknessPath[]): string {
    const px = Array.from({ length: SIZE * SIZE }, () => "#")
    const ordered = [...paths].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
    for (const p of ordered) {
      let box: number[] | null = null
      if (p.cellRect) box = [p.cellRect.x, p.cellRect.y, p.cellRect.x + p.cellRect.width, p.cellRect.y + p.cellRect.height]
      else if (p.path) {
        const pts = [...p.path.matchAll(/(-?\d+),(-?\d+)/g)].map((m) => [Number(m[1]), Number(m[2])])
        const r = (p.strokeWidth ?? 50) / 2
        const xs = pts.map((q) => q[0])
        const ys = pts.map((q) => q[1])
        box = [Math.min(...xs) - r, Math.min(...ys) - r, Math.max(...xs) + r, Math.max(...ys) + r]
      }
      if (!box) continue
      for (let y = Math.max(0, Math.ceil(box[1])); y < Math.min(SIZE, box[3]); y++)
        for (let x = Math.max(0, Math.ceil(box[0])); x < Math.min(SIZE, box[2]); x++) px[y * SIZE + x] = p.type === "erase" ? "." : "#"
    }
    return px.join("")
  }

  it("keeps only the last op for a cell painted and erased over and over", () => {
    const paths = [cell("a", "erase", 1, 2, 2), cell("b", "paint", 2, 2, 2), cell("c", "erase", 3, 2, 2), cell("d", "paint", 4, 2, 2), cell("e", "erase", 5, 2, 2)]
    const compacted = compactDarknessPaths(paths)
    expect(compacted.map((p) => p.id)).toEqual(["e"])
    expect(render(compacted)).toBe(render(paths))
  })

  it("drops earlier ops on the same cell even with strokes in between, but keeps the strokes", () => {
    const paths = [cell("a", "erase", 1, 3, 3), stroke("s", "erase", 2, "M0,3 L8,3"), cell("b", "paint", 3, 3, 3)]
    const compacted = compactDarknessPaths(paths)
    expect(compacted.map((p) => p.id)).toEqual(["s", "b"])
    expect(render(compacted)).toBe(render(paths))
  })

  it("drops paint that comes before the first erase (fog on fog)", () => {
    const paths = [stroke("p1", "paint", 1, "M1,1 L5,5"), cell("p2", "paint", 2, 0, 0), cell("e", "erase", 3, 0, 0, 4, 4), cell("p3", "paint", 4, 1, 1)]
    const compacted = compactDarknessPaths(paths)
    expect(compacted.map((p) => p.id)).toEqual(["e", "p3"])
    expect(render(compacted)).toBe(render(paths))
    expect(compactDarknessPaths([cell("p", "paint", 1, 0, 0)])).toEqual([])
  })

  it("orders by time, not array position, and keeps the survivors' array order", () => {
    const paths = [cell("late", "paint", 9, 1, 1), stroke("mid", "erase", 5, "M5,5 L6,6"), cell("early", "erase", 1, 1, 1)]
    const compacted = compactDarknessPaths(paths)
    expect(compacted.map((p) => p.id)).toEqual(["late", "mid"])
    expect(render(compacted)).toBe(render(paths))
  })

  it("keeps different rects that share a corner, and returns the same array when nothing goes", () => {
    const paths = [cell("a", "erase", 1, 0, 0, 2, 2), cell("b", "paint", 2, 0, 0, 1, 1)]
    expect(compactDarknessPaths(paths)).toBe(paths)
  })

  it("never changes the rendered mask (random fog histories), and is idempotent", () => {
    let seed = 42
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2 ** 31
      return seed % n
    }
    for (let run = 0; run < 300; run++) {
      const paths: DarknessPath[] = []
      const count = 1 + rand(25)
      for (let i = 0; i < count; i++) {
        const type = rand(2) ? "erase" : "paint"
        const at = rand(60)
        paths.push(
          rand(4) === 0
            ? stroke(`s${i}`, type, at, `M${rand(SIZE)},${rand(SIZE)} L${rand(SIZE)},${rand(SIZE)}`, 1 + rand(3))
            : cell(`c${i}`, type, at, rand(4) * 3, rand(4) * 3, 3, 3)
        )
      }
      const compacted = compactDarknessPaths(paths)
      expect(render(compacted)).toBe(render(paths))
      expect(compactDarknessPaths(compacted)).toBe(compacted)
    }
  })

  it("is applied when scene data is normalized, and merges with the client's uncompacted copy", () => {
    const fog = [cell("a", "erase", 1, 0, 0), cell("b", "paint", 2, 0, 0), cell("c", "erase", 3, 5, 5)]
    const stored = normalizeSceneState({ darknessPaths: fog, version: 2 })
    expect(stored.darknessPaths.map((p) => p.id)).toEqual(["c"])

    // The DM's client still holds the ops it saved (its base), plus a new one. A remote update
    // carrying the compacted list must neither bring the dropped ops back nor lose the new one.
    const base = scene([], { darknessPaths: fog, version: 2 })
    const local = scene([], { darknessPaths: [...fog, cell("d", "erase", 4, 7, 7)], version: 2 })
    const merged = mergeSceneStates(base, local, { ...stored, version: 3 })
    expect(merged.darknessPaths.map((p) => p.id)).toEqual(["c", "d"])
    expect(render(merged.darknessPaths)).toBe(render(local.darknessPaths))
  })
})
