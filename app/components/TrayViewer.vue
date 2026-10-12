<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Box, Grid3x3, Home, Layers, Loader2, Upload } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import { SAMPLES } from '~/engine'
import { useTrayApp, type PreviewPart } from '~/composables/useTrayApp'
import { useI18n } from '~/composables/useI18n'

const app = useTrayApp()
const { t, sampleName } = useI18n()
const previewOptions = computed(() => (
  (['tray', 'lid', 'both'] as PreviewPart[]).map(id => ({ id, label: t(`viewer.preview.${id}`) }))
))
const host = ref<HTMLDivElement>()
const wireframe = ref(false)
const labels = ref<{ text: string, x: number, y: number, show: boolean }[]>([
  { text: '', x: 0, y: 0, show: false }, { text: '', x: 0, y: 0, show: false }, { text: '', x: 0, y: 0, show: false }
])

let renderer: THREE.WebGLRenderer
let scene: THREE.Scene
let camera: THREE.PerspectiveCamera
let controls: OrbitControls
let mesh: THREE.Mesh | null = null
let lidMesh: THREE.Mesh | null = null
let grid: THREE.GridHelper | null = null
let floor: THREE.Mesh
let dimLines: THREE.LineSegments | null = null
let raf = 0
let ro: ResizeObserver
let center = new THREE.Vector3()
let radius = 100
let size = new THREE.Vector3()
let min = new THREE.Vector3()
const webglFailed = ref(false)
const webglError = computed(() => (webglFailed.value ? t('viewer.webglError') : ''))

onMounted(() => {
  const el = host.value!
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true })
  } catch (e) {
    webglFailed.value = true
    return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFShadowMap
  el.appendChild(renderer.domElement)
  renderer.domElement.className = 'block h-full w-full'

  scene = new THREE.Scene()
  scene.background = new THREE.Color(0x3a3d43)
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 10000)
  camera.up.set(0, 0, 1) // z-up: matches the STL / printer coordinate system
  controls = new OrbitControls(camera, renderer.domElement)
  controls.enableDamping = true
  controls.dampingFactor = 0.08

  scene.add(new THREE.HemisphereLight(0xffffff, 0x555560, 0.9))
  const key = new THREE.DirectionalLight(0xffffff, 2.2)
  key.position.set(120, -160, 240)
  key.castShadow = true
  key.shadow.mapSize.set(2048, 2048)
  key.shadow.bias = -0.0005
  key.name = 'key'
  scene.add(key)
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.6)
  fill.position.set(-150, 120, 80)
  scene.add(fill)

  floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000), new THREE.ShadowMaterial({ opacity: 0.35 }))
  floor.receiveShadow = true
  floor.position.z = -0.02
  scene.add(floor)

  ro = new ResizeObserver(resize)
  ro.observe(el)
  resize()
  const loop = () => {
    raf = requestAnimationFrame(loop)
    controls.update()
    renderer.render(scene, camera)
    updateLabels()
  }
  loop()
  watch([() => app.result.value, () => app.previewPart.value], () => syncPreview(), { immediate: true })
})

function resize() {
  const el = host.value
  if (!el || !renderer) return
  const w = el.clientWidth, h = el.clientHeight
  renderer.setSize(w, h, false)
  camera.aspect = w / Math.max(h, 1)
  camera.updateProjectionMatrix()
}

function disposeMeshObj(m: THREE.Mesh | null) {
  if (!m) return
  m.geometry.dispose()
  ;(m.material as THREE.Material).dispose()
  scene.remove(m)
}

function clearMesh() {
  disposeMeshObj(mesh); mesh = null
  disposeMeshObj(lidMesh); lidMesh = null
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid = null }
  if (dimLines) { scene.remove(dimLines); dimLines.geometry.dispose(); dimLines = null }
}

function buildMesh(positions: Float32Array, indices: Uint32Array, color: number) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
  g.setIndex(new THREE.BufferAttribute(indices.slice(), 1))
  const flat = g.toNonIndexed()
  g.dispose()
  flat.computeVertexNormals()
  flat.computeBoundingBox()
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.05, wireframe: wireframe.value })
  const m = new THREE.Mesh(flat, mat)
  m.castShadow = true
  m.receiveShadow = true
  return m
}

function fitCamera(first: boolean) {
  const group = new THREE.Box3()
  if (mesh) group.expandByObject(mesh)
  if (lidMesh) group.expandByObject(lidMesh)
  if (group.isEmpty()) return
  group.getSize(size); min.copy(group.min)
  group.getCenter(center)
  radius = Math.max(size.length() / 2, 10)
  rebuildGrid(group)
  const key = scene.getObjectByName('key') as THREE.DirectionalLight
  key.shadow.camera.left = -radius * 1.6; key.shadow.camera.right = radius * 1.6
  key.shadow.camera.top = radius * 1.6; key.shadow.camera.bottom = -radius * 1.6
  key.shadow.camera.far = radius * 12
  key.shadow.camera.updateProjectionMatrix()
  key.target.position.copy(center); scene.add(key.target)
  key.position.copy(center).add(new THREE.Vector3(radius * 0.8, -radius * 1.2, radius * 2.2))
  if (first) preset('iso')
  else controls.target.copy(center)
}

function syncPreview() {
  const r = app.result.value
  const part = app.previewPart.value
  const first = !mesh && !lidMesh
  disposeMeshObj(mesh); mesh = null
  disposeMeshObj(lidMesh); lidMesh = null
  const showTray = part !== 'lid' && r?.mesh
  const showLid = (part === 'lid' || part === 'both') && r?.lidMesh
  if (showTray) {
    mesh = buildMesh(r!.mesh!.positions, r!.mesh!.indices, 0xe8a35c)
    scene.add(mesh)
  }
  if (showLid) {
    lidMesh = buildMesh(r!.lidMesh!.positions, r!.lidMesh!.indices, 0x7eb8da)
    scene.add(lidMesh)
  }
  if (mesh || lidMesh) fitCamera(first)
  else clearMesh()
}

function rebuildGrid(bb: THREE.Box3) {
  if (grid) { scene.remove(grid); grid.geometry.dispose() }
  if (dimLines) { scene.remove(dimLines); dimLines.geometry.dispose() }
  // 10 mm cells; extents rounded up to the next 50 mm so the scale is readable
  const extent = Math.ceil(Math.max(size.x, size.y) * 2 / 50) * 50 + 50
  grid = new THREE.GridHelper(extent, extent / 10, 0x9aa0aa, 0x5b6068)
  grid.rotation.x = Math.PI / 2
  grid.position.set(0, 0, 0)
  scene.add(grid)

  const o = 3
  const x0 = bb.min.x, x1 = bb.max.x, y0 = bb.min.y, y1 = bb.max.y, z1 = bb.max.z
  const pts = [
    x0, y0 - o, 0, x1, y0 - o, 0, // width, along front edge
    x1 + o, y0, 0, x1 + o, y1, 0, // depth
    x1 + o, y0 - o, 0, x1 + o, y0 - o, z1 // height
  ]
  const lg = new THREE.BufferGeometry()
  lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3))
  dimLines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: 0xfbbf24 }))
  scene.add(dimLines)
}

const v = new THREE.Vector3()
function updateLabels() {
  if (!mesh || !host.value) return
  const spots: [number, number, number, string][] = [
    [min.x + size.x / 2, min.y - 3, 0, `${size.x.toFixed(1)} mm`],
    [min.x + size.x + 3, min.y + size.y / 2, 0, `${size.y.toFixed(1)} mm`],
    [min.x + size.x + 3, min.y - 3, size.z / 2, `${size.z.toFixed(1)} mm`]
  ]
  const w = host.value.clientWidth, h = host.value.clientHeight
  spots.forEach(([x, y, z, text], i) => {
    v.set(x, y, z).project(camera)
    const l = labels.value[i]!
    const px = (v.x * 0.5 + 0.5) * w, py = (-v.y * 0.5 + 0.5) * h
    if (l.text !== text || Math.abs(l.x - px) > 0.5 || Math.abs(l.y - py) > 0.5 || l.show !== (v.z < 1)) {
      l.text = text; l.x = px; l.y = py; l.show = v.z < 1
    }
  })
}

function preset(kind: 'top' | 'front' | 'side' | 'iso') {
  if (!camera) return
  const d = radius / Math.tan((camera.fov * Math.PI) / 360) * 1.15
  const dir = {
    top: new THREE.Vector3(0, -0.0001, 1),
    front: new THREE.Vector3(0, -1, 0.0001),
    side: new THREE.Vector3(1, 0, 0.0001),
    iso: new THREE.Vector3(0.8, -1, 0.9)
  }[kind].normalize()
  controls.target.copy(center)
  camera.position.copy(center).addScaledVector(dir, d)
  camera.near = d / 100; camera.far = d * 50
  camera.updateProjectionMatrix()
  controls.update()
}

watch(wireframe, w => {
  for (const m of [mesh, lidMesh]) {
    if (m) (m.material as THREE.MeshStandardMaterial).wireframe = w
  }
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  ro?.disconnect()
  controls?.dispose()
  if (scene) {
    clearMesh()
    floor.geometry.dispose()
    ;(floor.material as THREE.Material).dispose()
  }
  renderer?.dispose()
  renderer?.domElement.remove()
})
</script>

<template>
  <div class="relative h-full min-h-[280px] w-full overflow-hidden">
    <div ref="host" class="absolute inset-0" data-testid="viewer" />

    <div v-if="webglError" class="absolute inset-0 grid place-items-center p-6 text-center text-sm text-destructive">{{ webglError }}</div>

    <template v-for="(l, i) in labels" :key="i">
      <span
        v-show="l.show && (app.result.value?.mesh || app.result.value?.lidMesh)" class="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-300"
        :style="{ left: l.x + 'px', top: l.y + 'px' }"
      >{{ ['W', 'D', 'H'][i] }} {{ l.text }}</span>
    </template>

    <div class="absolute left-3 top-3 flex flex-wrap items-center gap-1 rounded-lg border bg-card/90 p-1 backdrop-blur">
      <Button variant="ghost" size="sm" @click="preset('top')"><Layers class="size-3" />{{ t('viewer.top') }}</Button>
      <Button variant="ghost" size="sm" @click="preset('front')">{{ t('viewer.front') }}</Button>
      <Button variant="ghost" size="sm" @click="preset('side')">{{ t('viewer.side') }}</Button>
      <Button variant="ghost" size="sm" @click="preset('iso')"><Box class="size-3" />{{ t('viewer.iso') }}</Button>
      <span class="mx-1 h-4 w-px bg-border" />
      <template v-if="app.params.lid.enabled && app.result.value?.lidMesh">
        <span class="mx-1 h-4 w-px bg-border" />
        <Button
          v-for="opt in previewOptions"
          :key="opt.id"
          :variant="app.previewPart.value === opt.id ? 'default' : 'ghost'"
          size="sm"
          @click="app.previewPart.value = opt.id"
        >{{ opt.label }}</Button>
      </template>
      <span class="mx-1 h-4 w-px bg-border" />
      <Button :variant="wireframe ? 'default' : 'ghost'" size="sm" @click="wireframe = !wireframe"><Grid3x3 class="size-3" />{{ t('viewer.wireframe') }}</Button>
      <Button variant="ghost" size="sm" @click="preset('iso')"><Home class="size-3" />{{ t('viewer.resetCamera') }}</Button>
    </div>

    <div v-if="app.status.value === 'generating'" class="absolute right-3 top-3 flex items-center gap-2 rounded-md border bg-card/90 px-2 py-1 text-xs">
      <Loader2 class="size-3.5 animate-spin text-primary" />{{ t('viewer.generating') }}
    </div>

    <div v-if="!app.parsed.value" class="absolute inset-0 grid place-items-center bg-background/70 p-6 text-center">
      <div class="max-w-sm space-y-3">
        <Upload class="mx-auto size-8 text-primary" />
        <h2 class="text-base font-semibold">{{ t('viewer.emptyTitle') }}</h2>
        <p class="text-xs text-muted-foreground">{{ t('viewer.emptyBody') }}</p>
        <div class="flex flex-wrap justify-center gap-2">
          <Button v-for="s in SAMPLES" :key="s.id" variant="secondary" size="sm" @click="app.loadSample(s.id)">{{ sampleName(s.id) }}</Button>
        </div>
      </div>
    </div>

    <div v-else-if="app.status.value === 'error' && !app.result.value?.mesh" class="absolute inset-0 grid place-items-center p-6 text-center">
      <div class="max-w-sm rounded-lg border border-destructive/50 bg-card/95 p-4 text-xs" role="alert">
        <p class="mb-1 font-semibold text-destructive">{{ t('viewer.errorTitle') }}</p>
        <p v-for="e in app.result.value?.errors ?? (app.loadError.value ? [app.loadError.value] : [])" :key="e.code">{{ e.message }}</p>
      </div>
    </div>
  </div>
</template>
