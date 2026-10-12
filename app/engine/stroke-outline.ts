import type { Contour, Vec2 } from './types'

/** Expand a polyline into a closed outline polygon (stroke → filled shape). */
export function strokePolylineToOutline(points: Vec2[], halfWidth: number, closed: boolean): Contour | null {
  if (points.length < 2 || !(halfWidth > 0)) return null
  const n = points.length
  const left: Vec2[] = []
  const right: Vec2[] = []

  const segCount = closed ? n : n - 1
  for (let i = 0; i < segCount; i++) {
    const a = points[i]!
    const b = points[(i + 1) % n]!
    const dx = b[0] - a[0], dy = b[1] - a[1]
    const len = Math.hypot(dx, dy)
    if (len < 1e-12) continue
    const nx = -dy / len * halfWidth, ny = dx / len * halfWidth
    left.push([a[0] + nx, a[1] + ny])
    right.push([a[0] - nx, a[1] - ny])
  }
  if (left.length < 2) return null

  if (!closed) {
    const last = points[n - 1]!
    const prev = points[n - 2]!
    const dx = last[0] - prev[0], dy = last[1] - prev[1]
    const len = Math.hypot(dx, dy) || 1
    const nx = -dy / len * halfWidth, ny = dx / len * halfWidth
    left.push([last[0] + nx, last[1] + ny])
    right.push([last[0] - nx, last[1] - ny])
    const first = points[0]!
    const next = points[1]!
    const dx0 = next[0] - first[0], dy0 = next[1] - first[1]
    const len0 = Math.hypot(dx0, dy0) || 1
    const nx0 = -dy0 / len0 * halfWidth, ny0 = dx0 / len0 * halfWidth
    return [...left, ...right.reverse(), [first[0] - nx0, first[1] - ny0]]
  }

  return [...left, ...right.reverse()]
}

export function parseStrokeWidth(raw: string | undefined, inherited: number): number {
  if (raw === undefined || raw === '') return inherited
  const n = parseFloat(String(raw).replace(/px|mm|pt$/i, '').trim())
  return Number.isFinite(n) && n > 0 ? n : inherited
}
