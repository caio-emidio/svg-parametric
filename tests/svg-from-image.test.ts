import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { analyzeTracedSvg } from '../app/engine/svg-from-image'
import { normalizeTracedSvg } from '../app/engine/image-trace'
import { parseSvg } from '../app/engine/svg-parse'

describe('svg-from-image analysis', () => {
  it('warns on multiple traced shapes', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/><rect x="20" width="5" height="5"/></svg>`
    const parsed = parseSvg(svg)
    const a = analyzeTracedSvg(parsed)
    expect(a.warnings.some(w => w.code === 'MULTIPLE_COMPONENTS')).toBe(true)
    expect(a.suggestedShapeIds.length).toBe(1)
  })

  it('loads silhouette fixture SVG', () => {
    const svg = readFileSync(new URL('./fixtures/silhouette-rect.svg', import.meta.url), 'utf8')
    expect(parseSvg(svg).errors).toHaveLength(0)
  })

  it('normalizes potrace-style output for parseSvg', () => {
    const raw = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 30"><path d="M5 5 L35 5 L35 25 L5 25 Z" fill="#000"/></svg>`
    const svg = normalizeTracedSvg(raw, 40, 30)
    const parsed = parseSvg(svg)
    expect(parsed.errors).toHaveLength(0)
    expect(parsed.shapes.length).toBe(1)
  })
})
