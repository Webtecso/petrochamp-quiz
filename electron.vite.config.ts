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
    // NOVO — base relativa ('./') em vez da absoluta por defeito ('/').
    // Sem isto, o index.html gerado referencia os ficheiros como
    // "/assets/..." — funciona quando o site vive na raiz do domínio, mas
    // parte (404) quando é servido de uma subpasta, como o Admin Cloud no
    // Hostinger (ex: petrochamp.com/admin_quiz/). Com caminhos relativos,
    // funciona em qualquer subpasta, e continua a funcionar normalmente no
    // Electron/backend local (que também serve a partir da raiz).
    base: './',
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue(), tailwindcss()],
    server: {
      headers: {
        'Content-Security-Policy': "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: blob: http: https: ws: wss:; frame-src 'self' http://localhost:4000 *; child-src 'self' http://localhost:4000 *;"
      }
    }
  }
})
