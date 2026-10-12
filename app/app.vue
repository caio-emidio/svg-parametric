<script setup lang="ts">
import ParamsSidebar from '~/components/ParamsSidebar.vue'
import TrayViewer from '~/components/TrayViewer.vue'
import StatusBar from '~/components/StatusBar.vue'
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="flex min-h-0 flex-1 flex-col md:flex-row">
      <ParamsSidebar class="max-h-[45%] md:max-h-none" />
      <main class="relative min-h-0 flex-1">
        <TrayViewer />
      </main>
    </div>
    <StatusBar />
  </div>
</template>
