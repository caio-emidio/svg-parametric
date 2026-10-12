import type { MeshData, MeshValidation } from './types'

/**
 * Independent topological validation of a triangle mesh. Vertices are welded by position first, then every
 * directed edge must occur exactly once and be matched by exactly one opposite edge (closed, 2-manifold,
 * consistently oriented). The signed volume must be positive (normals pointing outwards).
 */
export function validateMesh(mesh: MeshData): MeshValidation {
  const { positions, indices } = mesh
  const triCount = Math.floor(indices.length / 3)
  const weld = new Map<string, number>()
  const remap = new Int32Array(positions.length / 3)
  const scale = 1e4
  let vertices = 0
  for (let i = 0; i < remap.length; i++) {
    const key = `${Math.round(positions[i * 3]! * scale)},${Math.round(positions[i * 3 + 1]! * scale)},${Math.round(positions[i * 3 + 2]! * scale)}`
    let id = weld.get(key)
    if (id === undefined) { id = vertices++; weld.set(key, id) }
    remap[i] = id
  }

  const directed = new Map<number, number>()
  const parent = new Int32Array(vertices).map((_, i) => i)
  const find = (x: number): number => { while (parent[x] !== x) { parent[x] = parent[parent[x]!]!; x = parent[x]! } return x }
  let degenerate = 0
  let volume = 0
  const used = new Set<number>()
  for (let t = 0; t < triCount; t++) {
    const ia = indices[t * 3]!, ib = indices[t * 3 + 1]!, ic = indices[t * 3 + 2]!
    const a = remap[ia]!, b = remap[ib]!, c = remap[ic]!
    const ax = positions[ia * 3]!, ay = positions[ia * 3 + 1]!, az = positions[ia * 3 + 2]!
    const bx = positions[ib * 3]!, by = positions[ib * 3 + 1]!, bz = positions[ib * 3 + 2]!
    const cx = positions[ic * 3]!, cy = positions[ic * 3 + 1]!, cz = positions[ic * 3 + 2]!
    volume += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az
    const area2 = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx)
    if (a === b || b === c || a === c || area2 < 1e-12) { degenerate++; continue }
    for (const [p, q] of [[a, b], [b, c], [c, a]] as const) {
      const key = p * vertices + q
      directed.set(key, (directed.get(key) ?? 0) + 1)
    }
    used.add(a); used.add(b); used.add(c)
    parent[find(a)] = find(b); parent[find(b)] = find(c)
  }

  let openEdges = 0, nonManifoldEdges = 0, inconsistentEdges = 0
  for (const [key, count] of directed) {
    const p = Math.floor(key / vertices), q = key % vertices
    const rev = directed.get(q * vertices + p) ?? 0
    if (count > 1) nonManifoldEdges++
    if (rev === 0) {
      // Same-direction duplicate is an orientation problem; a single unmatched edge is an open boundary.
      if (count === 1) openEdges++
    } else if (rev !== count) nonManifoldEdges++
  }
  // inconsistent orientation shows up as an edge used twice in the same direction
  for (const count of directed.values()) if (count > 1) inconsistentEdges++

  const roots = new Set<number>()
  for (const v of used) roots.add(find(v))
  const watertight = openEdges === 0 && triCount > 0
  const manifold = nonManifoldEdges === 0
  const consistentlyOriented = inconsistentEdges === 0
  return {
    ok: watertight && manifold && consistentlyOriented && degenerate === 0 && volume > 0,
    watertight, manifold, consistentlyOriented,
    degenerateTriangles: degenerate, openEdges, nonManifoldEdges, inconsistentEdges,
    volume, triangles: triCount, vertices, components: roots.size
  }
}
