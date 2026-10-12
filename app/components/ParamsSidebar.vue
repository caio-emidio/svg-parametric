<script setup lang="ts">
import { Download, RotateCcw, Play, Loader2 } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import Switch from '~/components/ui/Switch.vue'
import Label from '~/components/ui/Label.vue'
import NumberField from '~/components/NumberField.vue'
import SvgInput from '~/components/SvgInput.vue'
import { useTrayApp } from '~/composables/useTrayApp'

const app = useTrayApp()
const p = app.params
</script>

<template>
  <aside class="flex h-full w-full flex-col overflow-y-auto border-r bg-card md:w-[330px] md:shrink-0">
    <header class="border-b px-4 py-3">
      <h1 class="text-sm font-semibold tracking-tight">SVG → Tray <span class="text-primary">3D</span></h1>
      <p class="text-[11px] text-muted-foreground">Parametric hollow tray generator · all units in mm</p>
    </header>

    <div class="space-y-5 p-4">
      <div>
        <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">SVG Input</h2>
        <SvgInput />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Dimensions</h2>
        <NumberField label="Width" :model-value="p.width" :min="5" :max="2000" :slider-max="300" :step="0.5" @update:model-value="app.setWidth" />
        <NumberField label="Height" :model-value="p.height" :min="5" :max="2000" :slider-max="300" :step="0.5" @update:model-value="app.setHeight" />
        <div class="flex items-center justify-between">
          <Label for="aspect">Preserve aspect ratio</Label>
          <Switch id="aspect" v-model="app.lockAspect.value" />
        </div>
        <NumberField v-model="p.scale" label="Scale" unit="×" :min="0.1" :max="10" :slider-max="3" :step="0.05" />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Tray Geometry</h2>
        <NumberField v-model="p.wallHeight" label="Wall height" :min="1" :max="500" :slider-max="100" :step="0.5" />
        <NumberField v-model="p.wallThickness" label="Wall thickness" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.bottomThickness" label="Bottom thickness" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.taperAngle" label="Wall taper" unit="°" :min="-45" :max="45" :step="0.5" />
        <NumberField v-model="p.cornerRadius" label="Corner rounding" :min="0" :max="200" :slider-max="30" :step="0.5" />
      </div>

      <div class="space-y-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Actions</h2>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="app.resetParams"><RotateCcw class="size-3.5" />Reset</Button>
          <Button variant="outline" :disabled="!app.selectedShapes.value.length" @click="app.regenerate">
            <Loader2 v-if="app.status.value === 'generating'" class="size-3.5 animate-spin" /><Play v-else class="size-3.5" />Regenerate
          </Button>
        </div>
        <Button class="w-full" :disabled="!app.result.value?.ok || app.status.value === 'generating'" data-testid="export" @click="app.exportStl">
          <Download class="size-3.5" />Export STL
        </Button>
      </div>
    </div>
  </aside>
</template>
