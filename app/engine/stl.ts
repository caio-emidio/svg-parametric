import type { MeshData, MeshValidation } from './types'

/** Serialises a mesh to binary STL (little-endian, mm). Refuses meshes that failed validation. */
export function meshToBinaryStl(mesh: MeshData, validation: MeshValidation, name = 'svg-parametric tray'): ArrayBuffer {
  if (!validation.ok) throw new Error('Refusing to export a mesh that failed validation (not watertight / inconsistent orientation).')
  const tris = mesh.indices.length / 3
  const buf = new ArrayBuffer(84 + tris * 50)
  const dv = new DataView(buf)
  const header = new TextEncoder().encode(name.slice(0, 79))
  new Uint8Array(buf, 0, 80).set(header)
  dv.setUint32(80, tris, true)
  const p = mesh.positions
  let o = 84
  for (let t = 0; t < tris; t++) {
    const a = mesh.indices[t * 3]! * 3, b = mesh.indices[t * 3 + 1]! * 3, c = mesh.indices[t * 3 + 2]! * 3
    const ux = p[b]! - p[a]!, uy = p[b + 1]! - p[a + 1]!, uz = p[b + 2]! - p[a + 2]!
    const vx = p[c]! - p[a]!, vy = p[c + 1]! - p[a + 1]!, vz = p[c + 2]! - p[a + 2]!
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx
    const l = Math.hypot(nx, ny, nz) || 1
    nx /= l; ny /= l; nz /= l
    dv.setFloat32(o, nx, true); dv.setFloat32(o + 4, ny, true); dv.setFloat32(o + 8, nz, true)
    o += 12
    for (const i of [a, b, c]) {
      dv.setFloat32(o, p[i]!, true); dv.setFloat32(o + 4, p[i + 1]!, true); dv.setFloat32(o + 8, p[i + 2]!, true)
      o += 12
    }
    dv.setUint16(o, 0, true); o += 2
  }
  return buf
}

/** Reads a binary STL back (used by tests and for an export integrity check). */
export function parseBinaryStl(buf: ArrayBuffer): { triangles: number, normals: Float32Array, positions: Float32Array } {
  const dv = new DataView(buf)
  const triangles = dv.getUint32(80, true)
  if (buf.byteLength !== 84 + triangles * 50) throw new Error('Corrupt STL: size does not match triangle count')
  const normals = new Float32Array(triangles * 3)
  const positions = new Float32Array(triangles * 9)
  let o = 84
  for (let t = 0; t < triangles; t++) {
    for (let k = 0; k < 3; k++) normals[t * 3 + k] = dv.getFloat32(o + k * 4, true)
    o += 12
    for (let k = 0; k < 9; k++) positions[t * 9 + k] = dv.getFloat32(o + k * 4, true)
    o += 36 + 2
  }
  return { triangles, normals, positions }
}

export function stlFilename(svgName: string | undefined, p: { width: number, height: number, wallHeight: number }): string {
  const base = (svgName ?? 'tray').replace(/\.svg$/i, '').replace(/[^a-z0-9_-]+/gi, '_').replace(/^_+|_+$/g, '') || 'tray'
  return `${base}_tray_${Math.round(p.width)}x${Math.round(p.height)}x${Math.round(p.wallHeight)}mm.stl`
}
