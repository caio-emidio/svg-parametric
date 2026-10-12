import { describe, expect, it } from 'vitest'
import {
  createProjectFile,
  decodeProjectFromUrlHash,
  encodeProjectUrl,
  parseProjectFile,
  DEFAULT_PARAMS
} from '../app/engine'

describe('project file', () => {
  const sample = createProjectFile({
    svgText: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
    svgName: 'test.svg',
    selectedIds: ['rect-1'],
    params: { ...DEFAULT_PARAMS, width: 42 },
    lockAspect: true,
    fromImage: false
  })

  it('round-trips JSON', () => {
    const parsed = parseProjectFile(JSON.stringify(sample))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.project.params.width).toBe(42)
    expect(parsed.project.svgText).toContain('<svg')
  })

  it('encodes and decodes URL hash', () => {
    const hash = encodeProjectUrl(sample)
    expect(hash.startsWith('#p=')).toBe(true)
    const decoded = decodeProjectFromUrlHash(hash)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.project.params.width).toBe(42)
  })
})
