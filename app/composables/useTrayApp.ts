import { computed, reactive, ref, shallowRef, watch } from 'vue'
import { DEFAULT_PARAMS, SAMPLES, meshToBinaryStl, parseSvg, stlFilename, type Issue, type SvgParseResult, type TrayParams, type TrayResult } from '~/engine'

export type GenStatus = 'idle' | 'generating' | 'ready' | 'error'
export type ExportStatus = 'idle' | 'exporting' | 'done' | 'error'

// Module-level singleton state (SPA, one instance of the app).
const svgName = ref<string>('')
const parsed = shallowRef<SvgParseResult | null>(null)
const selectedIds = ref<string[]>([])
const params = reactive<TrayParams>({ ...DEFAULT_PARAMS })
const lockAspect = ref(true)
const status = ref<GenStatus>('idle')
const result = shallowRef<TrayResult | null>(null)
const exportStatus = ref<ExportStatus>('idle')
const exportMessage = ref('')
const loadError = ref<Issue | null>(null)

let worker: Worker | null = null
let nextJob = 0
let inFlight: number | null = null
let pending = false
let debounce: ReturnType<typeof setTimeout> | undefined
let started = false

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

function ensureWorker() {
  if (worker) return worker
  worker = new Worker(new URL('../workers/geometry.worker.ts', import.meta.url), { type: 'module' })
  worker.onmessage = (ev: MessageEvent<{ id: number, result: TrayResult }>) => {
    // Obsolete results (older job ids) are dropped.
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

function dispatch() {
  if (!selectedShapes.value.length) { status.value = 'idle'; result.value = null; return }
  // Only one job runs at a time; further changes coalesce into a single follow-up job with the latest params.
  if (inFlight !== null) { pending = true; return }
  status.value = 'generating'
  inFlight = ++nextJob
  ensureWorker().postMessage({ id: inFlight, shapes: JSON.parse(JSON.stringify(selectedShapes.value)), params: { ...params } })
}

function schedule(delay = 250) {
  clearTimeout(debounce)
  if (selectedShapes.value.length) status.value = 'generating'
  debounce = setTimeout(dispatch, delay)
}

function start() {
  if (started) return
  started = true
  watch(() => ({ ...params }), () => schedule())
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

function loadSvgText(text: string, name: string) {
  start()
  const p = parseSvg(text)
  svgName.value = name
  parsed.value = p
  loadError.value = p.errors[0] ?? null
  result.value = null
  // Preserve parameters across SVG replacement; dimensions follow the new aspect ratio when locked.
  selectedIds.value = p.shapes.map(s => s.id)
  if (!p.shapes.length) status.value = 'error'
  exportStatus.value = 'idle'
  exportMessage.value = ''
}

async function loadFile(file: File) {
  if (!/\.svg$/i.test(file.name) && file.type !== 'image/svg+xml') {
    start()
    parsed.value = null
    svgName.value = file.name
    loadError.value = { code: 'NOT_SVG', message: 'Please choose an .svg file.' }
    return
  }
  loadSvgText(await file.text(), file.name)
}

function loadSample(id: string) {
  const s = SAMPLES.find(x => x.id === id)
  if (s) loadSvgText(s.svg, `${s.id}.svg`)
}

function clearSvg() {
  parsed.value = null
  svgName.value = ''
  selectedIds.value = []
  result.value = null
  status.value = 'idle'
  loadError.value = null
}

function resetParams() {
  Object.assign(params, DEFAULT_PARAMS)
  lockAspect.value = true
  syncHeight()
}

function regenerate() { schedule(0) }

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
    const url = URL.createObjectURL(new Blob([buf], { type: 'model/stl' }))
    const a = document.createElement('a')
    a.href = url
    a.download = stlFilename(svgName.value, { width: r.bbox!.size[0], height: r.bbox!.size[1], wallHeight: r.bbox!.size[2] })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
    exportStatus.value = 'done'
    exportMessage.value = `Exported ${a.download} (${(buf.byteLength / 1024).toFixed(0)} KB, ${r.validation.triangles} triangles)`
  } catch (e) {
    exportStatus.value = 'error'
    exportMessage.value = (e as Error).message
  }
}

export function useTrayApp() {
  start()
  return {
    svgName, parsed, selectedIds, params, lockAspect, status, result, exportStatus, exportMessage, loadError,
    selectedShapes, aspect, setWidth, setHeight, loadFile, loadSample, clearSvg, resetParams, regenerate, exportStl
  }
}
