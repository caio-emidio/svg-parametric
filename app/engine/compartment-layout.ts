import { effectiveDividerLayout } from './divider-utils'
import { buildRegionTree, leafCellSizeMm, regionToMm } from './region-tree'
import type { CompartmentLayout, DividerParams } from './types'

export interface InnerBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function splitSizes(span: number, count: number, dividerThickness: number): number[] {
  if (count < 1) return []
  if (count === 1) return [span]
  const dt = dividerThickness
  const cell = (span - (count - 1) * dt) / count
  return Array.from({ length: count }, () => cell)
}

/** Approximate compartment footprint from inner cavity bounds and divider settings. */
export function computeCompartmentLayout(bounds: InnerBounds, dividers: DividerParams, wallThickness: number): CompartmentLayout | null {
  if (!dividers.enabled) return null
  const W = bounds.maxX - bounds.minX
  const D = bounds.maxY - bounds.minY
  if (!(W > 0) || !(D > 0)) return null
  const dt = dividers.thickness > 0 ? dividers.thickness : wallThickness
  const layout = effectiveDividerLayout(dividers)

  if (layout === 'grid') {
    const rows = Math.max(1, dividers.rows)
    const cols = Math.max(1, dividers.cols)
    const widths = splitSizes(W, cols, dt)
    const depths = splitSizes(D, rows, dt)
    const cellWidth = widths[0] ?? W
    const cellDepth = depths[0] ?? D
    const cells = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push({ width: round1(widths[c] ?? cellWidth), depth: round1(depths[r] ?? cellDepth) })
      }
    }
    return {
      count: rows * cols,
      rows,
      cols,
      cellWidth: round1(cellWidth),
      cellDepth: round1(cellDepth),
      varies: rows > 1 && depths.some(d => Math.abs(d - depths[0]!) > 0.15)
        || cols > 1 && widths.some(w => Math.abs(w - widths[0]!) > 0.15),
      cells
    }
  }

  const { leaves } = buildRegionTree(dividers.customLines ?? [])
  const cells = leaves.map(r => {
    const s = leafCellSizeMm(r, bounds, dt)
    return { width: round1(s.width), depth: round1(s.depth) }
  })
  if (!cells.length) return null

  const widths = cells.map(c => c.width)
  const depths = cells.map(c => c.depth)
  const minCellWidth = Math.min(...widths)
  const maxCellWidth = Math.max(...widths)
  const minCellDepth = Math.min(...depths)
  const maxCellDepth = Math.max(...depths)
  const varies = cells.length > 1 && (
    maxCellWidth - minCellWidth > 0.15 || maxCellDepth - minCellDepth > 0.15
  )

  const mmLeaves = leaves.map(r => regionToMm(r, bounds))
  const cols = new Set(mmLeaves.map(r => round1(r.minX))).size
  const rows = new Set(mmLeaves.map(r => round1(r.minY))).size

  return {
    count: cells.length,
    rows: Math.max(1, rows),
    cols: Math.max(1, cols),
    cellWidth: round1((minCellWidth + maxCellWidth) / 2),
    cellDepth: round1((minCellDepth + maxCellDepth) / 2),
    varies,
    minCellWidth: round1(minCellWidth),
    maxCellWidth: round1(maxCellWidth),
    minCellDepth: round1(minCellDepth),
    maxCellDepth: round1(maxCellDepth),
    cells
  }
}
