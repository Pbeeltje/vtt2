import { describe, expect, it } from "vitest"
import { cellPathData, gridCellsAlongLine, simplifyPoints, smoothPath } from "@/app/lib/stroke"
import { rescalePath } from "@/lib/scene-model"

/** Same rule as POST /api/drawings: SVG path data only. */
const SVG_PATH = /^[MLHVCSQTAZmlhvcsqtaz0-9eE.,\s+-]+$/

describe("smoothPath", () => {
  it("is empty without points", () => {
    expect(smoothPath([])).toBe("")
  })

  it("draws a single point as a tiny segment so it shows as a dot", () => {
    expect(smoothPath([{ x: 10, y: 20 }])).toBe("M10,20 L10.1,20")
  })

  it("joins two points with a line", () => {
    expect(smoothPath([{ x: 0, y: 0 }, { x: 5, y: 5 }])).toBe("M0,0 L5,5")
  })

  it("curves through midpoints and ends on the last point", () => {
    const d = smoothPath([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 10 }])
    expect(d).toBe("M0,0 Q10,0 10,5 Q10,10 15,10 L20,10")
  })

  it("rounds to one decimal, stays valid for the server and rescales with the scene", () => {
    const d = smoothPath([{ x: 1.23456, y: 2.98765 }, { x: 3.33333, y: 4.44444 }, { x: 5.55555, y: 6.66666 }])
    expect(d).toBe("M1.2,3 Q3.3,4.4 4.4,5.6 L5.6,6.7")
    expect(SVG_PATH.test(d)).toBe(true)
    expect(rescalePath(d, 2)).toBe("M2.4,6 Q6.6,8.8 8.8,11.2 L11.2,13.4")
  })
})

describe("simplifyPoints", () => {
  it("drops points on a straight line and keeps the ends", () => {
    const line = Array.from({ length: 50 }, (_, i) => ({ x: i, y: i * 2 }))
    expect(simplifyPoints(line, 0.5)).toEqual([line[0], line[49]])
  })

  it("keeps corners", () => {
    const corner = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 10, y: 10 },
    ]
    expect(simplifyPoints(corner, 0.5)).toEqual([corner[0], corner[2], corner[4]])
  })

  it("keeps detail larger than the tolerance", () => {
    const wobble = Array.from({ length: 21 }, (_, i) => ({ x: i, y: i % 2 === 0 ? 0 : 3 }))
    expect(simplifyPoints(wobble, 1)).toHaveLength(21)
  })

  it("handles a very long stroke without recursion", () => {
    const long = Array.from({ length: 100_000 }, (_, i) => ({ x: i, y: Math.sin(i / 10) * 20 }))
    const out = simplifyPoints(long, 0.5)
    expect(out.length).toBeGreaterThan(2)
    expect(out.length).toBeLessThan(long.length)
  })
})

describe("grid cells", () => {
  it("fills every cell between two far apart samples", () => {
    expect(gridCellsAlongLine(0, 0, 3, 1)).toEqual([[0, 0], [1, 0], [2, 1], [3, 1]])
    expect(gridCellsAlongLine(2, 2, 2, 2)).toEqual([[2, 2]])
  })

  it("draws a cell as a closed square", () => {
    expect(cellPathData(2, 3, 50)).toBe("M100,150h50v50h-50Z")
  })
})
