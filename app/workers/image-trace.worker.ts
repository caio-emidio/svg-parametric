/// <reference lib="webworker" />
import { defaultImageToSvgParams, imageDataToSvg, type ImageToSvgParams } from '../engine'

export interface ImageTraceJob {
  id: number
  buffer: ArrayBuffer
  mimeType: string
  params: Partial<ImageToSvgParams>
}

export type ImageTraceWorkerResult =
  | { id: number, ok: true, svg: string, selectedShapeIds: string[], traceWarnings: { code: string, message: string }[] }
  | { id: number, ok: false, error: { code: string, message: string } }

const MAX_FILE_BYTES = 25 * 1024 * 1024

self.onmessage = async (ev: MessageEvent<ImageTraceJob>) => {
  const { id, buffer, mimeType, params } = ev.data
  let result: ImageTraceWorkerResult
  try {
    if (buffer.byteLength > MAX_FILE_BYTES) {
      throw new Error('Image is too large (limit 25 MB).')
    }
    const blob = new Blob([buffer], { type: mimeType || 'application/octet-stream' })
    const bitmap = await createImageBitmap(blob)
    const w = bitmap.width, h = bitmap.height
    if (w < 2 || h < 2) throw new Error('Image is too small to trace.')
    const canvas = new OffscreenCanvas(w, h)
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) throw new Error('Could not read image pixels.')
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close()
    const imageData = ctx.getImageData(0, 0, w, h)
    const merged = { ...defaultImageToSvgParams(), ...params }
    const traced = await imageDataToSvg(imageData, merged)
    if (traced.parsed.errors.length) {
      throw new Error(traced.parsed.errors[0]!.message)
    }
    result = {
      id,
      ok: true,
      svg: traced.svg,
      selectedShapeIds: traced.selectedShapeIds,
      traceWarnings: traced.analysis.warnings
    }
  } catch (e) {
    result = {
      id,
      ok: false,
      error: { code: 'TRACE_FAILED', message: (e as Error).message || 'Image tracing failed.' }
    }
  }
  ;(self as unknown as Worker).postMessage(result)
}
