import './assets/main.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createI18n } from 'vue-i18n'
import { translationsEn, keyToLabel } from 'pptx-vue-viewer/i18n'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import router from './router'
import { initApp } from './services/appInit'
import { loadSavedBackendHost } from './services/serverConfig'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  fallbackLocale: 'en',
  messages: { en: translationsEn },
  missing: (_locale, key) => keyToLabel(key),
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(i18n)
app.mount('#app')

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
