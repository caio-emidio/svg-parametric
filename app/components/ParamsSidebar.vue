<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Download, RotateCcw, Play, Loader2, Save, FolderOpen, Link2, Plus, Trash2 } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import Switch from '~/components/ui/Switch.vue'
import Label from '~/components/ui/Label.vue'
import NumberField from '~/components/NumberField.vue'
import SvgInput from '~/components/SvgInput.vue'
import LocaleSwitch from '~/components/LocaleSwitch.vue'
import ExportSvg2dDialog from '~/components/ExportSvg2dDialog.vue'
import { useTrayApp } from '~/composables/useTrayApp'
import { useI18n } from '~/composables/useI18n'
import { effectiveDividerLayout, regionLabel, ROOT_REGION_ID, splittableRegions, type PieceMode } from '~/engine'

const app = useTrayApp()
const { t, locale } = useI18n()
const p = app.params
const d = p.dividers
const lid = p.lid
const exportSvg2dOpen = ref(false)
const projectInput = ref<HTMLInputElement | null>(null)
const dividerLayout = computed(() => effectiveDividerLayout(d))
const newSplitRegionId = ref(ROOT_REGION_ID)
const newSplitOptions = computed(() => splittableRegions(p.dividers.customLines))

watch(newSplitOptions, (opts) => {
  if (!opts.some(o => o.id === newSplitRegionId.value)) {
    newSplitRegionId.value = opts[0]?.id ?? ROOT_REGION_ID
  }
}, { immediate: true })

function splitRegionOptions(index: number) {
  return app.customSplitRegionOptions(index)
}

watch(() => p.dividers.enabled, (on) => {
  if (!on) return
  app.normalizeDividers()
})

const pieceModes: PieceMode[] = ['tray', 'coaster', 'cookieCutter', 'stamp', 'closedBox']

function pieceLabel(mode: PieceMode) {
  const labels: Record<PieceMode, { en: string, 'pt-BR': string }> = {
    tray: { en: 'Organizer tray', 'pt-BR': 'Bandeja organizadora' },
    coaster: { en: 'Coaster / base', 'pt-BR': 'Descanso / base' },
    cookieCutter: { en: 'Cookie cutter', 'pt-BR': 'Cortador de biscoito' },
    stamp: { en: 'Relief stamp', 'pt-BR': 'Carimbo em relevo' },
    closedBox: { en: 'Box + lid', 'pt-BR': 'Caixa + tampa' }
  }
  return labels[mode][locale.value]
}

function onProjectPick(ev: Event) {
  const file = (ev.target as HTMLInputElement).files?.[0]
  if (file) app.loadProjectFile(file)
  ;(ev.target as HTMLInputElement).value = ''
}
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
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.pieceMode') }}</h2>
        <label class="block text-[11px] text-muted-foreground" for="piece-mode">{{ t('field.pieceMode') }}</label>
        <select
          id="piece-mode"
          class="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          :value="p.pieceMode"
          @change="app.setPieceMode(($event.target as HTMLSelectElement).value as PieceMode)"
        >
          <option v-for="mode in pieceModes" :key="mode" :value="mode">{{ pieceLabel(mode) }}</option>
        </select>
      </div>

      <div class="space-y-2">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.project') }}</h2>
        <input ref="projectInput" type="file" accept=".json,application/json" class="hidden" @change="onProjectPick">
        <div class="grid grid-cols-2 gap-2">
          <Button variant="outline" :disabled="!app.generatedSvgText.value" @click="app.saveProjectFile">
            <Save class="size-3.5" />{{ t('action.saveProject') }}
          </Button>
          <Button variant="outline" @click="projectInput?.click()">
            <FolderOpen class="size-3.5" />{{ t('action.openProject') }}
          </Button>
        </div>
        <Button class="w-full" variant="outline" :disabled="!app.generatedSvgText.value" @click="app.copyShareLink">
          <Link2 class="size-3.5" />{{ t('action.copyShareLink') }}
        </Button>
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
        <NumberField v-if="p.pieceMode === 'stamp'" v-model="p.stampDepth" :label="t('field.stampDepth')" :min="0.5" :max="50" :slider-max="15" :step="0.5" />
        <NumberField v-model="p.wallHeight" :label="t('field.wallHeight')" :min="0" :max="500" :slider-max="100" :step="0.5" />
        <div v-if="p.pieceMode === 'cookieCutter'" class="flex items-center justify-between">
          <Label for="cutter-base">{{ t('field.cookieCutterBase') }}</Label>
          <Switch id="cutter-base" v-model="p.cookieCutterBase" />
        </div>
        <NumberField v-model="p.wallThickness" :label="t('field.wallThickness')" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.bottomThickness" :label="t('field.bottomThickness')" :min="0.2" :max="50" :slider-max="10" :step="0.1" />
        <NumberField v-model="p.taperAngle" :label="t('field.wallTaper')" unit="°" :min="-45" :max="45" :step="0.5" />
        <NumberField v-model="p.cornerRadius" :label="t('field.cornerRounding')" :min="0" :max="200" :slider-max="30" :step="0.5" />
      </div>

      <div class="space-y-3">
        <h2 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{{ t('section.compartments') }}</h2>
        <div class="flex items-center justify-between">
          <Label for="dividers">{{ t('field.internalDividers') }}</Label>
          <Switch id="dividers" v-model="p.dividers.enabled" />
        </div>
        <p v-if="p.pieceMode === 'stamp' || p.pieceMode === 'cookieCutter' || p.pieceMode === 'coaster'" class="text-[10px] leading-snug text-muted-foreground">
          {{ t('field.dividersNeedTray') }}
        </p>
        <template v-if="d.enabled">
          <div class="flex gap-2">
            <Button
              type="button"
              size="sm"
              :variant="dividerLayout === 'grid' ? 'default' : 'outline'"
              class="flex-1 text-xs"
              @click="d.layout = 'grid'"
            >
              {{ t('field.dividerGrid') }}
            </Button>
            <Button
              type="button"
              size="sm"
              :variant="dividerLayout === 'custom' ? 'default' : 'outline'"
              class="flex-1 text-xs"
              @click="d.layout = 'custom'; if (!(d.customLines?.length)) app.addCustomDivider('horizontal')"
            >
              {{ t('field.dividerCustom') }}
            </Button>
          </div>
          <template v-if="dividerLayout === 'grid'">
            <NumberField v-model="d.rows" :label="t('field.rows')" :min="1" :max="20" :slider-max="6" :step="1" />
            <NumberField v-model="d.cols" :label="t('field.columns')" :min="1" :max="20" :slider-max="6" :step="1" />
          </template>
          <template v-else>
            <div class="space-y-2">
              <label class="block text-[10px] text-muted-foreground" for="new-split-region">{{ t('field.dividerTarget') }}</label>
              <select
                id="new-split-region"
                v-model="newSplitRegionId"
                class="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
              >
                <option v-for="(r, ri) in newSplitOptions" :key="r.id" :value="r.id">{{ regionLabel(r, ri) }}</option>
              </select>
              <div class="flex gap-2">
                <Button type="button" variant="outline" size="sm" class="flex-1 text-xs" @click="app.addCustomDivider('horizontal', newSplitRegionId)">
                  <Plus class="size-3" />{{ t('action.addHorizontalDivider') }}
                </Button>
                <Button type="button" variant="outline" size="sm" class="flex-1 text-xs" @click="app.addCustomDivider('vertical', newSplitRegionId)">
                  <Plus class="size-3" />{{ t('action.addVerticalDivider') }}
                </Button>
              </div>
              <div v-for="(line, i) in d.customLines" :key="line.id ?? i" class="space-y-2 rounded border p-2">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[10px] font-medium text-muted-foreground">
                    {{ line.orientation === 'horizontal' ? t('field.horizontalDivider') : t('field.verticalDivider') }}
                  </p>
                  <Button type="button" variant="ghost" size="icon" class="shrink-0" @click="app.removeCustomDivider(i)">
                    <Trash2 class="size-3.5" />
                  </Button>
                </div>
                <label class="block text-[10px] text-muted-foreground">{{ t('field.dividerTarget') }}</label>
                <select
                  v-model="line.regionId"
                  class="w-full rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option v-for="(r, ri) in splitRegionOptions(i)" :key="r.id" :value="r.id">{{ regionLabel(r, ri) }}</option>
                </select>
                <NumberField v-model="line.t" :label="t('field.dividerPosition')" :min="0.05" :max="0.95" :slider-max="1" :step="0.01" unit="0–1" />
              </div>
            </div>
          </template>
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
        <p class="text-[10px] leading-snug text-muted-foreground">{{ t('bambu.hintTrayOnly') }}</p>
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
          @click="exportSvg2dOpen = true"
        >
          <Download class="size-3.5" />{{ t('action.exportSvg2d') }}
        </Button>
        <ExportSvg2dDialog
          :open="exportSvg2dOpen"
          @close="exportSvg2dOpen = false"
          @export="app.exportCutSvg"
        />
        <Button
          class="w-full"
          variant="outline"
          :disabled="!app.result.value?.ok || app.status.value === 'generating'"
          data-testid="export-3mf"
          @click="app.exportTray3mf"
        >
          <Download class="size-3.5" />{{ t('action.export3mf') }}
        </Button>
        <Button
          class="w-full"
          variant="outline"
          :disabled="!app.result.value?.ok || app.status.value === 'generating'"
          data-testid="export-bambu-zip"
          @click="app.exportBambu3mf"
        >
          <Download class="size-3.5" />{{ t('action.exportBambuZip') }}
        </Button>
      </div>
    </div>
  </aside>
</template>
