import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import router from './router'
import { initApp } from './services/appInit'
import { loadSavedBackendHost } from './services/serverConfig'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Build isolada do Admin Cloud (servida estaticamente fora do Electron,
// ex: Hostinger), identificada pela mesma variável de ambiente que já
// usamos em backendConfig.ts. Esta build só mostra o Admin - nunca o
// Moderador/Projeção - por isso não precisa de nenhuma ligação Socket.io
// (isso é só do campeonato em tempo real, que vive no backend Local/LAN).
// Sem esta verificação, o main.ts tentava sempre abrir uma ligação
// Socket.io ao backend Cloud (que nem tem Socket.io), gerando centenas de
// tentativas falhadas em loop.
const isAdminCloudBuild = !!(import.meta.env.VITE_CLOUD_API_URL as string | undefined)

if (isAdminCloudBuild) {
  // Build só-Admin: nada de socket, nada de stores em tempo real - o
  // router já força a ir para /admin/login sozinho (isLocalAccess=false).
} else if (!Capacitor.isNativePlatform()) {
  initApp()
} else {
  loadSavedBackendHost().then((host) => {
    if (host) {
      initApp()
    }
    // Se não houver host guardado, o router já trata disto - o
    // defaultPath nativo é '/servidor', por isso a app cai lá sozinha.
  })
}
