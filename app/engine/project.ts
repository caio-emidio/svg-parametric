import { gzipSync, gunzipSync, strToU8, strFromU8 } from 'fflate'
import { DEFAULT_DIVIDERS, DEFAULT_LID, DEFAULT_PARAMS, type ImageToSvgParams, type TrayParams } from './types'
import { defaultImageToSvgParams } from './svg-from-image'

export const PROJECT_FILE_VERSION = 1
export const PROJECT_FILE_EXT = '.svg-tray.json'
export const URL_HASH_PREFIX = '#p='

export interface ProjectFile {
  version: number
  svgText: string
  svgName: string
  selectedIds: string[]
  params: TrayParams
  lockAspect: boolean
  fromImage: boolean
  imageTraceParams?: ImageToSvgParams
  /** Base64 data URL or raw base64 for retracing (optional). */
  sourceRasterBase64?: string
  sourceRasterMime?: string
}

export function createProjectFile(input: {
  svgText: string
  svgName: string
  selectedIds: string[]
  params: TrayParams
  lockAspect: boolean
  fromImage: boolean
  imageTraceParams?: ImageToSvgParams
  sourceRasterBase64?: string
  sourceRasterMime?: string
}): ProjectFile {
  return {
    version: PROJECT_FILE_VERSION,
    svgText: input.svgText,
    svgName: input.svgName,
    selectedIds: [...input.selectedIds],
    params: JSON.parse(JSON.stringify(input.params)) as TrayParams,
    lockAspect: input.lockAspect,
    fromImage: input.fromImage,
    imageTraceParams: input.imageTraceParams ? { ...input.imageTraceParams } : undefined,
    sourceRasterBase64: input.sourceRasterBase64,
    sourceRasterMime: input.sourceRasterMime
  }
}

export function parseProjectFile(text: string): { ok: true, project: ProjectFile } | { ok: false, error: string } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return { ok: false, error: 'Invalid project JSON.' }
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: 'Invalid project file.' }
  const p = raw as Partial<ProjectFile>
  if (p.version !== PROJECT_FILE_VERSION) return { ok: false, error: `Unsupported project version (${String(p.version)}).` }
  if (typeof p.svgText !== 'string' || !p.svgText.trim()) return { ok: false, error: 'Project is missing SVG content.' }
  if (!p.params || typeof p.params !== 'object') return { ok: false, error: 'Project is missing parameters.' }
  return {
    ok: true,
    project: {
      version: PROJECT_FILE_VERSION,
      svgText: p.svgText,
      svgName: typeof p.svgName === 'string' ? p.svgName : 'project.svg',
      selectedIds: Array.isArray(p.selectedIds) ? p.selectedIds.filter((id): id is string => typeof id === 'string') : [],
      params: normalizeParams(p.params as TrayParams),
      lockAspect: p.lockAspect !== false,
      fromImage: !!p.fromImage,
      imageTraceParams: p.imageTraceParams as ImageToSvgParams | undefined,
      sourceRasterBase64: typeof p.sourceRasterBase64 === 'string' ? p.sourceRasterBase64 : undefined,
      sourceRasterMime: typeof p.sourceRasterMime === 'string' ? p.sourceRasterMime : undefined
    }
  }
}

function normalizeParams(p: TrayParams): TrayParams {
  return {
    ...DEFAULT_PARAMS,
    ...p,
    dividers: { ...DEFAULT_DIVIDERS, ...p.dividers, customLines: p.dividers?.customLines ?? [] },
    lid: { ...DEFAULT_LID, ...p.lid }
  }
}

function toBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!)
  return btoa(s)
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function projectToJson(project: ProjectFile): string {
  return JSON.stringify(project)
}

export function encodeProjectUrl(project: ProjectFile): string {
  const compressed = gzipSync(strToU8(projectToJson(project)))
  return `${URL_HASH_PREFIX}${encodeURIComponent(toBase64(compressed))}`
}

export function decodeProjectFromUrlHash(hash: string): { ok: true, project: ProjectFile } | { ok: false, error: string } {
  if (!hash.startsWith(URL_HASH_PREFIX)) return { ok: false, error: 'No project in URL.' }
  try {
    const b64 = decodeURIComponent(hash.slice(URL_HASH_PREFIX.length))
    const json = strFromU8(gunzipSync(fromBase64(b64)))
    return parseProjectFile(json)
  } catch {
    return { ok: false, error: 'Could not decode project link.' }
  }
}

export function projectFilename(svgName: string | undefined): string {
  const base = (svgName ?? 'project').replace(/\.svg$/i, '').replace(/[^\w.-]+/gi, '_') || 'project'
  return `${base}${PROJECT_FILE_EXT}`
}
