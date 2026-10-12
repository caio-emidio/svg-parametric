import { describe, expect, it } from 'vitest'
import { computeCompartmentLayout, DEFAULT_DIVIDERS } from '../app/engine'

describe('compartment layout', () => {
  const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 60 }

  it('grid 2×2 subtracts divider thickness', () => {
    const layout = computeCompartmentLayout(bounds, {
      ...DEFAULT_DIVIDERS,
      enabled: true,
      layout: 'grid',
      rows: 2,
      cols: 2,
      thickness: 2
    }, 2)
    expect(layout).not.toBeNull()
    expect(layout!.cellWidth).toBeCloseTo(49, 0)
    expect(layout!.cellDepth).toBeCloseTo(29, 0)
    expect(layout!.count).toBe(4)
  })

  it('custom vertical split halves width', () => {
    const layout = computeCompartmentLayout(bounds, {
      ...DEFAULT_DIVIDERS,
      enabled: true,
      layout: 'custom',
      customLines: [{ orientation: 'vertical', t: 0.5 }],
      thickness: 2
    }, 2)
    expect(layout!.cols).toBe(2)
    expect(layout!.cellWidth).toBeCloseTo(49, 0)
  })
})
