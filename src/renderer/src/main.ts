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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')

if (!Capacitor.isNativePlatform()) {
  connectSocket()

  const campeonatoStore = useCampeonatoStore()
  campeonatoStore.listenToServer()
  useJuradosStore().listenToServer()
  useTeamsStore().fetchTeams()
  useQuizContentStore().fetchQuestions()
  useQuizContentStore().fetchEvaluationItems()
  useSettingsStore().fetchSettings()
  usePhasesStore().fetchPhases()

  // CORRIGIDO: passa a verificar também se há uma Apresentação em curso —
  // antes só olhava para teamA/teamB (Quiz), por isso uma sessão de
  // Apresentação nunca era retomada, e pior: se sobrasse uma sessão de
  // Quiz antiga persistida, o app forçava sempre a volta para lá, mesmo
  // estando a testar Apresentação de propósito.
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
