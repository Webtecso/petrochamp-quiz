import './assets/main.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { Capacitor } from '@capacitor/core'
import App from './App.vue'
import router from './router'
import { connectSocket, getSocket } from './services/socket'
import { useCampeonatoStore } from './stores/campeonato'
import { useTeamsStore } from './stores/teams'
import { useQuizContentStore } from './stores/quizContent'
import { useSettingsStore } from './stores/settings'
import { usePhasesStore } from './stores/phases'
import { useJuradosStore } from './stores/jurados'
import { loadSavedBackendHost } from './services/serverConfig'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

// Função auxiliar para inicializar stores e socket
const initApp = () => {
  connectSocket()

  const campeonatoStore = useCampeonatoStore()
  campeonatoStore.listenToServer()
  useJuradosStore().listenToServer()
  useTeamsStore().fetchTeams()
  useQuizContentStore().fetchQuestions()
  useQuizContentStore().fetchEvaluationItems()
  useSettingsStore().fetchSettings()
  usePhasesStore().fetchPhases()

  getSocket().once(
    'state:sync',
    (state: { teamA?: unknown; teamB?: unknown; presentationFlow?: { stage?: string } }) => {
      const currentPath = router.currentRoute.value.path
      const isModeratorWindow = !currentPath.startsWith('/projecao') && !currentPath.startsWith('/jogador')
      if (!isModeratorWindow) return

      if (state.presentationFlow && state.presentationFlow.stage && state.presentationFlow.stage !== 'idle') {
        router.push('/moderador/apresentacao')
        return
      }
      if (state.teamA && state.teamB) {
        router.push('/moderador/jogo')
      }
    }
  )
}

if (!Capacitor.isNativePlatform()) {
  initApp()
} else {
  loadSavedBackendHost().then((host) => {
    if (host) {
      initApp()
    }
    // Se não houver host guardado, o router já trata disto — o
    // defaultPath nativo é '/servidor', por isso a app cai lá sozinha.
  })
}
