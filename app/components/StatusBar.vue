<script setup lang="ts">
import { computed } from 'vue'
import { useTrayApp } from '~/composables/useTrayApp'

const app = useTrayApp()
const bbox = computed(() => app.result.value?.bbox)
const v = computed(() => app.result.value?.validation)
const f = (n: number) => n.toFixed(1)
const statusText = computed(() => ({ idle: 'Idle', generating: 'Generating…', ready: 'Model ready', error: 'Invalid geometry' })[app.status.value])
const statusColor = computed(() => ({ idle: 'bg-muted-foreground', generating: 'bg-warning animate-pulse', ready: 'bg-success', error: 'bg-destructive' })[app.status.value])
</script>

<template>
  <footer class="border-t bg-card text-[11px]">
    <div v-if="app.result.value?.errors.length || app.result.value?.warnings.length" class="max-h-24 space-y-0.5 overflow-auto border-b px-3 py-1.5">
      <p v-for="e in app.result.value?.errors" :key="e.code" class="text-destructive" role="alert">✖ {{ e.message }}</p>
      <p v-for="w in app.result.value?.warnings" :key="w.code" class="text-warning">⚠ {{ w.message }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 font-mono">
      <span class="flex items-center gap-1.5"><i class="inline-block size-2 rounded-full" :class="statusColor" />{{ statusText }}</span>
      <span title="Requested outer size">Size {{ f(app.params.width * app.params.scale) }} × {{ f(app.params.height * app.params.scale) }} mm</span>
      <span>Wall {{ f(app.params.wallHeight) }} h / {{ f(app.params.wallThickness) }} t mm</span>
      <span v-if="bbox">BBox {{ f(bbox.size[0]) }} × {{ f(bbox.size[1]) }} × {{ f(bbox.size[2]) }} mm</span>
      <span v-if="v" :class="v.ok ? 'text-success' : 'text-destructive'">
        Mesh {{ v.ok ? 'watertight ✓' : 'INVALID' }} · {{ v.triangles }} tris · {{ (v.volume / 1000).toFixed(2) }} cm³<template v-if="v.components > 1"> · {{ v.components }} parts</template>
      </span>
      <span class="ml-auto" :class="app.exportStatus.value === 'error' ? 'text-destructive' : 'text-muted-foreground'">
        Export: {{ app.exportMessage.value || app.exportStatus.value }}
      </span>
    </div>
  </footer>
</template>
