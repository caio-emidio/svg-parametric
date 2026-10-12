<script setup lang="ts">
import { Languages } from 'lucide-vue-next'
import Button from '~/components/ui/Button.vue'
import type { Locale } from '~/i18n/messages'
import { useI18n } from '~/composables/useI18n'

const { locale, locales, setLocale, t } = useI18n()
</script>

<template>
  <div class="flex items-center gap-0.5 rounded-md border bg-muted/40 p-0.5" role="group" :aria-label="t('locale.switch')">
    <Languages class="ml-1 size-3.5 text-muted-foreground" aria-hidden="true" />
    <Button
      v-for="opt in locales"
      :key="opt.id"
      type="button"
      size="sm"
      :variant="locale === opt.id ? 'default' : 'ghost'"
      class="h-6 min-w-8 px-2 text-[10px] font-semibold"
      @click="setLocale(opt.id as Locale)"
    >
      {{ opt.label }}
    </Button>
  </div>
</template>
