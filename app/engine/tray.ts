import type { BBox, Contour, Issue, MeshData, MeshValidation, SvgShape, TrayParams, TrayResult } from './types'
import type { ManifoldModule } from './manifold-loader'
import { buildCutLayers } from './cut-export'
import { isSelfIntersecting } from './contours'
import { validateMesh } from './mesh-validate'

const MAX_DIM = 2000
const MIN_FEATURE = 0.1

export function validateParams(p: TrayParams): Issue[] {
  const e: Issue[] = []
  const bad = (code: string, message: string) => e.push({ code, message })
  const num = (...vals: number[]) => vals.every(v => Number.isFinite(v))
  const finite = num(
    p.width, p.height, p.scale, p.wallHeight, p.wallThickness, p.bottomThickness, p.taperAngle, p.cornerRadius, p.cutKerf,
    p.dividers.rows, p.dividers.cols, p.dividers.thickness,
    p.lid.thickness, p.lid.clearance, p.lid.lipDepth, p.lid.lipThickness,
    p.exportLayerHeight, p.exportElephantFoot
  )
  if (!finite) { bad('BAD_PARAMS', 'All parameters must be valid numbers.'); return e }
  if (p.width < 1 || p.height < 1 || p.scale <= 0) bad('BAD_DIMENSIONS', 'Width and height must be at least 1 mm and scale must be positive.')
  if (p.width * p.scale > MAX_DIM || p.height * p.scale > MAX_DIM) bad('BAD_DIMENSIONS', `Dimensions are limited to ${MAX_DIM} mm.`)
  if (p.wallHeight < 1 || p.wallHeight > MAX_DIM) bad('BAD_WALL_HEIGHT', `Wall height must be between 1 and ${MAX_DIM} mm.`)
  if (p.wallThickness < MIN_FEATURE) bad('BAD_WALL_THICKNESS', `Wall thickness must be at least ${MIN_FEATURE} mm.`)
  if (p.bottomThickness < MIN_FEATURE) bad('BAD_BOTTOM', `Bottom thickness must be at least ${MIN_FEATURE} mm.`)
  if (p.bottomThickness >= p.wallHeight) bad('BOTTOM_TOO_THICK', 'Bottom thickness must be smaller than the wall height, otherwise there is no cavity.')
  if (Math.abs(p.taperAngle) > 45) bad('BAD_TAPER', 'Taper angle must be between -45° and 45°.')
  if (p.cornerRadius < 0) bad('BAD_RADIUS', 'Corner radius cannot be negative.')
  if (p.cutKerf < 0) bad('BAD_KERF', 'Kerf cannot be negative.')
  if (p.exportLayerHeight < 0.08 || p.exportLayerHeight > 0.4) bad('BAD_EXPORT', 'Export layer height should be between 0.08 and 0.4 mm.')
  if (p.exportElephantFoot < 0 || p.exportElephantFoot > 1) bad('BAD_EXPORT', 'Elephant-foot compensation must be between 0 and 1 mm.')
  if (p.dividers.enabled) {
    if (p.dividers.rows < 1 || p.dividers.cols < 1 || !Number.isInteger(p.dividers.rows) || !Number.isInteger(p.dividers.cols)) {
      bad('BAD_DIVIDERS', 'Compartment rows and columns must be integers ≥ 1.')
    }
    const dt = p.dividers.thickness > 0 ? p.dividers.thickness : p.wallThickness
    if (dt < MIN_FEATURE) bad('BAD_DIVIDER_THICKNESS', `Divider thickness must be at least ${MIN_FEATURE} mm.`)
  }
  if (p.lid.enabled) {
    if (p.lid.thickness < MIN_FEATURE) bad('BAD_LID', `Lid thickness must be at least ${MIN_FEATURE} mm.`)
    if (p.lid.clearance < 0) bad('BAD_LID', 'Lid clearance cannot be negative.')
    if (p.lid.lipDepth < MIN_FEATURE) bad('BAD_LID', `Lip depth must be at least ${MIN_FEATURE} mm.`)
    const lt = p.lid.lipThickness > 0 ? p.lid.lipThickness : p.wallThickness
    if (lt < MIN_FEATURE) bad('BAD_LID', `Lip thickness must be at least ${MIN_FEATURE} mm.`)
    if (p.lid.lipDepth > p.wallHeight - p.bottomThickness) {
      bad('BAD_LID', 'Lip depth must be smaller than the interior wall height (wall height minus bottom thickness).')
    }
  }
  return e
}

function rectContour(minX: number, minY: number, maxX: number, maxY: number): Contour {
  return [[minX, minY], [maxX, minY], [maxX, maxY], [minX, maxY]]
}

function csBounds(cs: { bounds(): { min: number[], max: number[] } }) {
  const bb = cs.bounds()
  return { minX: bb.min[0]!, minY: bb.min[1]!, maxX: bb.max[0]!, maxY: bb.max[1]! }
}

function meshFromManifold(m: { getMesh(): { numProp: number, vertProperties: Float32Array | number[], triVerts: Uint32Array | number[] } }): MeshData {
  const mesh = m.getMesh()
  const nProp = mesh.numProp
  const verts = mesh.vertProperties
  const positions = new Float32Array((verts.length / nProp) * 3)
  for (let i = 0; i < positions.length / 3; i++) {
    positions[i * 3] = verts[i * nProp]!
    positions[i * 3 + 1] = verts[i * nProp + 1]!
    positions[i * 3 + 2] = verts[i * nProp + 2]!
  }
  return { positions, indices: new Uint32Array(mesh.triVerts) }
}

function bboxFromMesh(positions: Float32Array): BBox {
  let lo: [number, number, number] = [Infinity, Infinity, Infinity], hi: [number, number, number] = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3) for (let k = 0; k < 3; k++) {
    lo[k] = Math.min(lo[k]!, positions[i + k]!); hi[k] = Math.max(hi[k]!, positions[i + k]!)
  }
  return { min: lo, max: hi, size: [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]] }
}

function extrudeFlat(M: ManifoldModule, cs: ReturnType<ManifoldModule['CrossSection']['prototype']['translate']>, height: number, z: number) {
  const solid = cs.extrude(height)
  return z ? solid.translate(0, 0, z) : solid
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
    let tray = keep(outerSolid.subtract(cavity))

    const dividerOutlines: Contour[][] = []
    if (params.dividers.enabled && (params.dividers.rows > 1 || params.dividers.cols > 1)) {
      const dt = params.dividers.thickness > 0 ? params.dividers.thickness : t
      const { minX: ix0, minY: iy0, maxX: ix1, maxY: iy1 } = csBounds(inner)
      const innerH = H - b
      const dividerSolids: ReturnType<typeof Manifold.cube>[] = []
      for (let r = 1; r < params.dividers.rows; r++) {
        const y = iy0 + (iy1 - iy0) * r / params.dividers.rows
        const strip = keep(CrossSection.ofPolygons([rectContour(ix0, y - dt / 2, ix1, y + dt / 2)], 'Positive'))
        const clipped = keep(inner.intersect(strip))
        if (!clipped.isEmpty()) {
          dividerOutlines.push(clipped.toPolygons().map(p => p.map(v => [v[0]!, v[1]!] as [number, number])))
          dividerSolids.push(keep(extrudeFlat(M, clipped, innerH, b)))
        }
      }
      for (let c = 1; c < params.dividers.cols; c++) {
        const x = ix0 + (ix1 - ix0) * c / params.dividers.cols
        const strip = keep(CrossSection.ofPolygons([rectContour(x - dt / 2, iy0, x + dt / 2, iy1)], 'Positive'))
        const clipped = keep(inner.intersect(strip))
        if (!clipped.isEmpty()) {
          dividerOutlines.push(clipped.toPolygons().map(p => p.map(v => [v[0]!, v[1]!] as [number, number])))
          dividerSolids.push(keep(extrudeFlat(M, clipped, innerH, b)))
        }
      }
      for (const d of dividerSolids) tray = keep(tray.add(d))
    }

    const status = tray.status()
    if (String(status) !== 'NoError') {
      return { ok: false, errors: [{ code: 'MANIFOLD_ERROR', message: `Geometry kernel reported an invalid solid (${String(status)}).` }], warnings }
    }
    if (tray.isEmpty()) {
      return { ok: false, errors: [{ code: 'EMPTY_RESULT', message: 'Generation produced an empty model.' }], warnings }
    }

    const data = meshFromManifold(tray)
    const validation = validateMesh(data)

    const bbox = bboxFromMesh(data.positions)
    const outline: Contour[] = outer.toPolygons().map(p => p.map(v => [v[0], v[1]] as [number, number]))
    const cavityOutline: Contour[] = inner.toPolygons().map(p => p.map(v => [v[0], v[1]] as [number, number]))

    let lidMesh: MeshData | undefined
    let lidValidation: MeshValidation | undefined
    let lidBbox: BBox | undefined
    if (params.lid.enabled) {
      const lt = params.lid.lipThickness > 0 ? params.lid.lipThickness : t
      const lipOuter = keep(inner.offset(-params.lid.clearance, 'Round'))
      const lipInner = keep(inner.offset(-(params.lid.clearance + lt), 'Round'))
      if (lipInner.isEmpty() || lipOuter.isEmpty()) {
        warnings.push({ code: 'LID_SKIPPED', message: 'Lid lip does not fit inside the cavity with the current clearance and lip thickness.' })
      } else {
        const lipRing = keep(lipOuter.subtract(lipInner))
        const plate = keep(extrudeFlat(M, outer, params.lid.thickness, H))
        const lip = keep(extrudeFlat(M, lipRing, params.lid.lipDepth, H - params.lid.lipDepth))
        let lid = keep(plate.add(lip))
        const ls = lid.status()
        if (String(ls) !== 'NoError' || lid.isEmpty()) {
          warnings.push({ code: 'LID_SKIPPED', message: 'Could not build a valid lid solid for these parameters.' })
          lid.delete()
        } else {
          lidMesh = meshFromManifold(lid)
          lidValidation = validateMesh(lidMesh)
          lidBbox = bboxFromMesh(lidMesh.positions)
          if (!lidValidation.ok) {
            warnings.push({ code: 'LID_INVALID', message: 'Lid mesh failed validation; lid export is disabled.' })
          }
        }
      }
    }

    const cutLayers = buildCutLayers(M, { outline, cavityOutline, dividerOutlines, kerf: params.cutKerf })

    if (!validation.ok) {
      errors.push({ code: 'MESH_INVALID', message: `The generated mesh failed validation (open edges: ${validation.openEdges}, non-manifold edges: ${validation.nonManifoldEdges}, inconsistent edges: ${validation.inconsistentEdges}, degenerate triangles: ${validation.degenerateTriangles}). Export is disabled.` })
    }
    if (validation.components > 1) {
      warnings.push({ code: 'MULTIPLE_COMPONENTS', message: `The model consists of ${validation.components} disconnected trays.` })
    }
    return {
      ok: errors.length === 0,
      errors,
      warnings,
      mesh: data,
      bbox,
      validation,
      outline,
      cavityOutline,
      dividerOutlines,
      lidMesh,
      lidValidation,
      lidBbox,
      cutLayers
    }
  } finally {
    for (const o of created.reverse()) { try { o.delete() } catch { /* already freed */ } }
  }
}
