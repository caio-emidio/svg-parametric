import type { BinaryMask } from './image-mask'
import { maskToImageData } from './image-mask'

export interface TraceParams {
  /** 0 = more detail, 1 = stronger simplification (maps to Potrace opttolerance). */
  simplification: number
  /** Suppress speckles smaller than this (Potrace turdsize). */
  turdSize: number
}

export const DEFAULT_TRACE: TraceParams = {
  simplification: 0.35,
  turdSize: 2
}

export function traceParamsFromSimplification(simplification: number): TraceParams {
  const s = Math.max(0, Math.min(1, simplification))
  return {
    simplification: s,
    turdSize: Math.round(2 + s * 8),
  }
}

function potraceOptions(params: TraceParams) {
  const s = Math.max(0, Math.min(1, params.simplification))
  return {
    turdsize: params.turdSize,
    turnpolicy: 4,
    alphamax: 1,
    opticurve: 1,
    opttolerance: 0.05 + s * 0.45,
    pathonly: false as const,
    extractcolors: false,
    posterizelevel: 1,
    posterizationalgorithm: 0
  }
}

let potraceReady: Promise<void> | null = null

async function ensurePotrace() {
  if (!potraceReady) {
    potraceReady = (async () => {
      const { init } = await import('esm-potrace-wasm')
      await init()
    })()
  }
  await potraceReady
}

/** Trace a binary mask to a minimal SVG string (Potrace, black silhouette on white). */
export async function traceMaskToSvg(mask: BinaryMask, params: Partial<TraceParams> = {}): Promise<string> {
  const p = { ...DEFAULT_TRACE, ...params }
  await ensurePotrace()
  const { potrace } = await import('esm-potrace-wasm')
  const imageData = maskToImageData(mask)
  const raw = await potrace(imageData, potraceOptions(p))
  return normalizeTracedSvg(raw, mask.width, mask.height)
}

/** Potrace may return a full document; coerce to a single-path SVG our parser accepts. */
export function normalizeTracedSvg(raw: string, width: number, height: number): string {
  const trimmed = raw.trim()
  const pathMatch = trimmed.match(/<path[^>]*\sd=["']([^"']+)["'][^>]*>/i)
  if (pathMatch) {
    const d = pathMatch[1]!
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><path d="${d}" fill="#000000" fill-rule="evenodd"/></svg>`
  }
  if (trimmed.includes('<svg')) return trimmed
  throw new Error('Tracing produced no usable paths.')
}
