import router from '../router'
import { connectSocket, getSocket } from './socket'
import { useCampeonatoStore } from '../stores/campeonato'
import { useTeamsStore } from '../stores/teams'
import { useQuizContentStore } from '../stores/quizContent'
import { useSettingsStore } from '../stores/settings'
import { usePhasesStore } from '../stores/phases'
import { useJuradosStore } from '../stores/jurados'

let initialized = false

// Liga o socket (se ainda não estiver ligado ao host certo), regista os
// listeners de tempo real e carrega os dados iniciais das stores. Chamada
// tanto no arranque normal da app (main.ts, quando já há um host guardado)
// como logo após o utilizador configurar o host pela primeira vez
// (ServerConfigView.vue) — sem isto, a primeira ligação a um PC ficava
// com o socket aberto mas nenhuma store reativa a ouvir nada.
export function initApp(forceReconnect = false): void {
  connectSocket(forceReconnect)

  const campeonatoStore = useCampeonatoStore()
  campeonatoStore.listenToServer()
  useJuradosStore().listenToServer()
  useTeamsStore().fetchTeams()
  useQuizContentStore().fetchQuestions()
  useQuizContentStore().fetchEvaluationItems()
  useSettingsStore().fetchSettings()
  usePhasesStore().fetchPhases()

  if (initialized) return
  initialized = true

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
