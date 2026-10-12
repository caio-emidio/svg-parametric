import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  // All geometry processing happens client-side (WASM in a Web Worker); no server rendering needed.
  ssr: false,
  css: ['~/assets/css/main.css'],
  vite: {
    plugins: [tailwindcss()],
    worker: { format: 'es' },
    optimizeDeps: {
      include: ['esm-potrace-wasm']
    }
  },
  app: {
    head: {
      title: 'SVG → 3D Tray Generator',
      meta: [{ name: 'description', content: 'Convert any SVG silhouette into a hollow, printable 3D tray and export a watertight STL.' }]
    }
  }
})
