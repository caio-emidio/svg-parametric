import { describe, expect, it } from 'vitest'
import { buildRegionTree, wallToMmStrip } from '../app/engine/region-tree'

describe('region tree dividers', () => {
  it('horizontal then vertical only in top leaf spans partial width', () => {
    const { walls, leaves } = buildRegionTree([
      { regionId: 'root', orientation: 'horizontal', t: 0.5 },
      { regionId: 'c0', orientation: 'vertical', t: 0.5 }
    ])
    expect(leaves).toHaveLength(3)
    expect(walls).toHaveLength(2)
    const vWall = walls[1]!
    expect(vWall.orientation).toBe('vertical')
    expect(vWall.v1 - vWall.v0).toBeCloseTo(0.5, 5)

    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 60 }
    const strip = wallToMmStrip(vWall, bounds, 2)
    expect(strip.maxY - strip.minY).toBeCloseTo(30, 1)
    expect(strip.maxX - strip.minX).toBeCloseTo(2, 1)
    expect(strip.minY).toBeCloseTo(0, 1)
    expect(strip.maxY).toBeCloseTo(30, 1)
  })
})
