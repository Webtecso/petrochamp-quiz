import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    optimizeDeps: {
      include: ['jszip', 'fast-xml-parser', 'vue-i18n', 'pptx-vue-viewer'],
      needsInterop: ['jszip'],
    },
    base: './',
    resolve: {
      alias: [
        { find: 'jszip', replacement: 'jszip/lib/index.js' },
        { find: '@renderer', replacement: resolve('src/renderer/src') },
        { find: /pptx-vue-viewer\.css$/, replacement: resolve('src/renderer/empty.css') }
      ]
    },
    plugins: [vue(), tailwindcss()],
    server: {
      headers: {
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https: ws: wss:; frame-src 'self' http://localhost:4000 *; child-src 'self' http://localhost:4000 *;"
      }
    }
  }
})