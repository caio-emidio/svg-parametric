import type { BBox, Contour, Issue, MeshData, SvgShape, TrayParams, TrayResult } from './types'
import type { ManifoldModule } from './manifold-loader'
import { isSelfIntersecting } from './contours'
import { validateMesh } from './mesh-validate'

const MAX_DIM = 2000
const MIN_FEATURE = 0.1

export function validateParams(p: TrayParams): Issue[] {
  const e: Issue[] = []
  const bad = (code: string, message: string) => e.push({ code, message })
  const finite = Object.values(p).every(v => Number.isFinite(v))
  if (!finite) { bad('BAD_PARAMS', 'All parameters must be valid numbers.'); return e }
  if (p.width < 1 || p.height < 1 || p.scale <= 0) bad('BAD_DIMENSIONS', 'Width and height must be at least 1 mm and scale must be positive.')
  if (p.width * p.scale > MAX_DIM || p.height * p.scale > MAX_DIM) bad('BAD_DIMENSIONS', `Dimensions are limited to ${MAX_DIM} mm.`)
  if (p.wallHeight < 1 || p.wallHeight > MAX_DIM) bad('BAD_WALL_HEIGHT', `Wall height must be between 1 and ${MAX_DIM} mm.`)
  if (p.wallThickness < MIN_FEATURE) bad('BAD_WALL_THICKNESS', `Wall thickness must be at least ${MIN_FEATURE} mm.`)
  if (p.bottomThickness < MIN_FEATURE) bad('BAD_BOTTOM', `Bottom thickness must be at least ${MIN_FEATURE} mm.`)
  if (p.bottomThickness >= p.wallHeight) bad('BOTTOM_TOO_THICK', 'Bottom thickness must be smaller than the wall height, otherwise there is no cavity.')
  if (Math.abs(p.taperAngle) > 45) bad('BAD_TAPER', 'Taper angle must be between -45° and 45°.')
  if (p.cornerRadius < 0) bad('BAD_RADIUS', 'Corner radius cannot be negative.')
  return e
}

/**
 * Builds a hollow, open-top tray from SVG shapes.
 *
 * Pipeline: normalise/scale contours → union via fill rule (Clipper2) → optional corner rounding → true inward
 * Clipper2 offset for the cavity → extrude outer solid, subtract cavity (Manifold, always manifold output) →
 * independent mesh validation. Geometry is only returned as exportable when every check passes.
 */
export function generateTray(M: ManifoldModule, shapes: SvgShape[], params: TrayParams): TrayResult {
  const errors: Issue[] = validateParams(params)
  const warnings: Issue[] = []
  if (!shapes.length) errors.push({ code: 'NO_SHAPES', message: 'No shape is selected.' })
  if (errors.length) return { ok: false, errors, warnings }

  // 1. bounds → scale/translate to target size, flip y (SVG y is down)
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of shapes) for (const c of s.contours) for (const [x, y] of c) {
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (y < minY) minY = y; if (y > maxY) maxY = y
  }
  const w0 = maxX - minX, h0 = maxY - minY
  if (!(w0 > 0) || !(h0 > 0)) {
    return { ok: false, errors: [{ code: 'DEGENERATE_SHAPE', message: 'The selected shape has zero width or height.' }], warnings }
  }
  const sx = params.width * params.scale / w0, sy = params.height * params.scale / h0
  const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2
  const transformed = shapes.map(s => ({
    fillRule: s.fillRule,
    contours: s.contours.map(c => c.map(([x, y]) => [(x - cx) * sx, -(y - cy) * sy] as [number, number]))
  }))

  // 2. validate contours
  let selfIntersections = 0
  for (const s of transformed) for (const c of s.contours) if (isSelfIntersecting(c)) selfIntersections++
  if (selfIntersections) {
    warnings.push({ code: 'SELF_INTERSECTING', message: `${selfIntersections} contour(s) intersect themselves. They were resolved with the SVG fill rule, but check that the silhouette looks as intended.` })
  }

  const { CrossSection, Manifold } = M
  const created: { delete(): void }[] = []
  const keep = <T extends { delete(): void }>(o: T): T => { created.push(o); return o }
  try {
    let outer = keep(CrossSection.ofPolygons(transformed[0]!.contours, transformed[0]!.fillRule))
    for (let i = 1; i < transformed.length; i++) {
      outer = keep(outer.add(keep(CrossSection.ofPolygons(transformed[i]!.contours, transformed[i]!.fillRule))))
    }
    if (outer.isEmpty()) {
      return { ok: false, errors: [{ code: 'EMPTY_SHAPE', message: 'The selected shape has no filled area after applying the fill rule.' }], warnings }
    }
    const baseArea = outer.area()

    // 3. optional external corner rounding (morphological opening with a round brush)
    if (params.cornerRadius > 0) {
      const r = params.cornerRadius
      const rounded = keep(keep(outer.offset(-r, 'Round')).offset(r, 'Round'))
      if (rounded.isEmpty()) {
        return { ok: false, errors: [{ code: 'RADIUS_TOO_LARGE', message: 'Corner radius is too large for this shape; the outline would disappear.' }], warnings }
      }
      if (rounded.area() < baseArea * 0.9) {
        warnings.push({ code: 'RADIUS_REMOVES_FEATURES', message: 'Corner radius removes thin features of the outline (more than 10 % of the area).' })
      }
      outer = rounded
    }
    outer = keep(outer.simplify(Math.min(params.width, params.height) * 1e-5))

    // 4. proper inward offset for the cavity
    const t = params.wallThickness
    const inner = keep(outer.offset(-t, 'Round'))
    if (inner.isEmpty() || inner.area() < 1e-6) {
      return { ok: false, errors: [{ code: 'WALL_TOO_THICK', message: `A wall thickness of ${t} mm leaves no interior: the shape is narrower than ${(2 * t).toFixed(1)} mm everywhere. Reduce the wall thickness or enlarge the shape.` }], warnings }
    }
    const reopened = keep(inner.offset(t, 'Round'))
    const lost = keep(outer.subtract(reopened))
    const lostFraction = lost.area() / outer.area()
    if (lostFraction > 0.015) {
      warnings.push({ code: 'NARROW_FEATURES', message: `Some regions (≈${(lostFraction * 100).toFixed(1)} % of the area) are narrower than 2 × wall thickness (${(2 * t).toFixed(1)} mm) and will be solid instead of hollow. Reduce the wall thickness or enlarge the model.` })
    }
    // 5. extrude. Taper scales about the bounding-box centre so the wall grows by ≈ height·tan(angle).
    const H = params.wallHeight, b = params.bottomThickness
    const tan = Math.tan(params.taperAngle * Math.PI / 180)
    const radius = (cs: { area(): number }) => Math.sqrt(cs.area() / Math.PI)
    const around = (cs: typeof outer, height: number, grow: number, z: number) => {
      const bb = cs.bounds()
      const mx = (bb.min[0] + bb.max[0]) / 2, my = (bb.min[1] + bb.max[1]) / 2
      const s = Math.max(0.05, 1 + grow / Math.max(radius(cs), 1e-6))
      const centred = keep(cs.translate([-mx, -my]))
      const solid = keep(centred.extrude(height, 0, 0, [s, s]))
      return keep(solid.translate([mx, my, z]))
    }
    const outerSolid = around(outer, H, H * tan, 0)
    const overshoot = 1
    const cavity = around(inner, H - b + overshoot, (H - b + overshoot) * tan, b)
    const tray = keep(outerSolid.subtract(cavity))

    const status = tray.status()
    if (String(status) !== 'NoError') {
      return { ok: false, errors: [{ code: 'MANIFOLD_ERROR', message: `Geometry kernel reported an invalid solid (${String(status)}).` }], warnings }
    }
    if (tray.isEmpty()) {
      return { ok: false, errors: [{ code: 'EMPTY_RESULT', message: 'Generation produced an empty model.' }], warnings }
    }

    const mesh = tray.getMesh()
    const nProp = mesh.numProp
    const verts = mesh.vertProperties
    const positions = new Float32Array((verts.length / nProp) * 3)
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3] = verts[i * nProp]!
      positions[i * 3 + 1] = verts[i * nProp + 1]!
      positions[i * 3 + 2] = verts[i * nProp + 2]!
    }
    const data: MeshData = { positions, indices: new Uint32Array(mesh.triVerts) }
    const validation = validateMesh(data)

    let lo: [number, number, number] = [Infinity, Infinity, Infinity], hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k]!, positions[i + k]!); hi[k] = Math.max(hi[k]!, positions[i + k]!)
    }
    const bbox: BBox = { min: lo, max: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] }
    const outline: Contour[] = outer.toPolygons().map(p => p.map(v => [v[0], v[1]] as [number, number]))

    if (!validation.ok) {
      errors.push({ code: 'MESH_INVALID', message: `The generated mesh failed validation (open edges: ${validation.openEdges}, non-manifold edges: ${validation.nonManifoldEdges}, inconsistent edges: ${validation.inconsistentEdges}, degenerate triangles: ${validation.degenerateTriangles}). Export is disabled.` })
    }
    if (validation.components > 1) {
      warnings.push({ code: 'MULTIPLE_COMPONENTS', message: `The model consists of ${validation.components} disconnected trays.` })
    }
    return { ok: errors.length === 0, errors, warnings, mesh: data, bbox, validation, outline }
  } finally {
    for (const o of created.reverse()) { try { o.delete() } catch { /* already freed */ } }
  }
}
