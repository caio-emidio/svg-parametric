import Module from 'manifold-3d'

export type ManifoldModule = Awaited<ReturnType<typeof Module>>

let loading: Promise<ManifoldModule> | null = null

/** Loads and initialises the Manifold WASM module once. In browsers pass the bundled .wasm URL. */
export function loadManifold(wasmUrl?: string): Promise<ManifoldModule> {
  loading ??= (async () => {
    const m = await Module(wasmUrl ? { locateFile: () => wasmUrl } : undefined)
    m.setup()
    return m
  })()
  return loading
}
