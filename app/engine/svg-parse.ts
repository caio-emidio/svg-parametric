import { XMLParser } from 'fast-xml-parser'
import type { Contour, FillRule, Issue, SvgParseResult, SvgShape, Vec2 } from './types'
import { IDENTITY, multiply, parseTransform, type Matrix } from './transform'
import { flattenPath } from './flatten'
import { parseStrokeWidth, strokePolylineToOutline } from './stroke-outline'

/**
 * Parses SVG text into closed polygon contours.
 *
 * The SVG is only ever read as data (no DOM insertion, no script execution, no external loading), so
 * uploaded content cannot run code. Unsupported features produce warnings instead of being silently dropped.
 */
export function parseSvg(text: string): SvgParseResult {
  const warnings: Issue[] = []
  const errors: Issue[] = []
  const warned = new Set<string>()
  const warn = (code: string, message: string) => {
    if (warned.has(code)) return
    warned.add(code)
    warnings.push({ code, message })
  }
  const fail = (code: string, message: string): SvgParseResult => ({ shapes: [], warnings, errors: [{ code, message }, ...errors], bounds: null })

  if (!text || !text.trim()) return fail('EMPTY_SVG', 'The file is empty.')
  if (text.length > 20_000_000) return fail('SVG_TOO_LARGE', 'The SVG file is too large (limit 20 MB).')

  let tree: any[]
  try {
    const parser = new XMLParser({
      preserveOrder: true,
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      processEntities: false,
      ignoreDeclaration: true,
      ignorePiTags: true,
      removeNSPrefix: true
    })
    tree = parser.parse(text, true) as any[]
  } catch (e) {
    return fail('INVALID_SVG', `The file is not valid SVG/XML: ${(e as Error).message}`)
  }

  const root = tree.find(n => n.svg !== undefined)
  if (!root) return fail('NOT_SVG', 'The file does not contain an <svg> root element.')

  // Collect the first pass: raw paths with metadata, so curve tolerance can depend on overall extent.
  interface Raw {
    id: string
    label: string
    subpaths: { d?: string, points?: Vec2[], closed: boolean, matrix: Matrix }[]
    fillRule: FillRule
    strokeOnly?: boolean
    strokeWidth?: number
  }
  const raws: Raw[] = []
  let counter = 0

  const attrs = (node: any): Record<string, string> => {
    const out: Record<string, string> = {}
    const a = node[':@'] ?? {}
    for (const k of Object.keys(a)) out[k.slice(2)] = String(a[k])
    if (out.style) {
      for (const decl of out.style.split(';')) {
        const i = decl.indexOf(':')
        if (i > 0) out[decl.slice(0, i).trim()] = decl.slice(i + 1).trim()
      }
    }
    return out
  }
  const num = (v: string | undefined, d = 0) => {
    if (v === undefined) return d
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : d
  }

  interface Inherited { matrix: Matrix, fill: string, stroke: string, strokeWidth: number, fillRule: FillRule, display: boolean }

  const walk = (nodes: any[], inh: Inherited) => {
    for (const node of nodes) {
      const tag = Object.keys(node).find(k => k !== ':@')
      if (!tag) continue
      const a = attrs(node)
      const children: any[] = Array.isArray(node[tag]) ? node[tag] : []
      const matrix = multiply(inh.matrix, parseTransform(a.transform, n => warn('UNSUPPORTED_TRANSFORM', `Unsupported transform "${n}" ignored.`)))
      const fill = a.fill ?? inh.fill
      const stroke = a.stroke ?? inh.stroke
      const strokeWidth = parseStrokeWidth(a['stroke-width'], inh.strokeWidth)
      const fillRule: FillRule = (a['fill-rule'] ?? (inh.fillRule === 'EvenOdd' ? 'evenodd' : 'nonzero')) === 'evenodd' ? 'EvenOdd' : 'NonZero'
      const display = inh.display && a.display !== 'none' && a.visibility !== 'hidden'
      const next: Inherited = { matrix, fill, stroke, strokeWidth, fillRule, display }

      if (a.mask || a['clip-path'] || a.filter) warn('UNSUPPORTED_EFFECT', 'Masks, clipping paths and filters are not supported and are ignored.')

      switch (tag) {
        case 'svg': case 'g': case 'a': case 'switch':
          walk(children, next); continue
        case 'defs': case 'symbol': case 'marker': case 'pattern': case 'title': case 'desc': case 'metadata': case 'linearGradient': case 'radialGradient': case 'sodipodi:namedview': case 'namedview':
          continue
        case 'clipPath': case 'mask':
          warn('UNSUPPORTED_EFFECT', 'Masks, clipping paths and filters are not supported and are ignored.'); continue
        case 'script': case 'foreignObject':
          warn('SCRIPT_REMOVED', `<${tag}> content was ignored for safety.`); continue
        case 'style':
          warn('CSS_IGNORED', 'Embedded <style> sheets are not interpreted; shapes are read using their attributes only.'); continue
        case 'text': case 'tspan': case 'textPath':
          warn('TEXT_UNSUPPORTED', 'Text is not supported. Convert text to paths (Inkscape: Path → Object to Path) before uploading.'); continue
        case 'image':
          warn('IMAGE_UNSUPPORTED', 'Embedded or linked images are ignored.'); continue
        case 'use':
          warn('USE_UNSUPPORTED', '<use> references are not supported and were skipped. Unlink clones before exporting.'); continue
      }
      if (!display) continue

      const id = a.id || `${tag}-${++counter}`
      const label = a.id ? `${a.id} (${tag})` : `${tag} ${counter}`
      const filled = fill !== 'none'
      const stroked = stroke !== 'none' && stroke !== undefined && stroke !== ''
      let raw: Raw | null = null
      let strokeOnly = false

      switch (tag) {
        case 'path':
          if (!a.d) break
          raw = { id, label, fillRule, subpaths: [{ d: a.d, closed: false, matrix }] }
          break
        case 'polygon': {
          const pts = pointsOf(a.points)
          raw = { id, label, fillRule, subpaths: [{ points: pts, closed: true, matrix }] }
          break
        }
        case 'polyline': {
          const pts = pointsOf(a.points)
          if (!filled && !stroked) { warn('OPEN_PATH', `Open polyline "${id}" with no fill was skipped.`); break }
          if (filled) warn('OPEN_PATH_CLOSED', 'Open polylines/paths with a fill were closed automatically.')
          raw = { id, label, fillRule, subpaths: [{ points: pts, closed: false, matrix }] }
          break
        }
        case 'line': {
          const x1 = num(a.x1), y1 = num(a.y1), x2 = num(a.x2), y2 = num(a.y2)
          if (!stroked) { warn('OPEN_PATH', 'Lines are open paths and were skipped.'); break }
          raw = { id, label, fillRule, subpaths: [{ points: [[x1, y1], [x2, y2]], closed: false, matrix }] }
          break
        }
        case 'rect': {
          const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height)
          if (w <= 0 || h <= 0) break
          let rx = a.rx !== undefined ? num(a.rx) : num(a.ry), ry = a.ry !== undefined ? num(a.ry) : rx
          rx = Math.min(Math.max(rx, 0), w / 2); ry = Math.min(Math.max(ry, 0), h / 2)
          const d = rx > 0 && ry > 0
            ? `M${x + rx} ${y}H${x + w - rx}A${rx} ${ry} 0 0 1 ${x + w} ${y + ry}V${y + h - ry}A${rx} ${ry} 0 0 1 ${x + w - rx} ${y + h}H${x + rx}A${rx} ${ry} 0 0 1 ${x} ${y + h - ry}V${y + ry}A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`
            : `M${x} ${y}H${x + w}V${y + h}H${x}Z`
          raw = { id, label, fillRule, subpaths: [{ d, closed: true, matrix }] }
          break
        }
        case 'circle': case 'ellipse': {
          const cx = num(a.cx), cy = num(a.cy)
          const rx = tag === 'circle' ? num(a.r) : num(a.rx), ry = tag === 'circle' ? rx : num(a.ry)
          if (rx <= 0 || ry <= 0) break
          const d = `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`
          raw = { id, label, fillRule, subpaths: [{ d, closed: true, matrix }] }
          break
        }
        default:
          warn('UNKNOWN_ELEMENT', `Unsupported element <${tag}> was ignored.`)
      }
      if (raw) {
        if (!filled) {
          if (!stroked) {
            warn('STROKE_ONLY', `Shape "${id}" has no fill and no stroke and was skipped.`)
            continue
          }
          strokeOnly = true
        }
        raws.push({ ...raw, strokeOnly, strokeWidth: strokeOnly ? strokeWidth : 0 })
      }
      if (children.length) walk(children, next)
    }
  }

  walk([root], { matrix: IDENTITY, fill: 'black', stroke: 'none', strokeWidth: 1, fillRule: 'NonZero', display: true })

  // Rough extent from control points for choosing a flattening tolerance.
  let extent = 0
  for (const r of raws) {
    for (const s of r.subpaths) {
      const nums = s.d ? (s.d.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number) : (s.points ?? []).flat()
      for (const n of nums) extent = Math.max(extent, Math.abs(n))
    }
  }
  const tolerance = Math.max(extent, 1e-6) * 0.0004

  const shapes: SvgShape[] = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  let openClosed = false
  let strokeExpanded = false
  for (const r of raws) {
    const contours: Contour[] = []
    const halfStroke = (r.strokeWidth ?? 0) / 2
    for (const s of r.subpaths) {
      const subs = s.d
        ? flattenPath(s.d, s.matrix, tolerance)
        : [{ points: (s.points ?? []).map(p => [s.matrix[0] * p[0] + s.matrix[2] * p[1] + s.matrix[4], s.matrix[1] * p[0] + s.matrix[3] * p[1] + s.matrix[5]] as Vec2), closed: s.closed }]
      for (const sub of subs) {
        if (!sub.closed && s.d) openClosed = true
        let pts = dedupe(sub.points)
        if (r.strokeOnly && halfStroke > 0) {
          const outline = strokePolylineToOutline(pts, halfStroke, sub.closed || s.closed)
          if (!outline || outline.length < 3) continue
          strokeExpanded = true
          pts = outline
        }
        if (pts.length < 3 || isFlat(pts)) continue
        if (pts.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1]))) {
          errors.push({ code: 'BAD_NUMBERS', message: `Shape "${r.id}" contains invalid coordinates.` })
          continue
        }
        contours.push(pts)
      }
    }
    if (!contours.length) continue
    for (const c of contours) for (const [x, y] of c) {
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
    }
    shapes.push({ id: r.id, label: r.label, contours, fillRule: r.fillRule })
  }
  if (openClosed) warn('OPEN_PATH_CLOSED', 'Open subpaths in filled paths were closed automatically (as SVG renderers do for fills).')
  if (strokeExpanded) warn('STROKE_EXPANDED', 'Stroke-only shapes were converted to filled outlines using the stroke width.')

  if (!shapes.length) {
    errors.unshift({ code: 'NO_CLOSED_PATHS', message: 'No usable closed shapes were found. Use filled paths, polygons, rectangles, circles or ellipses.' })
  }
  return { shapes, warnings, errors, bounds: shapes.length ? { minX, minY, maxX, maxY } : null }
}

function pointsOf(v: string | undefined): Vec2[] {
  const n = (v ?? '').split(/[\s,]+/).filter(Boolean).map(Number)
  const pts: Vec2[] = []
  for (let i = 0; i + 1 < n.length; i += 2) pts.push([n[i]!, n[i + 1]!])
  return pts
}

function dedupe(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of pts) {
    const q = out[out.length - 1]
    if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-9) out.push(p)
  }
  while (out.length > 1 && Math.hypot(out[0]![0] - out[out.length - 1]![0], out[0]![1] - out[out.length - 1]![1]) <= 1e-9) out.pop()
  return out
}

export function area(c: Contour): number {
  let s = 0
  for (let i = 0; i < c.length; i++) {
    const a = c[i]!, b = c[(i + 1) % c.length]!
    s += a[0] * b[1] - b[0] * a[1]
  }
  return s / 2
}

function isFlat(pts: Vec2[]): boolean {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const [x, y] of pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y) }
  return maxX - minX < 1e-9 || maxY - minY < 1e-9
}
