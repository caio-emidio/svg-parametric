<script setup lang="ts">
import { Download, RotateCcw, Play, Loader2 } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import Switch from '~/components/ui/Switch.vue'
import Label from '~/components/ui/Label.vue'
import NumberField from '~/components/NumberField.vue'
import SvgInput from '~/components/SvgInput.vue'
import LocaleSwitch from '~/components/LocaleSwitch.vue'
import { useTrayApp } from '~/composables/useTrayApp'
import { useI18n } from '~/composables/useI18n'

const app = useTrayApp()
const { t } = useI18n()
const p = app.params
const d = p.dividers
const lid = p.lid
</script>

<template>
  <aside class="flex h-full w-full flex-col overflow-y-auto border-r bg-card md:w-[330px] md:shrink-0">
    <header class="border-b px-4 py-3">
      <div class="flex items-start justify-between gap-2">
        <div class="min-w-0">
          <h1 class="text-sm font-semibold tracking-tight">
            {{ t('app.title') }} <span class="text-primary">{{ t('app.titleAccent') }}</span>
          </h1>
          <p class="text-[11px] text-muted-foreground">{{ t('app.tagline') }}</p>
        </div>
        <LocaleSwitch />
      </div>
    </header>

    <div class="space-y-5 p-4">
      <div>
        <h2 class="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.svgInput') }}</h2>
        <SvgInput />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.dimensions') }}</h2>
        <NumberField :label="t('field.width')" :model-value="p.width" :min="5" :max="2000" :slider-max="300" :step="0.5" @update:model-value="app.setWidth" />
        <NumberField :label="t('field.height')" :model-value="p.height" :min="5" :max="2000" :slider-max="300" :step="0.5" @update:model-value="app.setHeight" />
        <div class="flex items-center justify-between">
          <Label for="aspect">{{ t('field.preserveAspect') }}</Label>
          <Switch id="aspect" v-model="app.lockAspect.value" />
        </div>
        <NumberField v-model="p.scale" :label="t('field.scale')" unit="×" :min="0.1" :max="10" :slider-max="3" :step="0.05" />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.trayGeometry') }}</h2>
        <NumberField v-model="p.wallHeight" :label="t('field.wallHeight')" :min="0" :max="500" :slider-max="100" :step="0.5" />
        <NumberField v-model="p.wallThickness" :label="t('field.wallThickness')" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.bottomThickness" :label="t('field.bottomThickness')" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.taperAngle" :label="t('field.wallTaper')" unit="°" :min="-45" :max="45" :step="0.5" />
        <NumberField v-model="p.cornerRadius" :label="t('field.cornerRounding')" :min="0" :max="200" :slider-max="30" :step="0.5" />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.compartments') }}</h2>
        <div class="flex items-center justify-between">
          <Label for="dividers">{{ t('field.internalDividers') }}</Label>
          <Switch id="dividers" v-model="d.enabled" />
        </div>
        <template v-if="d.enabled">
          <NumberField v-model="d.rows" :label="t('field.rows')" :min="1" :max="20" :slider-max="6" :step="1" />
          <NumberField v-model="d.cols" :label="t('field.columns')" :min="1" :max="20" :slider-max="6" :step="1" />
          <NumberField v-model="d.thickness" :label="t('field.dividerThickness')" unit="mm" :min="0" :max="20" :slider-max="6" :step="0.1" />
        </template>
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.lid') }}</h2>
        <div class="flex items-center justify-between">
          <Label for="lid">{{ t('field.generateLid') }}</Label>
          <Switch id="lid" v-model="lid.enabled" />
        </div>
        <template v-if="lid.enabled">
          <NumberField v-model="lid.thickness" :label="t('field.lidThickness')" :min="0.2" :max="20" :slider-max="6" :step="0.1" />
          <NumberField v-model="lid.clearance" :label="t('field.clearance')" :min="0" :max="2" :slider-max="1" :step="0.05" />
          <NumberField v-model="lid.lipDepth" :label="t('field.lipDepth')" :min="0.5" :max="100" :slider-max="20" :step="0.5" />
          <NumberField v-model="lid.lipThickness" :label="t('field.lipThickness')" :min="0" :max="10" :slider-max="4" :step="0.1" />
        </template>
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.cut2d') }}</h2>
        <NumberField v-model="p.cutKerf" :label="t('field.kerf')" :min="0" :max="2" :slider-max="0.5" :step="0.01" unit="mm" />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.bambu') }}</h2>
        <NumberField v-model="p.exportLayerHeight" :label="t('field.layerHeightHint')" :min="0.08" :max="0.4" :slider-max="0.28" :step="0.02" unit="mm" />
        <NumberField v-model="p.exportElephantFoot" :label="t('field.elephantFootHint')" :min="0" :max="0.5" :slider-max="0.2" :step="0.01" unit="mm" />
        <p class="text-[10px] leading-snug text-muted-foreground">{{ t('bambu.hint') }}</p>
      </div>

      <div class="space-y-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.actions') }}</h2>
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" @click="app.resetParams"><RotateCcw class="size-3.5" />{{ t('action.reset') }}</Button>
          <Button variant="outline" :disabled="!app.selectedShapes.value.length" @click="app.regenerate">
            <Loader2 v-if="app.status.value === 'generating'" class="size-3.5 animate-spin" /><Play v-else class="size-3.5" />{{ t('action.regenerate') }}
          </Button>
        </div>
        <Button class="w-full" :disabled="!app.result.value?.ok || app.status.value === 'generating'" data-testid="export" @click="app.exportStl">
          <Download class="size-3.5" />{{ t('action.exportTrayStl') }}
        </Button>
        <Button
          v-if="lid.enabled"
          class="w-full"
          variant="outline"
          :disabled="!app.result.value?.lidValidation?.ok || app.status.value === 'generating'"
          @click="app.exportLidStl"
        >
          <Download class="size-3.5" />{{ t('action.exportLidStl') }}
        </Button>
        <Button
          class="w-full"
          variant="outline"
          :disabled="!app.result.value?.ok || app.status.value === 'generating'"
          data-testid="export-cut"
          @click="app.exportCutSvg"
        >
          <Download class="size-3.5" />{{ t('action.exportCutSvg') }}
        </Button>
        <Button
          v-if="lid.enabled"
          class="w-full"
          variant="outline"
          :disabled="!app.result.value?.lidValidation?.ok || app.status.value === 'generating'"
          data-testid="export-3mf"
          @click="app.exportBambu3mf"
        >
          <Download class="size-3.5" />{{ t('action.exportBambuZip') }}
        </Button>
      </div>
    </div>
  </aside>
</template>
