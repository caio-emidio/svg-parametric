import { ROOT_REGION_ID } from './region-tree'
import type { DividerParams } from './types'

/** Grid when layout is missing, invalid, or custom mode has no lines yet. */
export function effectiveDividerLayout(dividers: DividerParams): 'grid' | 'custom' {
  const layout = dividers.layout ?? 'grid'
  if (layout === 'custom' && (dividers.customLines?.length ?? 0) > 0) return 'custom'
  return 'grid'
}

export function normalizeDividerParams(dividers: DividerParams): DividerParams {
  if (!Array.isArray(dividers.customLines)) dividers.customLines = []
  dividers.customLines.forEach((line, i) => {
    if (!line.regionId) line.regionId = ROOT_REGION_ID
    if (!line.id) line.id = `split-${i}`
  })
  if (dividers.layout !== 'grid' && dividers.layout !== 'custom') dividers.layout = 'grid'
  if (dividers.enabled && effectiveDividerLayout(dividers) === 'grid') {
    if (dividers.rows < 1) dividers.rows = 1
    if (dividers.cols < 1) dividers.cols = 1
    // 1×1 grid has no divider walls — default to 2×2 when turning compartments on.
    if (dividers.rows <= 1 && dividers.cols <= 1) {
      dividers.rows = 2
      dividers.cols = 2
    }
  }
  return dividers
}
