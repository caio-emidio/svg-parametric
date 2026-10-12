// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest'
import { downscaleMask, imageDataToMask, keepLargestForegroundComponent } from '../app/engine/image-mask'

function solidRect(w: number, h: number, x0: number, y0: number, rw: number, rh: number, alpha = 255): ImageData {
  const img = new ImageData(w, h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const inside = x >= x0 && x < x0 + rw && y >= y0 && y < y0 + rh
      const i = (y * w + x) * 4
      img.data[i] = inside ? 40 : 255
      img.data[i + 1] = inside ? 40 : 255
      img.data[i + 2] = inside ? 40 : 255
      img.data[i + 3] = inside ? alpha : 255
    }
  }
  return img
}

describe('image-mask', () => {
  it('builds mask from alpha silhouette', () => {
    const img = solidRect(64, 64, 16, 16, 32, 32, 255)
    const mask = imageDataToMask(img, { threshold: 128, keepLargestComponent: false })
    expect(mask.width).toBe(64)
    let fg = 0
    for (const v of mask.data) if (v) fg++
    expect(fg).toBe(32 * 32)
  })

  it('keeps largest connected component', () => {
    const mask = { width: 10, height: 10, data: new Uint8Array(100) }
    for (let y = 2; y < 8; y++) for (let x = 2; x < 8; x++) mask.data[y * 10 + x] = 1
    mask.data[0] = 1
    mask.data[1] = 1
    const kept = keepLargestForegroundComponent(mask)
    expect(kept.data[0]).toBe(0)
    expect(kept.data[2 * 10 + 2]).toBe(1)
  })

  it('downscales large masks', () => {
    const mask = { width: 200, height: 200, data: new Uint8Array(40000).fill(1) }
    const small = downscaleMask(mask, 10000)
    expect(small.width * small.height).toBeLessThanOrEqual(10000)
  })
})
