<script setup lang="ts">
import { cn } from '~/lib/utils'

const model = defineModel<string | number>()
const props = defineProps<{ class?: string }>()
</script>

<template>
  <input
    v-model="model"
    :class="cn('h-7 w-full rounded-md border bg-input px-2 font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50', props.class)"
  >
</template>
