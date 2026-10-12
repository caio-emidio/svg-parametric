<script setup lang="ts">
import { SliderRange, SliderRoot, SliderThumb, SliderTrack } from 'reka-ui'

const model = defineModel<number>({ required: true })
defineProps<{ min: number, max: number, step?: number, ariaLabel?: string }>()
</script>

<template>
  <SliderRoot
    :model-value="[model]"
    :min="min"
    :max="max"
    :step="step ?? 1"
    class="relative flex h-5 w-full touch-none select-none items-center"
    @update:model-value="v => v && v[0] !== undefined && (model = v[0])"
  >
    <SliderTrack class="relative h-1 grow overflow-hidden rounded-full bg-muted">
      <SliderRange class="absolute h-full bg-primary" />
    </SliderTrack>
    <SliderThumb :aria-label="ariaLabel" class="block h-3.5 w-3.5 rounded-full border-2 border-primary bg-background shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
  </SliderRoot>
</template>
