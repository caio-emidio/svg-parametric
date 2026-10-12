import { computed, reactive, ref, shallowRef, watch } from 'vue'
import {
  DEFAULT_DIVIDERS,
  DEFAULT_LID,
  DEFAULT_PARAMS,
  SAMPLES,
  applyPieceModeToParams,
  buildBambu3mf,
  buildBambuTrayOnlyZip,
  buildSinglePlate3mf,
  createProjectFile,
  cutFilename,
  cutLayersToSvg,
  decodeProjectFromUrlHash,
  encodeProjectUrl,
  parseProjectFile,
  projectFilename,
  projectToJson,
  type Svg2dExportStyle,
  snapBottomToLayer,
  single3mfFilename,
  threeMfFilename,
  defaultImageToSvgParams,
  lidStlFilename,
  meshToBinaryStl,
  parseSvg,
  stlFilename,
  type ImageToSvgParams,
  type Issue,
  type PieceMode,
  type SvgParseResult,
  type TrayParams,
  type TrayResult,
  normalizeDividerParams,
  ROOT_REGION_ID,
  splittableRegions,
  splittableRegionsBeforeSplit
} from '~/engine'
import type { ImageTraceWorkerResult } from '~/workers/image-trace.worker'
import { useI18n } from '~/composables/useI18n'

export type GenStatus = 'idle' | 'generating' | 'ready' | 'error'
export type ExportStatus = 'idle' | 'exporting' | 'done' | 'error'
export type TraceStatus = 'idle' | 'tracing' | 'error'
export type PreviewPart = 'tray' | 'lid' | 'both'

const IMAGE_TYPES = /^image\/(png|jpeg|webp)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i

// Module-level singleton state (SPA, one instance of the app).
const svgName = ref<string>('')
const parsed = shallowRef<SvgParseResult | null>(null)
const selectedIds = ref<string[]>([])
const params = reactive<TrayParams>({
  ...DEFAULT_PARAMS,
  dividers: { ...DEFAULT_DIVIDERS },
  lid: { ...DEFAULT_LID }
})
const previewPart = ref<PreviewPart>('tray')
const lockAspect = ref(true)
const status = ref<GenStatus>('idle')
const result = shallowRef<TrayResult | null>(null)
const exportStatus = ref<ExportStatus>('idle')
const exportMessage = ref('')
const loadError = ref<Issue | null>(null)

const traceStatus = ref<TraceStatus>('idle')
const traceWarnings = ref<Issue[]>([])
const generatedSvgText = ref<string>('')
const fromImage = ref(false)
const sourceRasterUrl = ref<string>('')
const imageTraceParams = reactive<ImageToSvgParams>(defaultImageToSvgParams())
const lastImageFile = shallowRef<File | null>(null)

const inputWarnings = computed(() => [
  ...(parsed.value?.warnings ?? []),
  ...traceWarnings.value
])

let worker: Worker | null = null
let nextJob = 0
let inFlight: number | null = null
let pending = false
let debounce: ReturnType<typeof setTimeout> | undefined
let started = false

let traceWorker: Worker | null = null
let traceJobId = 0
let traceInFlight: number | null = null
let tracePreserveDimensions = false
let urlProjectLoaded = false
let sourceRasterBase64 = ''
let sourceRasterMime = ''

const selectedShapes = computed(() => parsed.value?.shapes.filter(s => selectedIds.value.includes(s.id)) ?? [])

/** width / height ratio of the selected shapes in SVG units. */
const aspect = computed(() => {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of selectedShapes.value) for (const c of s.contours) for (const [x, y] of c) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const w = maxX - minX, h = maxY - minY
  return w > 0 && h > 0 ? w / h : 1
})

function revokeRasterUrl() {
  if (sourceRasterUrl.value) {
    URL.revokeObjectURL(sourceRasterUrl.value)
    sourceRasterUrl.value = ''
  }
}

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev: MessageEvent<{ id: number, result: TrayResult }>) => {
    if (ev.data.id !== inFlight) return
    inFlight = null
    result.value = ev.data.result
    status.value = ev.data.result.ok ? 'ready' : 'error'
    if (pending) { pending = false; dispatch() }
  }
  worker.onerror = (e) => {
    inFlight = null
    pending = false
    worker?.terminate()
    worker = null
    result.value = { ok: false, errors: [{ code: 'WORKER_ERROR', message: `Geometry worker crashed: ${e.message}` }], warnings: [] }
    status.value = 'error'
  }
  return worker
}

function ensureTraceWorker() {
  if (traceWorker) return traceWorker
  traceWorker = new Worker(new URL('../workers/image-trace.worker.ts', import.meta.url), { type: 'module' })
  traceWorker.onmessage = (ev: MessageEvent<ImageTraceWorkerResult>) => {
    if (ev.data.id !== traceInFlight) return
    traceInFlight = null
    if (!ev.data.ok) {
      traceStatus.value = 'error'
      loadError.value = ev.data.error
      parsed.value = null
      return
    }
    traceStatus.value = 'idle'
    applyTracedSvg(ev.data.svg, ev.data.selectedShapeIds, ev.data.traceWarnings, tracePreserveDimensions)
  }
  traceWorker.onerror = (e) => {
    traceInFlight = null
    traceStatus.value = 'error'
    loadError.value = { code: 'TRACE_WORKER_ERROR', message: `Image tracing crashed: ${e.message}` }
    traceWorker?.terminate()
    traceWorker = null
  }
  return traceWorker
}

function dispatch() {
  if (!selectedShapes.value.length) { status.value = 'idle'; result.value = null; return }
  if (inFlight !== null) { pending = true; return }
  status.value = 'generating'
  inFlight = ++nextJob
  normalizeDividerParams(params.dividers)
  ensureWorker().postMessage({
    id: inFlight,
    shapes: JSON.parse(JSON.stringify(selectedShapes.value)),
    params: JSON.parse(JSON.stringify(params)) as TrayParams
  })
}

function schedule(delay = 250) {
  clearTimeout(debounce)
  if (selectedShapes.value.length) status.value = 'generating'
  debounce = setTimeout(dispatch, delay)
}

function start() {
  if (started) return
  started = true
  normalizeDividerParams(params.dividers)
  if (params.dividers.enabled) normalizeDividers()
  watch(params, () => schedule(), { deep: true })
  watch(selectedIds, () => { syncHeight(); schedule(60) }, { deep: true })
  if (import.meta.client && !urlProjectLoaded) {
    urlProjectLoaded = true
    tryLoadProjectFromUrl()
  }
}

function applyProject(project: ReturnType<typeof createProjectFile>) {
  Object.assign(params, {
    ...DEFAULT_PARAMS,
    ...project.params,
    dividers: { ...DEFAULT_DIVIDERS, ...project.params.dividers, customLines: [...(project.params.dividers.customLines ?? [])] },
    lid: { ...DEFAULT_LID, ...project.params.lid }
  })
  lockAspect.value = project.lockAspect
  if (project.imageTraceParams) Object.assign(imageTraceParams, project.imageTraceParams)
  sourceRasterBase64 = project.sourceRasterBase64 ?? ''
  sourceRasterMime = project.sourceRasterMime ?? ''
  if (sourceRasterBase64 && sourceRasterMime) {
    sourceRasterUrl.value = `data:${sourceRasterMime};base64,${sourceRasterBase64}`
  }
  loadSvgText(project.svgText, project.svgName, {
    selectedIds: project.selectedIds,
    fromImage: project.fromImage,
    fitDimensions: false
  })
}

function tryLoadProjectFromUrl() {
  const decoded = decodeProjectFromUrlHash(location.hash)
  if (!decoded.ok) return
  applyProject(decoded.project)
}

function buildCurrentProject() {
  const text = generatedSvgText.value
  if (!text) return null
  return createProjectFile({
    svgText: text,
    svgName: svgName.value,
    selectedIds: selectedIds.value,
    params: JSON.parse(JSON.stringify(params)) as TrayParams,
    lockAspect: lockAspect.value,
    fromImage: fromImage.value,
    imageTraceParams: fromImage.value ? { ...imageTraceParams } : undefined,
    sourceRasterBase64: sourceRasterBase64 || undefined,
    sourceRasterMime: sourceRasterMime || undefined
  })
}

const round = (n: number) => Math.round(n * 100) / 100

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

/** Longest side of the selection becomes 100 mm; keeps SVG proportions in width/height. */
function fitDimensionsFromSelection() {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const s of selectedShapes.value) for (const c of s.contours) for (const [x, y] of c) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y)
  }
  const w0 = maxX - minX, h0 = maxY - minY
  if (!(w0 > 0) || !(h0 > 0)) return
  const ref = 100
  if (w0 >= h0) {
    params.width = round(ref)
    params.height = round(ref * h0 / w0)
  } else {
    params.height = round(ref)
    params.width = round(ref * w0 / h0)
  }
}

function syncHeight() {
  if (lockAspect.value) params.height = round(params.width / aspect.value)
}

function setWidth(w: number) {
  params.width = w
  if (lockAspect.value) params.height = round(w / aspect.value)
}
function setHeight(h: number) {
  params.height = h
  if (lockAspect.value) params.width = round(h * aspect.value)
}

function svgNameFromImage(name: string): string {
  return name.replace(IMAGE_EXT, '') + '.svg'
}

function loadSvgText(
  text: string,
  name: string,
  opts?: { selectedIds?: string[], traceWarnings?: Issue[], fromImage?: boolean, fitDimensions?: boolean }
) {
  start()
  const p = parseSvg(text)
  svgName.value = name
  parsed.value = p
  loadError.value = p.errors[0] ?? null
  result.value = null
  generatedSvgText.value = text
  fromImage.value = opts?.fromImage ?? false
  traceWarnings.value = opts?.traceWarnings ?? []
  if (!opts?.fromImage) {
    lastImageFile.value = null
    revokeRasterUrl()
    sourceRasterBase64 = ''
    sourceRasterMime = ''
  }
  selectedIds.value = opts?.selectedIds?.length ? opts.selectedIds : p.shapes.map(s => s.id)
  if (opts?.fitDimensions !== false) fitDimensionsFromSelection()
  else if (lockAspect.value) syncHeight()
  if (!p.shapes.length) status.value = 'error'
  else schedule(60)
  exportStatus.value = 'idle'
  exportMessage.value = ''
}

function applyTracedSvg(svg: string, selectedShapeIds: string[], warnings: Issue[], preserveDimensions: boolean) {
  loadSvgText(svg, svgNameFromImage(svgName.value), {
    selectedIds: selectedShapeIds,
    traceWarnings: warnings,
    fromImage: true,
    fitDimensions: !preserveDimensions
  })
}

async function traceImageFile(file: File, opts?: { preserveDimensions?: boolean }) {
  tracePreserveDimensions = opts?.preserveDimensions ?? false
  start()
  traceStatus.value = 'tracing'
  loadError.value = null
  parsed.value = null
  result.value = null
  traceWarnings.value = []
  svgName.value = file.name
  fromImage.value = true
  lastImageFile.value = file
  revokeRasterUrl()
  sourceRasterUrl.value = URL.createObjectURL(file)
  const buffer = await file.arrayBuffer()
  sourceRasterBase64 = arrayBufferToBase64(buffer)
  sourceRasterMime = file.type || 'application/octet-stream'
  const id = ++traceJobId
  traceInFlight = id
  ensureTraceWorker().postMessage(
    { id, buffer, mimeType: file.type || 'application/octet-stream', params: { ...imageTraceParams } },
    [buffer]
  )
}

function isImageFile(file: File): boolean {
  return IMAGE_TYPES.test(file.type) || IMAGE_EXT.test(file.name)
}

async function loadFile(file: File) {
  start()
  if (isImageFile(file)) {
    await traceImageFile(file)
    return
  }
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    parsed.value = null
    svgName.value = file.name
    loadError.value = { code: 'UNSUPPORTED_FILE', message: useI18n().t('export.unsupportedFile') }
    return
  }
  traceStatus.value = 'idle'
  loadSvgText(await file.text(), file.name, { fromImage: false })
}

function loadSample(id: string) {
  const s = SAMPLES.find(x => x.id === id)
  if (!s) return
  traceStatus.value = 'idle'
  loadSvgText(s.svg, `${s.id}.svg`, { fromImage: false })
}

function clearSvg() {
  parsed.value = null
  svgName.value = ''
  selectedIds.value = []
  result.value = null
  status.value = 'idle'
  loadError.value = null
  traceStatus.value = 'idle'
  traceWarnings.value = []
  generatedSvgText.value = ''
  fromImage.value = false
  lastImageFile.value = null
  revokeRasterUrl()
  sourceRasterBase64 = ''
  sourceRasterMime = ''
}

function setPieceMode(mode: PieceMode) {
  applyPieceModeToParams(params, mode)
  if (selectedShapes.value.length) schedule(60)
}

function normalizeDividers() {
  normalizeDividerParams(params.dividers)
  if (!params.dividers.enabled) return
  if (params.pieceMode === 'stamp' || params.pieceMode === 'cookieCutter' || params.pieceMode === 'coaster') {
    applyPieceModeToParams(params, 'tray')
  }
  if (params.wallHeight <= 0) {
    params.wallHeight = DEFAULT_PARAMS.wallHeight
  }
  if (params.bottomThickness >= params.wallHeight) {
    params.bottomThickness = Math.max(MIN_FEATURE_MM, params.wallHeight * 0.15)
  }
}

const MIN_FEATURE_MM = 0.2

function addCustomDivider(orientation: 'horizontal' | 'vertical', regionId?: string) {
  normalizeDividerParams(params.dividers)
  params.dividers.layout = 'custom'
  const leaves = splittableRegions(params.dividers.customLines)
  const target = regionId ?? leaves[0]?.id ?? ROOT_REGION_ID
  params.dividers.customLines.push({
    id: `split-${Date.now()}`,
    regionId: target,
    orientation,
    t: 0.5
  })
}

function customSplitRegionOptions(splitIndex: number) {
  return splittableRegionsBeforeSplit(params.dividers.customLines, splitIndex)
}

function removeCustomDivider(index: number) {
  params.dividers.customLines.splice(index, 1)
}

async function saveProjectFile() {
  const { t } = useI18n()
  const project = buildCurrentProject()
  if (!project) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noSvg')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const name = downloadBlob(projectFilename(svgName.value), new Blob([projectToJson(project)], { type: 'application/json' }))
    exportStatus.value = 'done'
    exportMessage.value = t('project.saved', { name })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

async function loadProjectFile(file: File) {
  const { t } = useI18n()
  const parsed = parseProjectFile(await file.text())
  if (!parsed.ok) {
    loadError.value = { code: 'PROJECT_INVALID', message: parsed.error }
    return
  }
  applyProject(parsed.project)
  exportStatus.value = 'done'
  exportMessage.value = t('project.loaded', { name: file.name })
}

async function copyShareLink() {
  const { t } = useI18n()
  const project = buildCurrentProject()
  if (!project) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noSvg')
    return
  }
  const hash = encodeProjectUrl(project)
  if (hash.length > 120_000) {
    exportStatus.value = 'error'
    exportMessage.value = t('project.linkTooLarge')
    return
  }
  const url = `${location.origin}${location.pathname}${hash}`
  try {
    await navigator.clipboard.writeText(url)
    history.replaceState(null, '', hash)
    exportStatus.value = 'done'
    exportMessage.value = t('project.linkCopied')
  } catch {
    exportStatus.value = 'error'
    exportMessage.value = t('project.linkCopyFailed')
  }
}

function resetParams() {
  Object.assign(params, { ...DEFAULT_PARAMS, dividers: { ...DEFAULT_DIVIDERS, customLines: [] }, lid: { ...DEFAULT_LID } })
  lockAspect.value = true
  if (selectedShapes.value.length) fitDimensionsFromSelection()
  else syncHeight()
}

function regenerate() { schedule(0) }

async function retraceImage() {
  const f = lastImageFile.value
  if (!f) return
  await traceImageFile(f, { preserveDimensions: true })
}

function exportSvg() {
  const { t } = useI18n()
  const text = generatedSvgText.value
  if (!text) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noSvg')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'image/svg+xml' }))
    const a = document.createElement('a')
    a.href = url
    a.download = svgName.value.endsWith('.svg') ? svgName.value : svgNameFromImage(svgName.value)
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    exportStatus.value = 'done'
    exportMessage.value = t('export.exportedSvg', { name: a.download })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
  return a.download
}

function exportStl() {
  const { t } = useI18n()
  const r = result.value
  if (!r?.ok || !r.mesh || !r.validation) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noModel')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const buf = meshToBinaryStl(r.mesh, r.validation, svgName.value)
    const name = downloadBlob(
      stlFilename(svgName.value, { width: r.bbox!.size[0], height: r.bbox!.size[1], wallHeight: r.bbox!.size[2] }),
      new Blob([buf], { type: 'model/stl' })
    )
    exportStatus.value = 'done'
    exportMessage.value = t('export.exportedStl', {
      name,
      kb: (buf.byteLength / 1024).toFixed(0),
      tris: r.validation.triangles
    })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportLidStl() {
  const { t } = useI18n()
  const r = result.value
  if (!r?.lidMesh || !r.lidValidation?.ok) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noLid')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const buf = meshToBinaryStl(r.lidMesh, r.lidValidation, `${svgName.value} lid`)
    const bb = r.lidBbox!
    const name = downloadBlob(
      lidStlFilename(svgName.value, { width: bb.size[0], height: bb.size[1], lidHeight: bb.size[2] }),
      new Blob([buf], { type: 'model/stl' })
    )
    exportStatus.value = 'done'
    exportMessage.value = t('export.exportedLidStl', { name, kb: (buf.byteLength / 1024).toFixed(0) })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportBambu3mf() {
  const { t } = useI18n()
  const r = result.value
  if (!r?.ok || !r.mesh || !r.validation || !r.bbox) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noTray')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const layer = params.exportLayerHeight
    const snapped = snapBottomToLayer(params.bottomThickness, layer)
    const hasLid = params.lid.enabled && r.lidMesh && r.lidValidation?.ok && r.lidBbox
    const input = {
      tray: { mesh: r.mesh, validation: r.validation, name: 'Tray', bbox: r.bbox },
      params: { bottomThickness: params.bottomThickness },
      hints: { layerHeightMm: layer, elephantFootMm: params.exportElephantFoot },
      projectTitle: svgName.value
    }
    const buf = hasLid
      ? buildBambu3mf({
          ...input,
          lid: { mesh: r.lidMesh!, validation: r.lidValidation!, name: 'Lid', bbox: r.lidBbox! }
        })
      : buildBambuTrayOnlyZip(input)
    const name = downloadBlob(
      threeMfFilename(svgName.value, !!hasLid),
      new Blob([buf], { type: 'application/zip' })
    )
    exportStatus.value = 'done'
    const layerCount = Math.max(1, Math.round(snapped / layer))
    const bottomHint = snapped !== params.bottomThickness
      ? t('export.bottomHint', { mm: snapped, layers: layerCount, layer })
      : ''
    exportMessage.value = hasLid
      ? t('export.exportedBambu', { name, bottomHint })
      : t('export.exportedBambuTrayOnly', { name, bottomHint })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportTray3mf() {
  const { t } = useI18n()
  const r = result.value
  if (!r?.ok || !r.mesh || !r.validation || !r.bbox) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noTray')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const buf = buildSinglePlate3mf(r.mesh, 'Model', r.bbox, 128)
    const name = downloadBlob(single3mfFilename(svgName.value), new Blob([buf], { type: 'model/3mf' }))
    exportStatus.value = 'done'
    exportMessage.value = t('export.exported3mf', { name })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportCutSvg(style: Svg2dExportStyle) {
  const { t } = useI18n()
  const r = result.value
  if (!r?.ok || !r.cutLayers?.length || !r.bbox) {
    exportStatus.value = 'error'
    exportMessage.value = t('export.noCutGeometry')
    return
  }
  exportStatus.value = 'exporting'
  try {
    const text = cutLayersToSvg(
      r.cutLayers,
      { width: r.bbox.size[0], height: r.bbox.size[1] },
      style,
      style === 'filled' ? r.outline : undefined
    )
    const name = downloadBlob(
      cutFilename(svgName.value, r.bbox.size[0], r.bbox.size[1], style),
      new Blob([text], { type: 'image/svg+xml' })
    )
    exportStatus.value = 'done'
    exportMessage.value = style === 'filled'
      ? t('export.exportedFilled', { name })
      : t('export.exportedCut', {
          name,
          layers: r.cutLayers.length,
          kerf: params.cutKerf
        })
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

export function useTrayApp() {
  start()
  return {
    svgName, parsed, selectedIds, params, lockAspect, status, result, exportStatus, exportMessage, loadError,
    traceStatus, traceWarnings, inputWarnings, generatedSvgText, fromImage, sourceRasterUrl, imageTraceParams, lastImageFile,
    previewPart,
    selectedShapes, aspect, setWidth, setHeight, loadFile, loadSample, clearSvg, resetParams, regenerate, retraceImage,
    setPieceMode, normalizeDividers, addCustomDivider, removeCustomDivider, customSplitRegionOptions, saveProjectFile, loadProjectFile, copyShareLink,
    exportStl, exportLidStl, exportBambu3mf, exportTray3mf, exportCutSvg, exportSvg
  }
}
