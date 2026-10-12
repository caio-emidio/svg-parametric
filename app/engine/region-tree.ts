import type { CustomDividerLine } from './types'
import type { InnerBounds } from './compartment-layout'

export const ROOT_REGION_ID = 'root'

export interface NormRegion {
  id: string
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface RegionalWall {
  orientation: 'horizontal' | 'vertical'
  /** Split coordinate in normalized 0–1 cavity space. */
  u?: number
  v?: number
  u0: number
  u1: number
  v0: number
  v1: number
}

export interface RegionTreeResult {
  leaves: NormRegion[]
  walls: RegionalWall[]
}

export function normalizeCustomLine(line: CustomDividerLine, index: number): CustomDividerLine & { id: string, regionId: string } {
  return {
    id: line.id ?? `split-${index}`,
    regionId: line.regionId ?? ROOT_REGION_ID,
    orientation: line.orientation,
    t: line.t
  }
}

export function buildRegionTree(splits: CustomDividerLine[]): RegionTreeResult {
  const walls: RegionalWall[] = []
  let leaves: NormRegion[] = [{ id: ROOT_REGION_ID, u0: 0, v0: 0, u1: 1, v1: 1 }]
  if (!splits.length) return { leaves, walls }

  let counter = 0
  for (const raw of splits) {
    const split = normalizeCustomLine(raw, counter)
    const idx = leaves.findIndex(r => r.id === split.regionId)
    if (idx < 0) continue
    const p = leaves[idx]!
    leaves.splice(idx, 1)
    const idA = `c${counter++}`
    const idB = `c${counter++}`
    if (split.orientation === 'horizontal') {
      const v = p.v0 + (p.v1 - p.v0) * split.t
      walls.push({ orientation: 'horizontal', v, u0: p.u0, u1: p.u1, v0: p.v0, v1: p.v1 })
      leaves.push({ id: idA, u0: p.u0, v0: p.v0, u1: p.u1, v1: v })
      leaves.push({ id: idB, u0: p.u0, v0: v, u1: p.u1, v1: p.v1 })
    } else {
      const u = p.u0 + (p.u1 - p.u0) * split.t
      walls.push({ orientation: 'vertical', u, u0: p.u0, u1: p.u1, v0: p.v0, v1: p.v1 })
      leaves.push({ id: idA, u0: p.u0, v0: p.v0, u1: u, v1: p.v1 })
      leaves.push({ id: idB, u0: u, v0: p.v0, u1: p.u1, v1: p.v1 })
    }
  }
  return { leaves, walls }
}

/** Regions that can be split when appending a new divider. */
export function splittableRegions(splits: CustomDividerLine[]): NormRegion[] {
  return buildRegionTree(splits).leaves
}

/** Regions available as targets for split at `index` (splits before index applied). */
export function splittableRegionsBeforeSplit(splits: CustomDividerLine[], index: number): NormRegion[] {
  return buildRegionTree(splits.slice(0, index)).leaves
}

export function regionToMm(r: NormRegion, bounds: InnerBounds) {
  const W = bounds.maxX - bounds.minX
  const H = bounds.maxY - bounds.minY
  return {
    minX: bounds.minX + W * r.u0,
    maxX: bounds.minX + W * r.u1,
    minY: bounds.minY + H * r.v0,
    maxY: bounds.minY + H * r.v1
  }
}

export function wallToMmStrip(wall: RegionalWall, bounds: InnerBounds, dt: number) {
  const W = bounds.maxX - bounds.minX
  const H = bounds.maxY - bounds.minY
  if (wall.orientation === 'horizontal') {
    const y = bounds.minY + H * wall.v!
    const x0 = bounds.minX + W * wall.u0
    const x1 = bounds.minX + W * wall.u1
    return { minX: x0, minY: y - dt / 2, maxX: x1, maxY: y + dt / 2 }
  }
  const x = bounds.minX + W * wall.u!
  const y0 = bounds.minY + H * wall.v0
  const y1 = bounds.minY + H * wall.v1
  return { minX: x - dt / 2, minY: y0, maxX: x + dt / 2, maxY: y1 }
}

/** Usable cell size in mm (approx.), accounting for divider thickness on edges. */
export function leafCellSizeMm(r: NormRegion, bounds: InnerBounds, dt: number) {
  const mm = regionToMm(r, bounds)
  let w = mm.maxX - mm.minX
  let d = mm.maxY - mm.minY
  if (r.u0 > 0) w -= dt / 2
  if (r.u1 < 1) w -= dt / 2
  if (r.v0 > 0) d -= dt / 2
  if (r.v1 < 1) d -= dt / 2
  return { width: Math.max(0, w), depth: Math.max(0, d) }
}

export function regionLabel(r: NormRegion, index: number): string {
  const w = (r.u1 - r.u0) * 100
  const h = (r.v1 - r.v0) * 100
  return `#${index + 1} (${w.toFixed(0)}×${h.toFixed(0)}%)`
}
