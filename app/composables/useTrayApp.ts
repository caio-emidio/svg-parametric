import { computed, reactive, ref, shallowRef, watch } from 'vue'
import {
  DEFAULT_DIVIDERS,
  DEFAULT_LID,
  DEFAULT_PARAMS,
  SAMPLES,
  cutFilename,
  cutLayersToSvg,
  defaultImageToSvgParams,
  lidStlFilename,
  meshToBinaryStl,
  parseSvg,
  stlFilename,
  type ImageToSvgParams,
  type Issue,
  type SvgParseResult,
  type TrayParams,
  type TrayResult
} from '~/engine'
import type { ImageTraceWorkerResult } from '~/workers/image-trace.worker'

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
    applyTracedSvg(ev.data.svg, ev.data.selectedShapeIds, ev.data.traceWarnings)
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
  watch(params, () => schedule(), { deep: true })
  watch(selectedIds, () => { syncHeight(); schedule(60) }, { deep: true })
}

function syncHeight() {
  if (lockAspect.value) params.height = round(params.width / aspect.value)
}

const round = (n: number) => Math.round(n * 100) / 100

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

function loadSvgText(text: string, name: string, opts?: { selectedIds?: string[], traceWarnings?: Issue[], fromImage?: boolean }) {
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
  }
  selectedIds.value = opts?.selectedIds?.length ? opts.selectedIds : p.shapes.map(s => s.id)
  if (!p.shapes.length) status.value = 'error'
  else schedule(60)
  exportStatus.value = 'idle'
  exportMessage.value = ''
}

function applyTracedSvg(svg: string, selectedShapeIds: string[], warnings: Issue[]) {
  loadSvgText(svg, svgNameFromImage(svgName.value), {
    selectedIds: selectedShapeIds,
    traceWarnings: warnings,
    fromImage: true
  })
}

async function traceImageFile(file: File) {
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
    loadError.value = { code: 'UNSUPPORTED_FILE', message: 'Choose an SVG or a silhouette image (PNG, JPEG, WebP).' }
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
}

function resetParams() {
  Object.assign(params, { ...DEFAULT_PARAMS, dividers: { ...DEFAULT_DIVIDERS }, lid: { ...DEFAULT_LID } })
  lockAspect.value = true
  syncHeight()
}

function regenerate() { schedule(0) }

async function retraceImage() {
  const f = lastImageFile.value
  if (!f) return
  await traceImageFile(f)
}

function exportSvg() {
  const text = generatedSvgText.value
  if (!text) {
    exportStatus.value = 'error'
    exportMessage.value = 'No SVG to export.'
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
    exportMessage.value = `Exported ${a.download}`
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
  const r = result.value
  if (!r?.ok || !r.mesh || !r.validation) {
    exportStatus.value = 'error'
    exportMessage.value = 'Export blocked: there is no valid model.'
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
    exportMessage.value = `Exported ${name} (${(buf.byteLength / 1024).toFixed(0)} KB, ${r.validation.triangles} triangles)`
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportLidStl() {
  const r = result.value
  if (!r?.lidMesh || !r.lidValidation?.ok) {
    exportStatus.value = 'error'
    exportMessage.value = 'Export blocked: there is no valid lid.'
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
    exportMessage.value = `Exported ${name} (${(buf.byteLength / 1024).toFixed(0)} KB)`
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

function exportCutSvg() {
  const r = result.value
  if (!r?.ok || !r.cutLayers?.length || !r.bbox) {
    exportStatus.value = 'error'
    exportMessage.value = 'Export blocked: no cut geometry is available.'
    return
  }
  exportStatus.value = 'exporting'
  try {
    const text = cutLayersToSvg(r.cutLayers, { width: r.bbox.size[0], height: r.bbox.size[1] })
    const name = downloadBlob(
      cutFilename(svgName.value, r.bbox.size[0], r.bbox.size[1]),
      new Blob([text], { type: 'image/svg+xml' })
    )
    exportStatus.value = 'done'
    exportMessage.value = `Exported ${name} (${r.cutLayers.length} layer(s), kerf ${params.cutKerf} mm)`
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
    exportStl, exportLidStl, exportCutSvg, exportSvg
  }
}
