<script setup lang="ts">
import { computed } from 'vue'
import Slider from '~/components/ui/Slider.vue'
import Label from '~/components/ui/Label.vue'

const props = defineProps<{ label: string, modelValue: number, min: number, max: number, step?: number, unit?: string, sliderMax?: number }>()
const emit = defineEmits<{ 'update:modelValue': [number] }>()
const id = `f-${props.label.replace(/\W+/g, '-').toLowerCase()}`
const slider = computed({
  get: () => Math.min(props.modelValue, props.sliderMax ?? props.max),
  set: (v: number) => emit('update:modelValue', v)
})
function onInput(e: Event) {
  const v = parseFloat((e.target as HTMLInputElement).value)
  if (Number.isFinite(v)) emit('update:modelValue', v)
}
</script>

<template>
  <div class="grid grid-cols-[1fr_104px] items-center gap-x-3 gap-y-0.5">
    <Label :for="id">{{ label }}</Label>
    <div class="relative">
      <input
        :id="id" type="number" :value="modelValue" :min="min" :max="max" :step="step ?? 1"
        class="h-7 w-full rounded-md border bg-input pl-2 pr-8 text-right font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring"
        @input="onInput"
      >
      <span class="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">{{ unit ?? 'mm' }}</span>
    </div>
    <Slider v-model="slider" :min="min" :max="sliderMax ?? max" :step="step" :aria-label="label" class="col-span-2" />
  </div>
</template>
