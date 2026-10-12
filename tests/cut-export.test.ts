import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, SAMPLES, buildCutLayers, cutLayersToSvg, generateTray, loadManifold, parseSvg, type ManifoldModule } from '../app/engine'

let M: ManifoldModule
beforeAll(async () => { M = await loadManifold() })

describe('cut export', () => {
  it('builds outer and cavity layers with kerf offset', () => {
    const parsed = parseSvg(SAMPLES[0]!.svg)
    const result = generateTray(M, parsed.shapes, { ...DEFAULT_PARAMS, width: 80, cutKerf: 0.2 })
    expect(result.ok).toBe(true)
    expect(result.cutLayers!.length).toBeGreaterThanOrEqual(2)
    const svg = cutLayersToSvg(result.cutLayers!, { width: result.bbox!.size[0], height: result.bbox!.size[1] })
    expect(svg).toContain('<svg')
    expect(svg).toContain('data-layer="outer"')
    expect(svg).toContain('data-layer="cavity"')
    expect(svg).toMatch(/<path d="M /)
    const filled = cutLayersToSvg(
      result.cutLayers!,
      { width: result.bbox!.size[0], height: result.bbox!.size[1] },
      'filled',
      result.outline!
    )
    expect(filled).toContain('fill-rule="evenodd"')
    expect(filled).toContain('data-style="filled"')
    expect(filled).not.toContain('data-layer="cavity"')
    expect(filled.match(/<path/g)?.length).toBe(1)
    const vb = filled.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)!
    const vw = Number(vb[1]!), vh = Number(vb[2]!)
    expect(vw).toBeLessThan(result.bbox!.size[0] + 10)
    expect(vh).toBeLessThan(result.bbox!.size[1] + 10)
    expect(vw / vh).toBeCloseTo(result.bbox!.size[0] / result.bbox!.size[1], 1)
  })

  it('filled export viewBox matches model aspect ratio', () => {
    const sample = SAMPLES.find(s => s.id === 'rounded-rect')!
    const parsed = parseSvg(sample.svg)
    const result = generateTray(M, parsed.shapes, { ...DEFAULT_PARAMS, width: 120, height: 80 })
    expect(result.ok).toBe(true)
    const filled = cutLayersToSvg(
      result.cutLayers!,
      { width: result.bbox!.size[0], height: result.bbox!.size[1] },
      'filled',
      result.outline!
    )
    const m = filled.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/)
    expect(m).toBeTruthy()
    const vw = Number(m![1]), vh = Number(m![2])
    expect(vw / vh).toBeCloseTo(120 / 80, 1)
  })

  it('includes divider layers when compartments are enabled', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="60"/></svg>'
    const parsed = parseSvg(svg)
    const result = generateTray(M, parsed.shapes, {
      ...DEFAULT_PARAMS,
      width: 100,
      height: 60,
      dividers: { enabled: true, rows: 2, cols: 2, thickness: 2 }
    })
    expect(result.ok).toBe(true)
    expect(result.dividerOutlines!.length).toBe(2)
    const layers = buildCutLayers(M, {
      outline: result.outline!,
      cavityOutline: result.cavityOutline!,
      dividerOutlines: result.dividerOutlines!,
      kerf: 0
    })
    expect(layers.some(l => l.id.startsWith('divider'))).toBe(true)
  })
})
