import svgpath from 'svgpath'
import type { Vec2 } from './types'
import { apply, type Matrix } from './transform'

export interface FlatSubpath {
  points: Vec2[]
  closed: boolean
}

/** Converts SVG path data to polylines (curves flattened to `tolerance` SVG units). Arcs become cubics first. */
export function flattenPath(d: string, matrix: Matrix, tolerance: number): FlatSubpath[] {
  const out: FlatSubpath[] = []
  let cur: FlatSubpath | null = null
  const push = (x: number, y: number) => cur?.points.push(apply(matrix, [x, y]))
  const begin = (x: number, y: number) => {
    cur = { points: [], closed: false }
    out.push(cur)
    push(x, y)
  }
  const ensure = (x: number, y: number) => { if (!cur) begin(x, y) }
  const sp = svgpath(d).abs().unarc().unshort()
  sp.iterate((seg: any[], _i: number, x: number, y: number) => {
    const cmd = seg[0] as string
    switch (cmd) {
      case 'M': begin(seg[1], seg[2]); break
      case 'L': ensure(x, y); push(seg[1], seg[2]); break
      case 'H': ensure(x, y); push(seg[1], y); break
      case 'V': ensure(x, y); push(x, seg[1]); break
      case 'Q': ensure(x, y); quad(x, y, seg[1], seg[2], seg[3], seg[4], tolerance, push); break
      case 'C': ensure(x, y); cubic(x, y, seg[1], seg[2], seg[3], seg[4], seg[5], seg[6], tolerance, push); break
      case 'Z':
        if (cur) {
          (cur as FlatSubpath).closed = true
          cur = null
        }
        break
    }
  })
  return out
}

function quad(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, tol: number, push: (x: number, y: number) => void) {
  const len = Math.hypot(x1 - x0, y1 - y0) + Math.hypot(x2 - x1, y2 - y1)
  const dev = Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2) / 4
  const n = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(dev / tol)), Math.ceil(len / tol / 8)))
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    push(u * u * x0 + 2 * u * t * x1 + t * t * x2, u * u * y0 + 2 * u * t * y1 + t * t * y2)
  }
}

function cubic(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, tol: number, push: (x: number, y: number) => void) {
  const dx = Math.max(Math.hypot(x0 - 2 * x1 + x2, y0 - 2 * y1 + y2), Math.hypot(x1 - 2 * x2 + x3, y1 - 2 * y2 + y3))
  const n = Math.max(1, Math.min(256, Math.ceil(Math.sqrt(0.75 * dx / tol))))
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t
    push(
      u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
      u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3
    )
  }
}
