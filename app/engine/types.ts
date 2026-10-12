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

export type DividerLayout = 'grid' | 'custom'

export interface CustomDividerLine {
  id?: string
  /** Compartment region to split (`root` = full cavity). */
  regionId?: string
  orientation: 'horizontal' | 'vertical'
  /** Position inside the target region, 0–1 from min to max. */
  t: number
}

export interface DividerParams {
  enabled: boolean
  layout: DividerLayout
  /** Number of compartment rows (≥ 1). */
  rows: number
  /** Number of compartment columns (≥ 1). */
  cols: number
  /** Internal wall thickness; 0 uses `wallThickness`. */
  thickness: number
  customLines: CustomDividerLine[]
}

export type PieceMode = 'tray' | 'coaster' | 'cookieCutter' | 'stamp' | 'closedBox'

export interface LidParams {
  enabled: boolean
  /** Flat top panel thickness in mm. */
  thickness: number
  /** Radial gap between lid lip and cavity wall in mm. */
  clearance: number
  /** How far the lip extends downward into the cavity in mm. */
  lipDepth: number
  /** Lip skirt thickness in mm; 0 uses `wallThickness`. */
  lipThickness: number
}

export interface TrayParams {
  /** Product template controlling geometry presets and export defaults. */
  pieceMode: PieceMode
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
  dividers: DividerParams
  lid: LidParams
  /** Kerf / beam width for 2D cut export (mm). */
  cutKerf: number
  /** Layer height baked into Bambu 3MF hints (mm). */
  exportLayerHeight: number
  /** Elephant-foot compensation in Bambu 3MF hints (mm). */
  exportElephantFoot: number
  /** Relief height for stamp mode (mm). */
  stampDepth: number
  /** Thin base plate under cookie-cutter walls. */
  cookieCutterBase: boolean
}

export const DEFAULT_DIVIDERS: DividerParams = {
  enabled: false,
  layout: 'grid',
  rows: 2,
  cols: 2,
  thickness: 0,
  customLines: []
}

export const DEFAULT_LID: LidParams = {
  enabled: false,
  thickness: 2,
  clearance: 0.3,
  lipDepth: 4,
  lipThickness: 0
}

export const DEFAULT_PARAMS: TrayParams = {
  pieceMode: 'tray',
  width: 100,
  height: 100,
  scale: 1,
  wallHeight: 20,
  wallThickness: 2,
  bottomThickness: 2,
  taperAngle: 0,
  cornerRadius: 0,
  dividers: { ...DEFAULT_DIVIDERS },
  lid: { ...DEFAULT_LID },
  cutKerf: 0.15,
  exportLayerHeight: 0.2,
  exportElephantFoot: 0.12,
  stampDepth: 3,
  cookieCutterBase: false
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

/** 2D cut layers for laser/CNC export (mm, z-up footprint). */
export interface CutLayer {
  id: string
  label: string
  /** CSS colour for SVG stroke. */
  stroke: string
  contours: Contour[]
}

export interface CompartmentCell {
  width: number
  depth: number
}

export interface CompartmentLayout {
  count: number
  rows: number
  cols: number
  cellWidth: number
  cellDepth: number
  varies: boolean
  minCellWidth?: number
  maxCellWidth?: number
  minCellDepth?: number
  maxCellDepth?: number
  /** Per-compartment sizes (custom / regional layout). */
  cells?: CompartmentCell[]
}

export interface TrayResult {
  ok: boolean
  errors: Issue[]
  warnings: Issue[]
  mesh?: MeshData
  bbox?: BBox
  validation?: MeshValidation
  /** Outer bottom outline polygons (mm). */
  outline?: Contour[]
  /** Cavity opening at the bottom (mm). */
  cavityOutline?: Contour[]
  /** Divider footprints at the bottom (mm). */
  dividerOutlines?: Contour[][]
  lidMesh?: MeshData
  lidValidation?: MeshValidation
  lidBbox?: BBox
  /** Layers for 2D cut export (includes kerf when built for export). */
  cutLayers?: CutLayer[]
  /** Compartment cell sizes when internal dividers are enabled. */
  compartmentLayout?: CompartmentLayout
}
