<script setup lang="ts">
import { SwitchRoot, SwitchThumb } from 'reka-ui'

const model = defineModel<boolean>({ default: false })
defineProps<{ id?: string }>()
</script>

<template>
  <SwitchRoot
    :id="id"
    v-model="model"
    class="inline-flex h-4 w-7 shrink-0 items-center rounded-full border border-transparent bg-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring data-[state=checked]:bg-primary"
  >
    <SwitchThumb class="block h-3 w-3 translate-x-0.5 rounded-full bg-foreground transition-transform data-[state=checked]:translate-x-3.5" />
  </SwitchRoot>
</template>
