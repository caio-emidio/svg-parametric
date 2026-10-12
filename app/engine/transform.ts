import type { Vec2 } from './types'

/** 2D affine matrix [a b c d e f] as in SVG `matrix(a b c d e f)`. */
export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function multiply(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5]
  ]
}

export function apply(m: Matrix, [x, y]: Vec2): Vec2 {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

const rad = (d: number) => d * Math.PI / 180

/** Parses an SVG `transform` attribute. Unknown functions are reported through `onUnknown`. */
export function parseTransform(value: string | undefined, onUnknown?: (name: string) => void): Matrix {
  let m: Matrix = IDENTITY
  if (!value) return m
  const re = /([a-zA-Z]+)\s*\(([^)]*)\)/g
  let match: RegExpExecArray | null
  while ((match = re.exec(value))) {
    const name = match[1]!
    const a = match[2]!.split(/[\s,]+/).filter(Boolean).map(Number)
    if (a.some(Number.isNaN)) { onUnknown?.(name); continue }
    let t: Matrix | null = null
    switch (name) {
      case 'matrix': if (a.length === 6) t = a as Matrix; break
      case 'translate': t = [1, 0, 0, 1, a[0] ?? 0, a[1] ?? 0]; break
      case 'scale': t = [a[0] ?? 1, 0, 0, a[1] ?? a[0] ?? 1, 0, 0]; break
      case 'rotate': {
        const c = Math.cos(rad(a[0] ?? 0)), s = Math.sin(rad(a[0] ?? 0))
        const r: Matrix = [c, s, -s, c, 0, 0]
        t = a.length === 3
          ? multiply(multiply([1, 0, 0, 1, a[1]!, a[2]!], r), [1, 0, 0, 1, -a[1]!, -a[2]!])
          : r
        break
      }
      case 'skewX': t = [1, 0, Math.tan(rad(a[0] ?? 0)), 1, 0, 0]; break
      case 'skewY': t = [1, Math.tan(rad(a[0] ?? 0)), 0, 1, 0, 0]; break
    }
    if (!t) { onUnknown?.(name); continue }
    m = multiply(m, t)
  }
  return m
}
