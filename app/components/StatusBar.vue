<script setup lang="ts">
import { computed } from 'vue'
import { useTrayApp } from '~/composables/useTrayApp'
import { useI18n } from '~/composables/useI18n'

const app = useTrayApp()
const { t } = useI18n()
const bbox = computed(() => app.result.value?.bbox)
const v = computed(() => app.result.value?.validation)
const f = (n: number) => n.toFixed(1)
const statusText = computed(() => t(`status.${app.status.value}`))
const statusColor = computed(() => ({ idle: 'bg-muted-foreground', generating: 'bg-warning animate-pulse', ready: 'bg-success', error: 'bg-destructive' })[app.status.value])
const exportLine = computed(() => {
  if (app.exportMessage.value) return app.exportMessage.value
  return t(`export.status.${app.exportStatus.value}`)
})
</script>

<template>
  <footer class="border-t bg-card text-[11px]">
    <div v-if="app.result.value?.errors.length || app.result.value?.warnings.length" class="max-h-24 space-y-0.5 overflow-auto border-b px-3 py-1.5">
      <p v-for="e in app.result.value?.errors" :key="e.code" class="text-destructive" role="alert">✖ {{ e.message }}</p>
      <p v-for="w in app.result.value?.warnings" :key="w.code" class="text-warning">⚠ {{ w.message }}</p>
    </div>
    <div class="flex flex-wrap items-center gap-x-5 gap-y-1 px-3 py-1.5 font-mono">
      <span class="flex items-center gap-1.5"><i class="inline-block size-2 rounded-full" :class="statusColor" />{{ statusText }}</span>
      <span :title="t('status.size')">{{ t('status.size') }} {{ f(app.params.width * app.params.scale) }} × {{ f(app.params.height * app.params.scale) }} mm</span>
      <span>{{ t('status.wall') }} {{ f(app.params.wallHeight) }} {{ t('status.heightAbbr') }} / {{ f(app.params.wallThickness) }} {{ t('status.thicknessAbbr') }} mm</span>
      <span v-if="bbox">{{ t('status.bbox') }} {{ f(bbox.size[0]) }} × {{ f(bbox.size[1]) }} × {{ f(bbox.size[2]) }} mm</span>
      <span v-if="v" :class="v.ok ? 'text-success' : 'text-destructive'">
        Mesh {{ v.ok ? t('status.meshOk') : t('status.meshInvalid') }} · {{ v.triangles }} {{ t('status.tris') }} · {{ (v.volume / 1000).toFixed(2) }} cm³<template v-if="v.components > 1"> · {{ v.components }} {{ t('status.parts') }}</template>
      </span>
      <span class="ml-auto" :class="app.exportStatus.value === 'error' ? 'text-destructive' : 'text-muted-foreground'">
        {{ t('status.export') }}: {{ exportLine }}
      </span>
    </div>
  </footer>
</template>
