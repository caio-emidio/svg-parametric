import { beforeAll, describe, expect, it } from 'vitest'
import { unzipSync } from 'fflate'
import {
  DEFAULT_PARAMS,
  buildBambu3mfCombined,
  buildBambuTrayLidZip,
  generateTray,
  loadManifold,
  parseSvg,
  snapBottomToLayer,
  type ManifoldModule
} from '../app/engine'

let M: ManifoldModule
beforeAll(async () => { M = await loadManifold() })

describe('bambu 3mf export', () => {
  it('snapBottomToLayer rounds to layer multiples', () => {
    expect(snapBottomToLayer(2, 0.2)).toBeCloseTo(2, 5)
    expect(snapBottomToLayer(2.1, 0.2)).toBeCloseTo(2.2, 5)
  })

  it('ZIP contains separate tray and lid 3MF files', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="30"/></svg>'
    const parsed = parseSvg(svg)
    const result = generateTray(M, parsed.shapes, {
      ...DEFAULT_PARAMS,
      width: 40,
      height: 30,
      lid: { enabled: true, thickness: 2, clearance: 0.3, lipDepth: 4, lipThickness: 2 }
    })
    expect(result.ok).toBe(true)
    const zip = buildBambuTrayLidZip({
      tray: { mesh: result.mesh!, validation: result.validation!, name: 'Tray', bbox: result.bbox! },
      lid: { mesh: result.lidMesh!, validation: result.lidValidation!, name: 'Lid', bbox: result.lidBbox! },
      params: { bottomThickness: DEFAULT_PARAMS.bottomThickness },
      hints: { layerHeightMm: 0.2, elephantFootMm: 0.12 }
    })
    const files = unzipSync(zip)
    const names = Object.keys(files)
    expect(names.some(n => n.endsWith('_tray.3mf'))).toBe(true)
    expect(names.some(n => n.endsWith('_lid.3mf'))).toBe(true)
    expect(names).toContain('LEIA-ME-Bambu.txt')

    const trayEntry = names.find(n => n.endsWith('_tray.3mf'))!
    const trayZip = unzipSync(files[trayEntry]!)
    const trayModel = new TextDecoder().decode(trayZip['3D/3dmodel.model'])
    expect(trayModel).toContain('object id="1"')

    const lidEntry = names.find(n => n.endsWith('_lid.3mf'))!
    const lidZip = unzipSync(files[lidEntry]!)
    const lidModel = new TextDecoder().decode(lidZip['3D/3dmodel.model'])
    expect(lidModel).toContain('object id="1"')
  })

  it('combined 3MF uses split Bambu object files', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><rect width="40" height="30"/></svg>'
    const parsed = parseSvg(svg)
    const result = generateTray(M, parsed.shapes, {
      ...DEFAULT_PARAMS,
      lid: { enabled: true, thickness: 2, clearance: 0.3, lipDepth: 4, lipThickness: 2 }
    })
    const zip = buildBambu3mfCombined({
      tray: { mesh: result.mesh!, validation: result.validation!, name: 'Tray', bbox: result.bbox! },
      lid: { mesh: result.lidMesh!, validation: result.lidValidation!, name: 'Lid', bbox: result.lidBbox! },
      params: { bottomThickness: 2 }
    })
    const files = unzipSync(zip)
    expect(files['3D/Objects/object_1.model']).toBeDefined()
    expect(files['3D/Objects/object_2.model']).toBeDefined()
    const settings = new TextDecoder().decode(files['Metadata/model_settings.config'])
    expect(settings).toContain('plater_id" value="2"')
  })
})
