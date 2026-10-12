import { beforeAll, describe, expect, it } from 'vitest'
import { DEFAULT_PARAMS, SAMPLES, generateTray, loadManifold, meshToBinaryStl, parseBinaryStl, parseSvg, stlFilename, validateMesh, type ManifoldModule, type TrayParams } from '../app/engine'

let M: ManifoldModule
beforeAll(async () => { M = await loadManifold() })

const sample = (id: string) => SAMPLES.find(s => s.id === id)!.svg
const build = (svg: string, over: Partial<TrayParams> = {}) => {
  const parsed = parseSvg(svg)
  expect(parsed.errors).toEqual([])
  const params = { ...DEFAULT_PARAMS, ...over }
  return { parsed, params, result: generateTray(M, parsed.shapes, params) }
}
const expectValid = (r: ReturnType<typeof generateTray>) => {
  expect(r.errors).toEqual([])
  expect(r.ok).toBe(true)
  expect(r.validation!.ok).toBe(true)
  expect(r.validation!.openEdges).toBe(0)
  expect(r.validation!.volume).toBeGreaterThan(0)
}

describe('tray generation', () => {
  it('heart: watertight, correct size, hollow', () => {
    const { result, params } = build(sample('heart'), { width: 80, height: 70 })
    expectValid(result)
    expect(result.bbox!.size[0]).toBeCloseTo(80, 1)
    expect(result.bbox!.size[1]).toBeCloseTo(70, 1)
    expect(result.bbox!.size[2]).toBeCloseTo(params.wallHeight, 3)
    // volume must be far smaller than a solid extrusion (open top, hollow)
    const solidArea = parseSvg(sample('heart')).shapes[0]!
    expect(solidArea).toBeTruthy()
    const outline = result.outline!
    const area = Math.abs(outline[0]!.reduce((s, p, i) => { const q = outline[0]![(i + 1) % outline[0]!.length]!; return s + p[0] * q[1] - q[0] * p[1] }, 0) / 2)
    expect(result.validation!.volume).toBeLessThan(area * params.wallHeight * 0.5)
  })

  it('concave star is valid', () => {
    const { result } = build(sample('star'))
    expectValid(result)
    expect(result.bbox!.size[0]).toBeCloseTo(100, 1)
  })

  it('rectangle volume matches analytic value', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="50" height="30"/></svg>'
    const { result } = build(svg, { width: 50, height: 30, wallHeight: 10, wallThickness: 2, bottomThickness: 3 })
    expectValid(result)
    const expected = 50 * 30 * 10 - 46 * 26 * 7
    expect(result.validation!.volume).toBeCloseTo(expected, 0)
    expect(result.validation!.components).toBe(1)
  })

  it('circle (ellipse element) is valid and round-ish', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
    const { result } = build(svg, { width: 60, height: 60 })
    expectValid(result)
    expect(result.bbox!.size[0]).toBeCloseTo(60, 1)
  })

  it('multiple disconnected shapes produce multiple components', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="20" height="20"/><circle cx="60" cy="10" r="10"/></svg>'
    const { result, parsed } = build(svg, { width: 80, height: 20 })
    expect(parsed.shapes).toHaveLength(2)
    expectValid(result)
    expect(result.validation!.components).toBe(2)
  })

  it('shape selection works', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect id="a" x="0" y="0" width="20" height="20"/><circle id="b" cx="60" cy="10" r="10"/></svg>'
    const parsed = parseSvg(svg)
    const r = generateTray(M, [parsed.shapes[1]!], { ...DEFAULT_PARAMS, width: 40, height: 40 })
    expectValid(r)
    expect(r.validation!.components).toBe(1)
  })

  it('holes (even-odd ring) keep the hole with walls around it', () => {
    const { result } = build(sample('ring'), { wallHeight: 10 })
    expectValid(result)
    expect(result.outline!.length).toBe(2)
    // outer wall + inner-hole wall: more than a plain disc tray
    const disc = build('<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="50"/></svg>', { wallHeight: 10 })
    expect(result.validation!.volume).toBeGreaterThan(0)
    expect(result.validation!.volume).not.toBeCloseTo(disc.result.validation!.volume, 0)
  })

  it('very narrow feature warns', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0H100V60H0Z M100 25H160V35H100Z" fill-rule="nonzero"/></svg>'
    const { result } = build(svg, { width: 160, height: 60, wallThickness: 6 })
    expect(result.warnings.map(w => w.code)).toContain('NARROW_FEATURES')
  })

  it('excessive wall thickness is rejected', () => {
    const { result } = build(sample('star'), { wallThickness: 40 })
    expect(result.ok).toBe(false)
    expect(result.mesh).toBeUndefined()
    expect(result.errors[0]!.code).toBe('WALL_TOO_THICK')
  })

  it('invalid dimensions are rejected', () => {
    const { result } = build(sample('heart'), { bottomThickness: 25 })
    expect(result.ok).toBe(false)
    expect(result.errors[0]!.code).toBe('BOTTOM_TOO_THICK')
    expect(build(sample('heart'), { width: -5 }).result.ok).toBe(false)
  })

  it('self-intersecting polygon (pentagram) is reported and resolved by the fill rule', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="50,0 81,95 0,36 100,36 19,95"/></svg>'
    const { result } = build(svg, { width: 100, height: 95, wallThickness: 1 })
    expect(result.warnings.map(w => w.code)).toContain('SELF_INTERSECTING')
    expectValid(result)
  })

  it('pinched bow-tie is never exported as an invalid mesh', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><polygon points="0,0 100,100 100,0 0,100"/></svg>'
    const { result } = build(svg, { width: 100, height: 100, wallThickness: 1 })
    expect(result.warnings.map(w => w.code)).toContain('SELF_INTERSECTING')
    expect(result.ok).toBe(result.validation!.ok)
    if (!result.ok) expect(result.errors[0]!.code).toBe('MESH_INVALID')
  })

  it('taper and corner rounding stay watertight', () => {
    expectValid(build(sample('star'), { taperAngle: 10 }).result)
    expectValid(build(sample('star'), { taperAngle: -8 }).result)
    expectValid(build(sample('rounded-rect'), { cornerRadius: 10 }).result)
    expect(build(sample('star'), { cornerRadius: 500 }).result.ok).toBe(false)
  })

  it('scale multiplier changes outer dimensions', () => {
    const { result } = build(sample('rounded-rect'), { width: 50, height: 40, scale: 2 })
    expect(result.bbox!.size[0]).toBeCloseTo(100, 1)
  })

  it('all samples produce valid trays', () => {
    for (const s of SAMPLES) expectValid(build(s.svg).result)
  })
})

describe('svg parsing', () => {
  it('rejects empty / malformed / non-svg / no-shape input', () => {
    expect(parseSvg('').errors[0]!.code).toBe('EMPTY_SVG')
    expect(parseSvg('<svg><g></svg>').errors[0]!.code).toBe('INVALID_SVG')
    expect(parseSvg('<html></html>').errors[0]!.code).toBe('NOT_SVG')
    expect(parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0L10 10" fill="none" stroke="red"/></svg>').errors[0]!.code).toBe('NO_CLOSED_PATHS')
  })

  it('warns on unsupported features and ignores scripts', () => {
    const p = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>hi</text><use href="#a"/><rect width="10" height="10" mask="url(#m)"/></svg>')
    const codes = p.warnings.map(w => w.code)
    expect(codes).toEqual(expect.arrayContaining(['SCRIPT_REMOVED', 'TEXT_UNSUPPORTED', 'USE_UNSUPPORTED', 'UNSUPPORTED_EFFECT']))
    expect(p.shapes).toHaveLength(1)
  })

  it('applies transforms', () => {
    const p = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><g transform="translate(10 20) scale(2)"><rect width="5" height="5"/></g></svg>')
    expect(p.bounds).toEqual({ minX: 10, minY: 20, maxX: 20, maxY: 30 })
  })

  it('flattens curves and arcs', () => {
    const p = parseSvg(sample('heart'))
    expect(p.shapes[0]!.contours[0]!.length).toBeGreaterThan(40)
    const r = parseSvg('<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10" rx="2"/></svg>')
    expect(r.shapes[0]!.contours[0]!.length).toBeGreaterThan(8)
  })
})

describe('mesh validation and STL', () => {
  it('detects open meshes', () => {
    const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0])
    const v = validateMesh({ positions, indices: new Uint32Array([0, 1, 2]) })
    expect(v.ok).toBe(false)
    expect(v.openEdges).toBe(3)
    expect(() => meshToBinaryStl({ positions, indices: new Uint32Array([0, 1, 2]) }, v)).toThrow()
  })

  it('detects flipped orientation', () => {
    const { result } = build(sample('rounded-rect'))
    const idx = Uint32Array.from(result.mesh!.indices)
    for (let t = 0; t < 3; t++) { const a = idx[t * 3 + 1]!; idx[t * 3 + 1] = idx[t * 3 + 2]!; idx[t * 3 + 2] = a }
    expect(validateMesh({ positions: result.mesh!.positions, indices: idx }).ok).toBe(false)
    const inverted = Uint32Array.from(result.mesh!.indices)
    for (let t = 0; t < inverted.length / 3; t++) { const a = inverted[t * 3 + 1]!; inverted[t * 3 + 1] = inverted[t * 3 + 2]!; inverted[t * 3 + 2] = a }
    expect(validateMesh({ positions: result.mesh!.positions, indices: inverted }).volume).toBeLessThan(0)
  })

  it('STL export round-trips with outward normals', () => {
    const { result } = build(sample('heart'))
    const buf = meshToBinaryStl(result.mesh!, result.validation!)
    const stl = parseBinaryStl(buf)
    expect(stl.triangles).toBe(result.validation!.triangles)
    expect(buf.byteLength).toBe(84 + stl.triangles * 50)
    const re = validateMesh({ positions: stl.positions, indices: Uint32Array.from({ length: stl.positions.length / 3 }, (_, i) => i) })
    expect(re.ok).toBe(true)
    expect(re.volume).toBeCloseTo(result.validation!.volume, 1)
    // stored normal agrees with winding
    const p = stl.positions
    const ux = p[3]! - p[0]!, uy = p[4]! - p[1]!, uz = p[5]! - p[2]!, vx = p[6]! - p[0]!, vy = p[7]! - p[1]!, vz = p[8]! - p[2]!
    const n = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx]
    expect(n[0]! * stl.normals[0]! + n[1]! * stl.normals[1]! + n[2]! * stl.normals[2]!).toBeGreaterThan(0)
  })

  it('builds descriptive filenames', () => {
    expect(stlFilename('my heart.svg', { width: 100, height: 90.4, wallHeight: 20 })).toBe('my_heart_tray_100x90x20mm.stl')
  })

  it('numerical regression: rounded-rect tray volume', () => {
    const { result } = build(sample('rounded-rect'))
    expect(result.validation!.volume).toBeCloseTo(32715.3, 0)
  })
})
