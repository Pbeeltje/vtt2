import { describe, expect, it } from "vitest"
import { dragPositions, fitToGrid, isSamePlace, movedPosition, playArea, withPositions, type PlacedItem } from "@/app/lib/map-items"
import type { LayerImage } from "@/app/types/layerImage"

const G = 50
const item = (id: string, x: number, y: number, extra: Partial<LayerImage> = {}): LayerImage => ({ id, url: "/x.png", x, y, width: G, height: G, ...extra })
const token = (id: string, x: number, y: number, extra?: Partial<LayerImage>): PlacedItem => ({ item: item(id, x, y, extra), isToken: true })
const image = (id: string, x: number, y: number): PlacedItem => ({ item: item(id, x, y), isToken: false })

describe("movedPosition", () => {
  it("snaps tokens to the cell their corner lands in, and moves images freely", () => {
    expect(movedPosition(token("t", 50, 50), 30, 74, G)).toEqual({ x: 50, y: 100 })
    expect(movedPosition(image("i", 50, 50), 30, 74, G)).toEqual({ x: 80, y: 124 })
  })
})

describe("dragPositions", () => {
  it("puts a one-cell token in the cell under the cursor", () => {
    const t = token("t", 100, 100)
    // Picked up near its bottom-right corner, dropped in the cell at (200, 50).
    const p = dragPositions([t], t, { x: 145, y: 145 }, 70, -60, G)
    expect(p.get("t")).toEqual({ x: 200, y: 50 })
  })

  it("does not jump a big token picked up by its far corner", () => {
    const big = token("big", 0, 0, { width: 2 * G, height: 2 * G })
    // A small wiggle inside the same cell: nothing moves.
    expect(dragPositions([big], big, { x: 90, y: 90 }, 5, 5, G).get("big")).toEqual({ x: 0, y: 0 })
    // One cell to the right.
    expect(dragPositions([big], big, { x: 90, y: 90 }, 15, 0, G).get("big")).toEqual({ x: 50, y: 0 })
  })

  it("moves a group led by a token in whole cells, keeping its formation", () => {
    const t = token("t", 0, 0)
    const img = image("i", 13, 27)
    const p = dragPositions([t, img], t, { x: 25, y: 25 }, 60, 0, G)
    expect(p.get("t")).toEqual({ x: 50, y: 0 })
    expect(p.get("i")).toEqual({ x: 63, y: 27 })
  })

  it("moves tokens in a group led by an image from where they started, so slow drags add up", () => {
    const img = image("i", 0, 0)
    const t = token("t", 100, 0)
    // However many small steps it took, a 60px drag moves the token one cell.
    expect(dragPositions([img, t], img, { x: 10, y: 10 }, 60, 0, G).get("t")).toEqual({ x: 150, y: 0 })
    expect(dragPositions([img, t], img, { x: 10, y: 10 }, 60, 0, G).get("i")).toEqual({ x: 60, y: 0 })
  })
})

describe("isSamePlace / withPositions", () => {
  it("knows a drag that went nowhere", () => {
    const t = token("t", 50, 50)
    expect(isSamePlace([t], new Map([["t", { x: 50, y: 50 }]]))).toBe(true)
    expect(isSamePlace([t], new Map([["t", { x: 100, y: 50 }]]))).toBe(false)
  })

  it("moves only the listed items, and keeps the layer as-is when none of them is in it", () => {
    const layer = [item("a", 0, 0), item("b", 10, 10)]
    const moved = withPositions(layer, new Map([["b", { x: 20, y: 30 }]]))
    expect(moved[0]).toBe(layer[0])
    expect(moved[1]).toMatchObject({ id: "b", x: 20, y: 30 })
    expect(withPositions(layer, new Map([["zzz", { x: 1, y: 1 }]]))).toBe(layer)
  })
})

describe("fitToGrid", () => {
  it("snaps everything and resizes items that were sized to the old grid", () => {
    const large = item("large", 75, 130, { width: 75, height: 75, character: { Name: "Ogre", Path: "", Guard: 0, MaxGuard: 0, Strength: 0, MaxStrength: 0, Mp: 0, MaxMp: 0, Size: "Large" } })
    const prop = item("prop", 75, 130, { width: 100, height: 100 })
    const [l, p] = fitToGrid([large, prop], G, 60)
    expect(l).toMatchObject({ x: 60, y: 120, width: 90, height: 90 })
    expect(p).toMatchObject({ x: 60, y: 120, width: 100, height: 100 })
  })
})

describe("playArea", () => {
  it("adds the border on every side", () => {
    expect(playArea(1000, 500, 0.2)).toEqual({ mapWidth: 1000, mapHeight: 500, borderX: 200, borderY: 100, width: 1400, height: 700 })
  })
})
