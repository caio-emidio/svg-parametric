import type { Issue, SvgParseResult } from './types'
import { area } from './svg-parse'
import { parseSvg } from './svg-parse'
import type { ImageMaskParams } from './image-mask'
import { defaultImageMaskParams, downscaleMask, imageDataToMask } from './image-mask'
import type { TraceParams } from './image-trace'
import { DEFAULT_TRACE, traceMaskToSvg, traceParamsFromSimplification } from './image-trace'

export const MAX_TRACE_PIXELS = 4096 * 4096
export const MAX_TRACE_DIMENSION = 2048

export interface ImageToSvgParams extends ImageMaskParams {
  simplification: number
  largestContourOnly: boolean
}

export function defaultImageToSvgParams(): ImageToSvgParams {
  return {
    ...defaultImageMaskParams(),
    simplification: DEFAULT_TRACE.simplification,
    largestContourOnly: false
  }
}

export interface TraceAnalysisMetrics {
  shapeCount: number
  contourCount: number
  totalPoints: number
  largestShapeArea: number
}

export interface TraceAnalysis {
  warnings: Issue[]
  metrics: TraceAnalysisMetrics
  /** When `largestContourOnly` is useful: ids of shapes to keep. */
  suggestedShapeIds: string[]
}

export function shapeAbsoluteArea(shape: SvgParseResult['shapes'][0]): number {
  let sum = 0
  for (const c of shape.contours) sum += Math.abs(area(c))
  return sum
}

export function analyzeTracedSvg(parsed: SvgParseResult): TraceAnalysis {
  const warnings: Issue[] = []
  let contourCount = 0
  let totalPoints = 0
  let largestShapeArea = 0
  const areas: { id: string, area: number }[] = []

  for (const s of parsed.shapes) {
    contourCount += s.contours.length
    for (const c of s.contours) totalPoints += c.length
    const a = shapeAbsoluteArea(s)
    areas.push({ id: s.id, area: a })
    if (a > largestShapeArea) largestShapeArea = a
  }

  areas.sort((x, y) => y.area - x.area)
  const suggestedShapeIds = areas.length ? [areas[0]!.id] : []

  if (parsed.shapes.length > 1) {
    warnings.push({
      code: 'MULTIPLE_COMPONENTS',
      message: `Tracing found ${parsed.shapes.length} separate shapes. For a tray footprint, keep the outer silhouette only (or enable “Use largest contour only”).`
    })
  }
  if (contourCount > 1 && parsed.shapes.length === 1) {
    warnings.push({
      code: 'SMALL_HOLES',
      message: `The traced shape has ${contourCount} contours (outer + holes). Check the 2D preview; disable inner holes if they came from shadows or rim detail.`
    })
  }
  if (totalPoints > 8000) {
    warnings.push({
      code: 'TRACE_TOO_COMPLEX',
      message: `The traced outline has ${totalPoints} points. Increase simplification if generation is slow or unstable.`
    })
  }
  if (parsed.shapes.length > 1 && areas.length >= 2 && areas[1]!.area < largestShapeArea * 0.05) {
    warnings.push({
      code: 'SUGGEST_OUTER_ONLY',
      message: 'Most area is in one shape; smaller blobs look like noise. Consider “Use largest contour only”.'
    })
  }

  return {
    warnings,
    metrics: {
      shapeCount: parsed.shapes.length,
      contourCount,
      totalPoints,
      largestShapeArea
    },
    suggestedShapeIds
  }
}

export interface ImageToSvgResult {
  svg: string
  parsed: SvgParseResult
  analysis: TraceAnalysis
  selectedShapeIds: string[]
}

function fitImageDataToMaxDimension(img: ImageData, maxDim: number): ImageData {
  const { width, height } = img
  if (width <= maxDim && height <= maxDim) return img
  const scale = maxDim / Math.max(width, height)
  const nw = Math.max(1, Math.round(width * scale))
  const nh = Math.max(1, Math.round(height * scale))
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(nw, nh)
    const ctx = canvas.getContext('2d')!
    const tmp = new OffscreenCanvas(width, height)
    tmp.getContext('2d')!.putImageData(img, 0, 0)
    ctx.drawImage(tmp, 0, 0, nw, nh)
    return ctx.getImageData(0, 0, nw, nh)
  }
  return img
}

/** Full pipeline: ImageData → mask → Potrace SVG → parse + analysis. */
export async function imageDataToSvg(img: ImageData, params: Partial<ImageToSvgParams> = {}): Promise<ImageToSvgResult> {
  const p: ImageToSvgParams = { ...defaultImageToSvgParams(), ...params }
  const fitted = fitImageDataToMaxDimension(img, MAX_TRACE_DIMENSION)
  let mask = imageDataToMask(fitted, p)
  mask = downscaleMask(mask, MAX_TRACE_PIXELS)
  const traceParams: TraceParams = traceParamsFromSimplification(p.simplification)
  let svg = await traceMaskToSvg(mask, traceParams)
  let parsed = parseSvg(svg)
  if (parsed.errors.length) {
    throw new Error(parsed.errors[0]!.message)
  }
  let analysis = analyzeTracedSvg(parsed)
  let selectedShapeIds = parsed.shapes.map(s => s.id)

  if (p.largestContourOnly && analysis.suggestedShapeIds.length) {
    selectedShapeIds = analysis.suggestedShapeIds
  }

  return { svg, parsed, analysis, selectedShapeIds }
}
