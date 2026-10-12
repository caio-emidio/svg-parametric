<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { FileUp, RefreshCw } from 'lucide-vue-next'
import { SAMPLES } from '~/engine'
import Button from '~/components/ui/Button.vue'
import Label from '~/components/ui/Label.vue'
import Slider from '~/components/ui/Slider.vue'
import Switch from '~/components/ui/Switch.vue'
import { useTrayApp } from '~/composables/useTrayApp'

const app = useTrayApp()
const input = ref<HTMLInputElement>()
const dragging = ref(false)
let retraceTimer: ReturnType<typeof setTimeout> | undefined

function pick() { input.value?.click() }
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (f) app.loadFile(f)
  ;(e.target as HTMLInputElement).value = ''
}
function onDrop(e: DragEvent) {
  dragging.value = false
  const f = e.dataTransfer?.files?.[0]
  if (f) app.loadFile(f)
}

const tracing = computed(() => app.traceStatus.value === 'tracing')

watch(
  () => ({ ...app.imageTraceParams }),
  () => {
    if (!app.fromImage.value || !app.lastImageFile.value) return
    clearTimeout(retraceTimer)
    retraceTimer = setTimeout(() => app.retraceImage(), 400)
  },
  { deep: true }
)

/** 2D preview path built from our own parsed contours (the uploaded markup is never inserted into the DOM). */
const preview = computed(() => {
  const p = app.parsed.value
  if (!p?.bounds) return null
  const { minX, minY, maxX, maxY } = p.bounds
  const pad = Math.max(maxX - minX, maxY - minY) * 0.04
  const sel = new Set(app.selectedIds.value)
  const d = (ids: (s: string) => boolean) => p.shapes.filter(s => ids(s.id)).map(s => s.contours.map(c => `M${c.map(q => `${q[0].toFixed(2)} ${q[1].toFixed(2)}`).join('L')}Z`).join('')).join('')
  return {
    viewBox: `${minX - pad} ${minY - pad} ${maxX - minX + 2 * pad} ${maxY - minY + 2 * pad}`,
    selected: d(id => sel.has(id)),
    other: d(id => !sel.has(id)),
  }
})

function toggle(id: string) {
  const i = app.selectedIds.value.indexOf(id)
  if (i >= 0) app.selectedIds.value = app.selectedIds.value.filter(x => x !== id)
  else app.selectedIds.value = [...app.selectedIds.value, id]
}
</script>

<template>
  <section class="space-y-3">
    <input
      ref="input"
      type="file"
      accept=".svg,image/svg+xml,.png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
      class="hidden"
      data-testid="file-input"
      @change="onFile"
    >
    <div
      v-if="!app.parsed.value && !tracing"
      class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors"
      :class="dragging ? 'border-primary bg-primary/10' : ''"
      @dragover.prevent="dragging = true"
      @dragleave="dragging = false"
      @drop.prevent="onDrop"
    >
      <FileUp class="size-6 text-muted-foreground" />
      <p class="text-xs text-muted-foreground">Drag &amp; drop an SVG or silhouette here</p>
      <p class="text-[10px] text-muted-foreground">PNG with transparency works best; JPEG uses corner background detection.</p>
      <Button size="sm" @click="pick">Browse files…</Button>
    </div>
    <div v-else-if="tracing" class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-6 text-center">
      <p class="text-xs text-muted-foreground">Tracing image to SVG…</p>
    </div>
    <template v-else>
      <div class="flex items-center justify-between gap-2">
        <span class="truncate font-mono text-xs" :title="app.svgName.value">{{ app.svgName.value }}</span>
        <div class="flex shrink-0 gap-1">
          <Button v-if="app.fromImage.value && app.generatedSvgText.value" variant="secondary" size="sm" @click="app.exportSvg">Export SVG</Button>
          <Button variant="outline" size="sm" @click="pick"><RefreshCw class="size-3" />Replace</Button>
        </div>
      </div>
      <div v-if="app.fromImage.value && app.sourceRasterUrl.value" class="grid grid-cols-2 gap-2">
        <div class="space-y-1">
          <p class="text-[10px] text-muted-foreground">Source image</p>
          <div class="aspect-square overflow-hidden rounded-md border bg-muted/40">
            <img :src="app.sourceRasterUrl.value" alt="" class="h-full w-full object-contain">
          </div>
        </div>
        <div class="space-y-1">
          <p class="text-[10px] text-muted-foreground">Traced silhouette</p>
          <div
            v-if="preview"
            class="aspect-square overflow-hidden rounded-md border bg-muted/40 p-1"
          >
            <svg :viewBox="preview.viewBox" class="h-full w-full" role="img" aria-label="Traced silhouette">
              <path :d="preview.other" fill="currentColor" fill-opacity="0.15" fill-rule="evenodd" class="text-foreground" />
              <path :d="preview.selected" fill="currentColor" fill-opacity="0.85" fill-rule="evenodd" class="text-primary" />
            </svg>
          </div>
        </div>
      </div>
      <div
        v-else-if="preview"
        class="aspect-[4/3] overflow-hidden rounded-md border bg-muted/40 p-1"
        @dragover.prevent
        @drop.prevent="onDrop"
      >
        <svg :viewBox="preview.viewBox" class="h-full w-full" role="img" aria-label="2D preview of the SVG silhouette">
          <path :d="preview.other" fill="currentColor" fill-opacity="0.15" fill-rule="evenodd" class="text-foreground" />
          <path :d="preview.selected" fill="currentColor" fill-opacity="0.85" fill-rule="evenodd" class="text-primary" />
        </svg>
      </div>
      <div v-if="app.fromImage.value" class="space-y-3 rounded-md border p-3">
        <p class="text-xs font-medium">Image tracing</p>
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs">Threshold</Label>
            <span class="font-mono text-[10px] text-muted-foreground">{{ app.imageTraceParams.threshold }}</span>
          </div>
          <Slider v-model="app.imageTraceParams.threshold" :min="8" :max="240" :step="1" aria-label="Threshold" />
        </div>
        <div class="space-y-1">
          <div class="flex items-center justify-between gap-2">
            <Label class="text-xs">Simplification</Label>
            <span class="font-mono text-[10px] text-muted-foreground">{{ Math.round(app.imageTraceParams.simplification * 100) }}%</span>
          </div>
          <Slider v-model="app.imageTraceParams.simplification" :min="0" :max="1" :step="0.05" aria-label="Simplification" />
        </div>
        <label class="flex cursor-pointer items-center justify-between gap-2 text-xs">
          <span>Use largest contour only</span>
          <Switch v-model="app.imageTraceParams.largestContourOnly" />
        </label>
        <Button variant="outline" size="sm" class="w-full" :disabled="tracing" @click="app.retraceImage">Retrace</Button>
      </div>
      <div v-if="app.parsed.value.shapes.length > 1" class="space-y-1">
        <p class="text-xs text-muted-foreground">Shapes to use ({{ app.selectedIds.value.length }}/{{ app.parsed.value.shapes.length }})</p>
        <div class="max-h-28 space-y-0.5 overflow-auto rounded-md border p-1">
          <label v-for="s in app.parsed.value.shapes" :key="s.id" class="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-muted">
            <input type="checkbox" :checked="app.selectedIds.value.includes(s.id)" class="accent-[var(--primary)]" @change="toggle(s.id)">
            <span class="truncate">{{ s.label }}</span>
            <span class="ml-auto text-[10px] text-muted-foreground">{{ s.contours.length }} contour{{ s.contours.length > 1 ? 's' : '' }}</span>
          </label>
        </div>
      </div>
    </template>
    <p v-if="app.loadError.value" class="rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive" role="alert">{{ app.loadError.value.message }}</p>
    <ul v-if="app.inputWarnings.value.length" class="space-y-1">
      <li v-for="w in app.inputWarnings.value" :key="w.code + w.message" class="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">{{ w.message }}</li>
    </ul>
    <div>
      <p class="mb-1 text-xs text-muted-foreground">Examples</p>
      <div class="flex flex-wrap gap-1">
        <Button v-for="s in SAMPLES" :key="s.id" variant="secondary" size="sm" @click="app.loadSample(s.id)">{{ s.name }}</Button>
      </div>
    </div>
  </section>
</template>
