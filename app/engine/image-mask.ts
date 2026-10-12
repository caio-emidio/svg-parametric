/** Raster → binary silhouette mask (1 = object, 0 = background). */

export interface ImageMaskParams {
  /** Alpha or luminance threshold (0–255). Default 128. */
  threshold: number
  /** Drop isolated specks; keep only the largest foreground blob. */
  keepLargestComponent: boolean
}

export interface BinaryMask {
  width: number
  height: number
  data: Uint8Array
}

const DEFAULT_MASK: ImageMaskParams = {
  threshold: 128,
  keepLargestComponent: true
}

export function defaultImageMaskParams(): ImageMaskParams {
  return { ...DEFAULT_MASK }
}

export function hasMeaningfulAlpha(img: ImageData): boolean {
  const d = img.data
  let transparent = 0
  for (let i = 3; i < d.length; i += 4) {
    if (d[i]! < 250) transparent++
  }
  return transparent > img.width * img.height * 0.002
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function medianCornerRgb(img: ImageData, x0: number, y0: number, size: number): [number, number, number] {
  const rs: number[] = [], gs: number[] = [], bs: number[] = []
  const w = img.width, h = img.height
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const x = Math.min(w - 1, x0 + dx), y = Math.min(h - 1, y0 + dy)
      const i = (y * w + x) * 4
      rs.push(img.data[i]!); gs.push(img.data[i + 1]!); bs.push(img.data[i + 2]!)
    }
  }
  const med = (a: number[]) => { a.sort((p, q) => p - q); return a[(a.length / 2) | 0]! }
  return [med(rs), med(gs), med(bs)]
}

function cornerBackground(img: ImageData): [number, number, number] {
  const s = Math.max(3, Math.min(12, Math.floor(Math.min(img.width, img.height) * 0.02)))
  const corners = [
    medianCornerRgb(img, 0, 0, s),
    medianCornerRgb(img, img.width - s, 0, s),
    medianCornerRgb(img, 0, img.height - s, s),
    medianCornerRgb(img, img.width - s, img.height - s, s)
  ]
  const rs = corners.map(c => c[0]), gs = corners.map(c => c[1]), bs = corners.map(c => c[2])
  rs.sort((a, b) => a - b); gs.sort((a, b) => a - b); bs.sort((a, b) => a - b)
  const m = 2
  return [rs[m]!, gs[m]!, bs[m]!]
}

function colorDist(r: number, g: number, b: number, bg: [number, number, number]): number {
  return Math.hypot(r - bg[0], g - bg[1], b - bg[2])
}

/** Mark background by flooding from image borders (opaque images). */
function floodBackgroundOpaque(img: ImageData, bg: [number, number, number], colorTol: number): Uint8Array {
  const { width: w, height: h } = img
  const n = w * h
  const isBg = new Uint8Array(n)
  const q: number[] = []
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return
    const idx = y * w + x
    if (isBg[idx]) return
    const i = idx * 4
    const r = img.data[i]!, g = img.data[i + 1]!, b = img.data[i + 2]!
    if (colorDist(r, g, b, bg) > colorTol && luminance(r, g, b) < 255 - colorTol * 0.5) return
    isBg[idx] = 1
    q.push(idx)
  }
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1) }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y) }
  while (q.length) {
    const idx = q.pop()!
    const x = idx % w, y = (idx / w) | 0
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1)
  }
  return isBg
}

function maskFromAlpha(img: ImageData, threshold: number): BinaryMask {
  const { width, height } = img
  const data = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) {
    data[p] = img.data[p * 4 + 3]! >= threshold ? 1 : 0
  }
  return { width, height, data }
}

function maskFromOpaque(img: ImageData, threshold: number): BinaryMask {
  const { width, height } = img
  const bg = cornerBackground(img)
  const colorTol = Math.max(8, Math.min(120, threshold))
  const isBg = floodBackgroundOpaque(img, bg, colorTol)
  const data = new Uint8Array(width * height)
  for (let p = 0; p < width * height; p++) data[p] = isBg[p] ? 0 : 1
  return { width, height, data }
}

/** 4-connected components; returns label per pixel (0 = background). */
function labelComponents(mask: BinaryMask): { labels: Int32Array, sizes: Map<number, number> } {
  const { width: w, height: h, data } = mask
  const labels = new Int32Array(w * h)
  let next = 1
  const sizes = new Map<number, number>()
  for (let p = 0; p < w * h; p++) {
    if (!data[p] || labels[p]) continue
    const id = next++
    let count = 0
    const stack = [p]
    labels[p] = id
    while (stack.length) {
      const idx = stack.pop()!
      count++
      const x = idx % w, y = (idx / w) | 0
      for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]] as const) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
        const ni = ny * w + nx
        if (!data[ni] || labels[ni]) continue
        labels[ni] = id
        stack.push(ni)
      }
    }
    sizes.set(id, count)
  }
  return { labels, sizes }
}

export function keepLargestForegroundComponent(mask: BinaryMask): BinaryMask {
  const { labels, sizes } = labelComponents(mask)
  if (sizes.size <= 1) return mask
  let bestId = 0, bestSize = 0
  for (const [id, size] of sizes) if (size > bestSize) { bestSize = size; bestId = id }
  const data = new Uint8Array(mask.data.length)
  for (let p = 0; p < data.length; p++) data[p] = labels[p] === bestId ? 1 : 0
  return { width: mask.width, height: mask.height, data }
}

export function imageDataToMask(img: ImageData, params: Partial<ImageMaskParams> = {}): BinaryMask {
  const p = { ...DEFAULT_MASK, ...params }
  let mask = hasMeaningfulAlpha(img) ? maskFromAlpha(img, p.threshold) : maskFromOpaque(img, p.threshold)
  if (p.keepLargestComponent) mask = keepLargestForegroundComponent(mask)
  return mask
}

/** Downscale so width×height ≤ maxPixels (nearest-neighbor on mask). */
export function downscaleMask(mask: BinaryMask, maxPixels: number): BinaryMask {
  const { width, height } = mask
  if (width * height <= maxPixels) return mask
  const scale = Math.sqrt(maxPixels / (width * height))
  const nw = Math.max(1, Math.round(width * scale))
  const nh = Math.max(1, Math.round(height * scale))
  const data = new Uint8Array(nw * nh)
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const sx = Math.min(width - 1, Math.round((x / nw) * width))
      const sy = Math.min(height - 1, Math.round((y / nh) * height))
      data[y * nw + x] = mask.data[sy * width + sx]!
    }
  }
  return { width: nw, height: nh, data }
}

export function maskToImageData(mask: BinaryMask): ImageData {
  const { width, height, data } = mask
  const out = new ImageData(width, height)
  for (let p = 0; p < width * height; p++) {
    const v = data[p] ? 0 : 255
    const i = p * 4
    out.data[i] = v
    out.data[i + 1] = v
    out.data[i + 2] = v
    out.data[i + 3] = 255
  }
  return out
}
