/** Shared types for the (UI-independent) geometry engine. All lengths are millimetres unless stated. */
export type Vec2 = [number, number]
export type Contour = Vec2[]
export type FillRule = 'EvenOdd' | 'NonZero'

export interface Issue {
  code: string
  message: string
}

export interface SvgShape {
  id: string
  label: string
  /** Closed contours in SVG user units (y axis down), transforms already applied. */
  contours: Contour[]
  fillRule: FillRule
}

export interface SvgParseResult {
  shapes: SvgShape[]
  warnings: Issue[]
  errors: Issue[]
  /** Bounding box of every shape in SVG user units. */
  bounds: { minX: number, minY: number, maxX: number, maxY: number } | null
}

export interface TrayParams {
  /** Target outer width in mm (before `scale`). */
  width: number
  /** Target outer height in mm (before `scale`). */
  height: number
  /** Extra uniform scale multiplier (1 = 100 %). */
  scale: number
  wallHeight: number
  wallThickness: number
  bottomThickness: number
  /** Wall taper in degrees. Positive flares outwards, negative leans inwards. */
  taperAngle: number
  /** External corner radius in mm (0 = off). */
  cornerRadius: number
}

export const DEFAULT_PARAMS: TrayParams = {
  width: 100,
  height: 100,
  scale: 1,
  wallHeight: 20,
  wallThickness: 2,
  bottomThickness: 2,
  taperAngle: 0,
  cornerRadius: 0
}

export interface MeshData {
  /** xyz triplets, mm, z up. */
  positions: Float32Array
  /** Triangle indices, counter-clockwise when seen from outside. */
  indices: Uint32Array
}

export interface MeshValidation {
  ok: boolean
  watertight: boolean
  consistentlyOriented: boolean
  manifold: boolean
  degenerateTriangles: number
  openEdges: number
  nonManifoldEdges: number
  inconsistentEdges: number
  volume: number
  triangles: number
  vertices: number
  components: number
}

export interface BBox {
  min: [number, number, number]
  max: [number, number, number]
  size: [number, number, number]
}

export interface TrayResult {
  ok: boolean
  errors: Issue[]
  warnings: Issue[]
  mesh?: MeshData
  bbox?: BBox
  validation?: MeshValidation
  /** Bottom outline polygons (mm), handy for debugging / 2D views. */
  outline?: Contour[]
}
