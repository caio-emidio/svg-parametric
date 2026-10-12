import { fileForContentTypes, FileForRelThumbnail, to3dmodel } from '@jscadui/3mf-export'
import { strToU8, zipSync } from 'fflate'
import type { BBox, MeshData, MeshValidation, TrayParams } from './types'

export interface Bambu3mfPrintHints {
  layerHeightMm: number
  bedCenterMm: number
  elephantFootMm: number
  minimumLayerTimeSec: number
}

export const DEFAULT_BAMBU_HINTS: Bambu3mfPrintHints = {
  layerHeightMm: 0.2,
  bedCenterMm: 128,
  elephantFootMm: 0.12,
  minimumLayerTimeSec: 10
}

export interface Bambu3mfPart {
  mesh: MeshData
  validation: MeshValidation
  name: string
  bbox: BBox
}

export interface Bambu3mfInput {
  tray: Bambu3mfPart
  lid?: Bambu3mfPart
  params: Pick<TrayParams, 'bottomThickness'>
  hints?: Partial<Bambu3mfPrintHints>
  projectTitle?: string
}

export function snapBottomToLayer(bottomMm: number, layerMm: number): number {
  if (!(layerMm > 0)) return bottomMm
  return Math.max(layerMm, Math.round(bottomMm / layerMm) * layerMm)
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

function translateMesh(mesh: MeshData, dx: number, dy: number, dz: number): MeshData {
  const positions = mesh.positions.slice()
  for (let i = 0; i < positions.length; i += 3) {
    positions[i]! += dx
    positions[i + 1]! += dy
    positions[i + 2]! += dz
  }
  return { positions, indices: mesh.indices.slice() }
}

function bboxFromPositions(positions: Float32Array): BBox {
  let lx0 = Infinity, ly0 = Infinity, lz0 = Infinity, lx1 = -Infinity, ly1 = -Infinity, lz1 = -Infinity
  for (let i = 0; i < positions.length; i += 3) {
    lx0 = Math.min(lx0, positions[i]!); lx1 = Math.max(lx1, positions[i]!)
    ly0 = Math.min(ly0, positions[i + 1]!); ly1 = Math.max(ly1, positions[i + 1]!)
    lz0 = Math.min(lz0, positions[i + 2]!); lz1 = Math.max(lz1, positions[i + 2]!)
  }
  return {
    min: [lx0, ly0, lz0],
    max: [lx1, ly1, lz1],
    size: [lx1 - lx0, ly1 - ly0, lz1 - lz0]
  }
}

function centerOnBedTransform(bbox: BBox, bedCenter: number, layOnBedZ: boolean): number[] {
  const cx = (bbox.min[0] + bbox.max[0]) / 2
  const cy = (bbox.min[1] + bbox.max[1]) / 2
  const tx = bedCenter - cx
  const ty = bedCenter - cy
  const tz = layOnBedZ ? -bbox.min[2] : 0
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1]
}

function matrix2str(m: number[]): string {
  let str = ''
  for (let i = 0; i < 16; i++) {
    if (i % 4 === 3) continue
    if (str) str += ' '
    str += m[i] ?? 0
  }
  return str
}

function mat4ToBambuTransform(m: number[]): string {
  const parts: string[] = []
  for (let c = 0; c < 4; c++) {
    for (let r = 0; r < 3; r++) parts.push(String(m[c * 4 + r] ?? 0))
  }
  return parts.join(' ')
}

function patchModelXmlForBambu(modelXml: string, title: string): string {
  return modelXml
    .replace(
      'xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"',
      'xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06"'
    )
    .replace(
      '<metadata name="Application">svg-parametric</metadata>',
      '<metadata name="Application">BambuStudio-02.02.00.85</metadata>'
    )
    .replace(
      `<metadata name="Title">${title}</metadata>`,
      `<metadata name="Title">${xmlEscape(title)}</metadata>\n  <metadata name="BambuStudio:3mfVersion">1</metadata>`
    )
}

/** One mesh, centred on the bed (for a single-plate 3MF). */
export function buildSinglePlate3mf(mesh: MeshData, name: string, bbox: BBox, bedCenter: number): Uint8Array {
  const placed = translateMesh(mesh, 0, 0, -bbox.min[2])
  const bb = bboxFromPositions(placed.positions)
  const t = centerOnBedTransform(bb, bedCenter, false)
  const modelXml = patchModelXmlForBambu(to3dmodel({
    meshes: [{ id: '1', name, vertices: placed.positions, indices: placed.indices }],
    items: [{ objectID: '1', transform: t }],
    precision: 8,
    header: { unit: 'millimeter', title: name, application: 'svg-parametric', description: name }
  }), name)

  const rels = new FileForRelThumbnail()
  rels.add3dModel('/3D/3dmodel.model')
  return zipSync({
    '[Content_Types].xml': strToU8(contentTypesWithConfig()),
    '_rels/.rels': strToU8(rels.content),
    '3D/3dmodel.model': strToU8(modelXml)
  }, { level: 6 })
}

function buildObjectSubmodel(mesh: MeshData, name: string): string {
  return patchModelXmlForBambu(to3dmodel({
    meshes: [{ id: '1', name, vertices: mesh.positions, indices: mesh.indices }],
    items: [{ objectID: '1', transform: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] }],
    precision: 8,
    header: { unit: 'millimeter', title: name, application: 'svg-parametric', description: name }
  }), name)
}

function buildRootAssemblyModel(trayT: number[], lidT: number[], title: string): string {
  const t1 = matrix2str(trayT)
  const t2 = matrix2str(lidT)
  return `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:BambuStudio="http://schemas.bambulab.com/package/2021" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p">
  <metadata name="Application">BambuStudio-02.02.00.85</metadata>
  <metadata name="BambuStudio:3mfVersion">1</metadata>
  <metadata name="Title">${xmlEscape(title)}</metadata>
  <resources>
    <object id="1" type="model">
      <components>
        <component objectid="1" p:path="/3D/Objects/object_1.model" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
      </components>
    </object>
    <object id="2" type="model">
      <components>
        <component objectid="1" p:path="/3D/Objects/object_2.model" transform="1 0 0 0 1 0 0 0 1 0 0 0"/>
      </components>
    </object>
  </resources>
  <build>
    <item objectid="1" transform="${t1}"/>
    <item objectid="2" transform="${t2}"/>
  </build>
</model>`
}

function buildModelRels(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/Objects/object_1.model" Id="rel1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
  <Relationship Target="/3D/Objects/object_2.model" Id="rel2" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>`
}

interface PlateLayout {
  trayObjectId: number
  lidObjectId: number
  trayTransform: number[]
  lidTransform: number[]
}

function buildModelSettings(layout: PlateLayout, bottomMm: number, layerMm: number): string {
  const snapped = snapBottomToLayer(bottomMm, layerMm)
  const note = `Tray bottom ${bottomMm}mm (use ${snapped}mm @ ${layerMm}mm layer)`
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<config>',
    `  <object id="${layout.trayObjectId}">`,
    '    <metadata key="name" value="Tray"/>',
    '  </object>',
    `  <object id="${layout.lidObjectId}">`,
    '    <metadata key="name" value="Lid"/>',
    '  </object>',
    '  <plate>',
    '    <metadata key="plater_id" value="1"/>',
    `    <metadata key="plater_name" value="${xmlEscape(note)}"/>`,
    '    <instance>',
    `      <metadata key="object_id" value="${layout.trayObjectId}"/>`,
    '      <metadata key="instance_id" value="0"/>',
    `      <metadata key="identify_id" value="${layout.trayObjectId}"/>`,
    '    </instance>',
    '  </plate>',
    '  <plate>',
    '    <metadata key="plater_id" value="2"/>',
    '    <metadata key="plater_name" value="Lid"/>',
    '    <instance>',
    `      <metadata key="object_id" value="${layout.lidObjectId}"/>`,
    '      <metadata key="instance_id" value="0"/>',
    `      <metadata key="identify_id" value="${layout.lidObjectId}"/>`,
    '    </instance>',
    '  </plate>',
    '  <assemble>',
    `    <assemble_item object_id="${layout.trayObjectId}" instance_id="0" transform="${mat4ToBambuTransform(layout.trayTransform)}" offset="0 0 0"/>`,
    `    <assemble_item object_id="${layout.lidObjectId}" instance_id="0" transform="${mat4ToBambuTransform(layout.lidTransform)}" offset="0 0 0"/>`,
    '  </assemble>',
    '</config>'
  ].join('\n')
}

function buildPrintHintsText(hints: Bambu3mfPrintHints, bottomMm: number): string {
  const snapped = snapBottomToLayer(bottomMm, hints.layerHeightMm)
  const layer = hints.layerHeightMm
  return [
    'svg-parametric — Bambu Studio',
    '',
    'OPCAO RECOMENDADA (duas placas):',
    '  1. Abra o ficheiro *_tray.3mf (placa 1 = bandeja)',
    '  2. No Bambu Studio, clique + para adicionar placa 2',
    '  3. Importe *_lid.3mf para a placa 2 (arrastar ou Importar geometria)',
    '',
    `Bottom thickness no modelo: ${bottomMm} mm`,
    `Sugestao alinhada a camadas: ${snapped} mm (${layer} mm/camada)`,
    '',
    'Process (ajustar no Bambu):',
    `  layer_height: ${layer}`,
    `  elefant_foot_compensation: ${hints.elephantFootMm}`,
    '  seam_position: aligned',
    '  precise_wall: on',
    '  wall_loops: 3',
    `  minimum_layer_time: ${hints.minimumLayerTimeSec} s`
  ].join('\n')
}

function contentTypesWithConfig(): string {
  return fileForContentTypes.content.replace(
    '</Types>',
    '<Default Extension="config" ContentType="application/octet-stream" />\n<Default Extension="txt" ContentType="text/plain" />\n</Types>'
  )
}

function prepareLidMesh(lid: Bambu3mfPart): { mesh: MeshData, bbox: BBox } {
  const placed = translateMesh(lid.mesh, 0, 0, -lid.bbox.min[2])
  return { mesh: placed, bbox: bboxFromPositions(placed.positions) }
}

/**
 * ZIP with tray.3mf + lid.3mf (one object each) — works reliably in Bambu Studio multi-plate workflow.
 */
export function buildBambuTrayOnlyZip(input: Omit<Bambu3mfInput, 'lid'>): Uint8Array {
  const hints: Bambu3mfPrintHints = { ...DEFAULT_BAMBU_HINTS, ...input.hints }
  if (!input.tray.validation.ok) throw new Error('Tray mesh failed validation.')
  const base = (input.projectTitle ?? 'tray').replace(/\.svg$/i, '').replace(/[^\w.-]+/gi, '_') || 'tray'
  const tray3mf = buildSinglePlate3mf(input.tray.mesh, 'Tray', input.tray.bbox, hints.bedCenterMm)
  return zipSync({
    [`${base}.3mf`]: tray3mf,
    'LEIA-ME-Bambu.txt': strToU8(buildTrayOnlyHintsText(hints, input.params.bottomThickness))
  }, { level: 6 })
}

function buildTrayOnlyHintsText(hints: Bambu3mfPrintHints, bottomMm: number): string {
  const snapped = snapBottomToLayer(bottomMm, hints.layerHeightMm)
  const layer = hints.layerHeightMm
  return [
    'svg-parametric — Bambu Studio (single part)',
    '',
    `Bottom thickness: ${bottomMm} mm (suggested ${snapped} mm @ ${layer} mm/layer)`,
    '',
    `layer_height: ${layer}`,
    `elephant_foot_compensation: ${hints.elephantFootMm}`
  ].join('\n')
}

export function buildBambuTrayLidZip(input: Bambu3mfInput): Uint8Array {
  const hints: Bambu3mfPrintHints = { ...DEFAULT_BAMBU_HINTS, ...input.hints }
  if (!input.tray.validation.ok) throw new Error('Tray mesh failed validation.')
  if (!input.lid?.validation.ok) return buildBambuTrayOnlyZip(input)

  const base = (input.projectTitle ?? 'tray').replace(/\.svg$/i, '').replace(/[^\w.-]+/gi, '_') || 'tray'
  const tray3mf = buildSinglePlate3mf(input.tray.mesh, 'Tray', input.tray.bbox, hints.bedCenterMm)
  const lidPrepared = prepareLidMesh(input.lid)
  const lid3mf = buildSinglePlate3mf(lidPrepared.mesh, 'Lid', lidPrepared.bbox, hints.bedCenterMm)

  const combined = buildBambu3mfCombined(input)

  return zipSync({
    [`${base}_tray.3mf`]: tray3mf,
    [`${base}_lid.3mf`]: lid3mf,
    [`${base}_combined.3mf`]: combined,
    'LEIA-ME-Bambu.txt': strToU8(buildPrintHintsText(hints, input.params.bottomThickness))
  }, { level: 6 })
}

/** Combined 3MF (Bambu split objects + model_settings). Plates may require “Open as project”. */
export function buildBambu3mfCombined(input: Bambu3mfInput): Uint8Array {
  const hints: Bambu3mfPrintHints = { ...DEFAULT_BAMBU_HINTS, ...input.hints }
  if (!input.tray.validation.ok) throw new Error('Tray mesh failed validation.')
  if (!input.lid?.validation.ok) throw new Error('Lid mesh failed validation.')

  const trayT = centerOnBedTransform(input.tray.bbox, hints.bedCenterMm, true)
  const lidPrepared = prepareLidMesh(input.lid)
  const lidT = centerOnBedTransform(lidPrepared.bbox, hints.bedCenterMm, false)

  const title = input.projectTitle ?? 'svg-parametric tray + lid'
  const rels = new FileForRelThumbnail()
  rels.add3dModel('/3D/3dmodel.model')

  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(contentTypesWithConfig()),
    '_rels/.rels': strToU8(rels.content),
    '3D/3dmodel.model': strToU8(buildRootAssemblyModel(trayT, lidT, title)),
    '3D/_rels/3dmodel.model.rels': strToU8(buildModelRels()),
    '3D/Objects/object_1.model': strToU8(buildObjectSubmodel(input.tray.mesh, 'Tray')),
    '3D/Objects/object_2.model': strToU8(buildObjectSubmodel(lidPrepared.mesh, 'Lid')),
    'Metadata/model_settings.config': strToU8(buildModelSettings({
      trayObjectId: 1,
      lidObjectId: 2,
      trayTransform: trayT,
      lidTransform: lidT
    }, input.params.bottomThickness, hints.layerHeightMm))
  }

  return zipSync(files, { level: 6 })
}

/** @deprecated use buildBambuTrayLidZip */
export function buildBambu3mf(input: Bambu3mfInput): Uint8Array {
  return buildBambuTrayLidZip(input)
}

export function threeMfFilename(svgName: string | undefined, withLid = true): string {
  const base = (svgName ?? 'tray').replace(/\.svg$/i, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'tray'
  return withLid ? `${base}_bambu_tray_lid.zip` : `${base}_bambu.3mf.zip`
}

export function single3mfFilename(svgName: string | undefined): string {
  const base = (svgName ?? 'tray').replace(/\.svg$/i, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'tray'
  return `${base}.3mf`
}
