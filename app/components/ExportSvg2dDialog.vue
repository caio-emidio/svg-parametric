<script setup lang="ts">
import { PenLine, PaintBucket } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import type { Svg2dExportStyle } from '~/engine'
import { useI18n } from '~/composables/useI18n'

defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [], export: [style: Svg2dExportStyle] }>()
const { t } = useI18n()

function pick(style: Svg2dExportStyle) {
  emit('export', style)
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      :aria-label="t('exportSvg2d.title')"
      @click.self="emit('close')"
    >
      <div class="w-full max-w-sm rounded-lg border bg-card p-4 shadow-lg">
        <h2 class="text-sm font-semibold">{{ t('exportSvg2d.title') }}</h2>
        <p class="mt-1 text-[11px] leading-snug text-muted-foreground">{{ t('exportSvg2d.subtitle') }}</p>
        <div class="mt-4 space-y-2">
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted"
            @click="pick('stroke')"
          >
            <PenLine class="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span class="block text-xs font-medium">{{ t('exportSvg2d.strokeTitle') }}</span>
              <span class="mt-0.5 block text-[10px] text-muted-foreground">{{ t('exportSvg2d.strokeHint') }}</span>
            </span>
          </button>
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted"
            @click="pick('filled')"
          >
            <PaintBucket class="mt-0.5 size-4 shrink-0 text-primary" />
            <span>
              <span class="block text-xs font-medium">{{ t('exportSvg2d.filledTitle') }}</span>
              <span class="mt-0.5 block text-[10px] text-muted-foreground">{{ t('exportSvg2d.filledHint') }}</span>
            </span>
          </button>
        </div>
        <Button variant="ghost" class="mt-3 w-full" @click="emit('close')">{{ t('exportSvg2d.cancel') }}</Button>
      </div>
    </div>
  </Teleport>
</template>
