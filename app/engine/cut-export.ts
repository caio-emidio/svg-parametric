import type { Contour, CutLayer } from './types'
import type { ManifoldModule } from './manifold-loader'

function contoursFromCs(cs: { toPolygons(): number[][][] }): Contour[] {
  return cs.toPolygons().map(p => p.map(v => [v[0]!, v[1]!] as Contour[0]))
}

function offsetContours(M: ManifoldModule, contours: Contour[], delta: number): Contour[] {
  if (!contours.length || Math.abs(delta) < 1e-9) return contours
  const { CrossSection } = M
  let cs = CrossSection.ofPolygons(contours, 'NonZero')
  cs = cs.offset(delta, 'Round')
  if (cs.isEmpty()) return []
  return contoursFromCs(cs)
}

export interface CutLayerInput {
  outline: Contour[]
  cavityOutline: Contour[]
  dividerOutlines: Contour[][]
  kerf: number
}

/** Builds 2D cut layers with optional kerf compensation (half kerf per side). */
export function buildCutLayers(M: ManifoldModule, input: CutLayerInput): CutLayer[] {
  const k = Math.max(0, input.kerf)
  const half = k / 2
  const outer = offsetContours(M, input.outline, half)
  const cavity = offsetContours(M, input.cavityOutline, -half)
  const layers: CutLayer[] = []
  if (outer.length) layers.push({ id: 'outer', label: 'Outer cut', stroke: '#2563eb', contours: outer })
  if (cavity.length) layers.push({ id: 'cavity', label: 'Cavity cut', stroke: '#dc2626', contours: cavity })
  for (let i = 0; i < input.dividerOutlines.length; i++) {
    const c = input.dividerOutlines[i]!
    if (c.length) layers.push({ id: `divider-${i}`, label: `Divider ${i + 1}`, stroke: '#ea580c', contours: c })
  }
  return layers
}

function contourToPathD(c: Contour): string {
  if (!c.length) return ''
  const [x0, y0] = c[0]!
  let d = `M ${x0} ${y0}`
  for (let i = 1; i < c.length; i++) {
    const [x, y] = c[i]!
    d += ` L ${x} ${y}`
  }
  return `${d} Z`
}

/** Stroke = cut lines (laser/CNC). Filled = solid silhouette with holes (print, vinyl, etc.). */
export type Svg2dExportStyle = 'stroke' | 'filled'

function boundsFromContours(contours: Contour[], fallback: { width: number, height: number }) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of contours) for (const [x, y] of c) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x)
    minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  if (!Number.isFinite(minX)) {
    const hw = fallback.width / 2, hh = fallback.height / 2
    return { minX: -hw, minY: -hh, maxX: hw, maxY: hh }
  }
  return { minX, minY, maxX, maxY }
}

function pathsForStyle(layers: CutLayer[], style: Svg2dExportStyle, silhouette?: Contour[]): string[] {
  if (style === 'stroke') {
    const paths: string[] = []
    for (const layer of layers) {
      for (const c of layer.contours) {
        const d = contourToPathD(c)
        if (d) paths.push(`<path d="${d}" fill="none" stroke="${layer.stroke}" stroke-width="0.2" data-layer="${layer.id}"/>`)
      }
    }
    return paths
  }
  const paths: string[] = []
  const fillContours = silhouette?.length ? silhouette : layers.find(l => l.id === 'outer')?.contours ?? []
  let d = ''
  for (const c of fillContours) d += contourToPathD(c)
  if (d) paths.push(`<path d="${d}" fill="#000000" fill-rule="evenodd" data-style="filled"/>`)
  for (const layer of layers) {
    if (!layer.id.startsWith('divider')) continue
    for (const c of layer.contours) {
      const pd = contourToPathD(c)
      if (pd) paths.push(`<path d="${pd}" fill="none" stroke="${layer.stroke}" stroke-width="0.2" data-layer="${layer.id}"/>`)
    }
  }
  return paths
}

/** Serialises cut layers to an SVG document (mm user units, y-up matching the engine). */
export function cutLayersToSvg(
  layers: CutLayer[],
  size: { width: number, height: number },
  style: Svg2dExportStyle = 'stroke',
  /** Tray footprint polygons; required for a fully filled silhouette (not just the wall ring). */
  silhouette?: Contour[]
): string {
  const boundsContours: Contour[] = style === 'filled' && silhouette?.length
    ? [...silhouette, ...layers.flatMap(l => l.id.startsWith('divider') ? l.contours : [])]
    : layers.flatMap(l => l.contours)
  const { minX, minY, maxX, maxY } = boundsFromContours(boundsContours, size)
  const pad = 2
  const w = maxX - minX + pad * 2
  const h = maxY - minY + pad * 2
  const paths = pathsForStyle(layers, style, silhouette)
  // Flip y for SVG (y down): transform group
  const tx = -minX + pad
  const ty = maxY + pad
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w.toFixed(4)} ${h.toFixed(4)}" width="${w.toFixed(2)}mm" height="${h.toFixed(2)}mm">`,
    `<g transform="translate(${tx} ${ty}) scale(1 -1)">`,
    ...paths,
    '</g>',
    '</svg>'
  ].join('\n')
}

export function cutFilename(svgName: string, width: number, height: number, style: Svg2dExportStyle = 'stroke'): string {
  const base = svgName.replace(/\.svg$/i, '').replace(/[^\w.-]+/g, '_') || 'tray'
  const tag = style === 'filled' ? 'filled' : 'cut'
  return `${base}_${tag}_${Math.round(width)}x${Math.round(height)}mm.svg`
}
