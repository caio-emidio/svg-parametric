<script setup lang="ts">
import { computed, ref } from 'vue'
import { FileUp, RefreshCw } from 'lucide-vue-next'
import { SAMPLES } from '~/engine'
import Button from '~/components/ui/Button.vue'
import { useTrayApp } from '~/composables/useTrayApp'

const app = useTrayApp()
const input = ref<HTMLInputElement>()
const dragging = ref(false)

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
    rules: new Map(p.shapes.map(s => [s.id, s.fillRule]))
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
    <input ref="input" type="file" accept=".svg,image/svg+xml" class="hidden" data-testid="file-input" @change="onFile">
    <div
      v-if="!app.parsed.value"
      class="flex flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center transition-colors"
      :class="dragging ? 'border-primary bg-primary/10' : ''"
      @dragover.prevent="dragging = true" @dragleave="dragging = false" @drop.prevent="onDrop"
    >
      <FileUp class="size-6 text-muted-foreground" />
      <p class="text-xs text-muted-foreground">Drag &amp; drop an SVG here</p>
      <Button size="sm" @click="pick">Browse files…</Button>
    </div>
    <template v-else>
      <div class="flex items-center justify-between gap-2">
        <span class="truncate font-mono text-xs" :title="app.svgName.value">{{ app.svgName.value }}</span>
        <Button variant="outline" size="sm" @click="pick"><RefreshCw class="size-3" />Replace</Button>
      </div>
      <div
        v-if="preview" class="aspect-[4/3] overflow-hidden rounded-md border bg-muted/40 p-1"
        @dragover.prevent @drop.prevent="onDrop"
      >
        <svg :viewBox="preview.viewBox" class="h-full w-full" role="img" aria-label="2D preview of the SVG silhouette">
          <path :d="preview.other" fill="currentColor" fill-opacity="0.15" fill-rule="evenodd" class="text-foreground" />
          <path :d="preview.selected" fill="currentColor" fill-opacity="0.85" fill-rule="evenodd" class="text-primary" />
        </svg>
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
    <ul v-if="app.parsed.value?.warnings.length" class="space-y-1">
      <li v-for="w in app.parsed.value.warnings" :key="w.code" class="rounded-md border border-warning/40 bg-warning/10 p-2 text-[11px] text-warning">{{ w.message }}</li>
    </ul>
    <div>
      <p class="mb-1 text-xs text-muted-foreground">Examples</p>
      <div class="flex flex-wrap gap-1">
        <Button v-for="s in SAMPLES" :key="s.id" variant="secondary" size="sm" @click="app.loadSample(s.id)">{{ s.name }}</Button>
      </div>
    </div>
  </section>
</template>
