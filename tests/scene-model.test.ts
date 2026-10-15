import { describe, expect, it } from "vitest"
import {
  emptySceneState,
  mergeSceneStates,
  parseSceneData,
  rescaleSceneState,
  sceneContentKey,
  tokenCharacterId,
  type SceneState,
} from "@/lib/scene-model"
import type { LayerImage } from "@/app/types/layerImage"

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
