/** Pure helpers for freehand strokes and grid-cell fog strokes. Coordinates are scene pixels. */

export interface Point {
  x: number
  y: number
}

/** One decimal is far below a screen pixel at any zoom and keeps saved paths short. */
const round = (v: number) => Math.round(v * 10) / 10
const fmt = (p: Point) => `${round(p.x)},${round(p.y)}`

/** Squared distance from `p` to the segment a-b. */
function segmentDistanceSq(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  let t = lenSq === 0 ? 0 : ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  const ex = a.x + t * dx - p.x
  const ey = a.y + t * dy - p.y
  return ex * ex + ey * ey
}

/**
 * Ramer–Douglas–Peucker: drops points that lie within `tolerance` of the line through their
 * neighbours. Keeps the first and last point. Iterative, so long strokes can't overflow the stack.
 */
export function simplifyPoints(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2 || tolerance <= 0) return points.slice()
  const tolSq = tolerance * tolerance
  const keep = new Uint8Array(points.length)
  keep[0] = 1
  keep[points.length - 1] = 1
  const stack: Array<[number, number]> = [[0, points.length - 1]]
  while (stack.length > 0) {
    const [first, last] = stack.pop()!
    let maxSq = 0
    let index = -1
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistanceSq(points[i], points[first], points[last])
      if (d > maxSq) {
        maxSq = d
        index = i
      }
    }
    if (index !== -1 && maxSq > tolSq) {
      keep[index] = 1
      stack.push([first, index], [index, last])
    }
  }
  return points.filter((_, i) => keep[i] === 1)
}

/**
 * SVG path data for a smooth line through `points`: quadratic curves with each sample as the
 * control point and the midpoints between samples as the joins, so the line has no corners.
 * A single point becomes a dot (a tiny segment: canvas drops zero-length ones, round caps don't).
 */
export function smoothPath(points: Point[]): string {
  if (points.length === 0) return ""
  const first = points[0]
  if (points.length === 1) return `M${fmt(first)} L${fmt({ x: first.x + 0.1, y: first.y })}`
  if (points.length === 2) return `M${fmt(first)} L${fmt(points[1])}`
  const parts = [`M${fmt(first)}`]
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i]
    const next = points[i + 1]
    parts.push(`Q${fmt(p)} ${fmt({ x: (p.x + next.x) / 2, y: (p.y + next.y) / 2 })}`)
  }
  parts.push(`L${fmt(points[points.length - 1])}`)
  return parts.join(" ")
}

/** Grid cells from (gx0,gy0) to (gx1,gy1), inclusive (Bresenham), so a fast drag leaves no gaps. */
export function gridCellsAlongLine(gx0: number, gy0: number, gx1: number, gy1: number): Array<[number, number]> {
  const cells: Array<[number, number]> = []
  let x = gx0
  let y = gy0
  const dx = Math.abs(gx1 - gx0)
  const dy = Math.abs(gy1 - gy0)
  const sx = gx0 < gx1 ? 1 : gx0 > gx1 ? -1 : 0
  const sy = gy0 < gy1 ? 1 : gy0 > gy1 ? -1 : 0
  let err = dx - dy
  for (;;) {
    cells.push([x, y])
    if (x === gx1 && y === gy1) break
    const e2 = 2 * err
    if (e2 > -dy) {
      err -= dy
      x += sx
    }
    if (e2 < dx) {
      err += dx
      y += sy
    }
  }
  return cells
}

/** Path data for one grid cell as a closed square, for filling. */
export function cellPathData(ix: number, iy: number, size: number): string {
  return `M${ix * size},${iy * size}h${size}v${size}h${-size}Z`
}
