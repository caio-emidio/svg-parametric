import type { Contour } from './types'

/** Returns true when two non-adjacent edges of the polygon properly cross each other. */
export function isSelfIntersecting(c: Contour): boolean {
  const n = c.length
  if (n < 4) return false
  // sweep over x-sorted edges to avoid a full O(n²) scan on dense contours
  const edges = c.map((p, i) => {
    const q = c[(i + 1) % n]!
    return { i, ax: p[0], ay: p[1], bx: q[0], by: q[1], minX: Math.min(p[0], q[0]), maxX: Math.max(p[0], q[0]) }
  }).sort((a, b) => a.minX - b.minX)
  const active: typeof edges = []
  for (const e of edges) {
    for (let k = active.length - 1; k >= 0; k--) if (active[k]!.maxX < e.minX) active.splice(k, 1)
    for (const f of active) {
      const d = Math.abs(e.i - f.i)
      if (d === 1 || d === n - 1) continue
      if (segmentsCross(e.ax, e.ay, e.bx, e.by, f.ax, f.ay, f.bx, f.by)) return true
    }
    active.push(e)
  }
  return false
}

function segmentsCross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number): boolean {
  const o = (px: number, py: number, qx: number, qy: number, rx: number, ry: number) => (qx - px) * (ry - py) - (qy - py) * (rx - px)
  const d1 = o(cx, cy, dx, dy, ax, ay), d2 = o(cx, cy, dx, dy, bx, by)
  const d3 = o(ax, ay, bx, by, cx, cy), d4 = o(ax, ay, bx, by, dx, dy)
  return ((d1 > 1e-12 && d2 < -1e-12) || (d1 < -1e-12 && d2 > 1e-12)) && ((d3 > 1e-12 && d4 < -1e-12) || (d3 < -1e-12 && d4 > 1e-12))
}
