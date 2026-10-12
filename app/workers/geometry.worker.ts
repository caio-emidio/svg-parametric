/// <reference lib="webworker" />
import wasmUrl from 'manifold-3d/manifold.wasm?url'
import { generateTray, loadManifold, type SvgShape, type TrayParams, type TrayResult } from '../engine'

interface Job { id: number, shapes: SvgShape[], params: TrayParams }

self.onmessage = async (ev: MessageEvent<Job>) => {
  const { id, shapes, params } = ev.data
  let result: TrayResult
  try {
    const M = await loadManifold(wasmUrl)
    result = generateTray(M, shapes, params)
  } catch (e) {
    result = { ok: false, errors: [{ code: 'ENGINE_FAILURE', message: `Geometry engine failed: ${(e as Error).message}` }], warnings: [] }
  }
  const transfer: Transferable[] = []
  if (result.mesh) transfer.push(result.mesh.positions.buffer, result.mesh.indices.buffer)
  ;(self as unknown as Worker).postMessage({ id, result }, transfer)
}
