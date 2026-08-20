// src/renderer/src/services/configSync.ts
import { getSocket } from './socket'
import { useTeamsStore } from '../stores/teams'
import { usePhasesStore } from '../stores/phases'
import { useQuizContentStore } from '../stores/quizContent'
import { useSuspensePhrasesStore } from '../stores/suspensePhrases'
import { useCampeonatoStore } from '../stores/campeonato'

let started = false

export function startConfigSync(): void {
  if (started) return
  started = true

  const socket = getSocket()

  socket.on('config:updated', async (payload: { type: string; championship: string | null }) => {
    const { type, championship } = payload
    const store = useCampeonatoStore()
    const activeChampionship = championship ?? store.championship ?? undefined

    try {
      switch (type) {
        case 'teams': {
          await useTeamsStore().fetchTeams()
          break
        }
        case 'questions':
        case 'tiebreakQuestions': {
          await useQuizContentStore().fetchQuestions(activeChampionship)
          break
        }
        case 'evaluationItems': {
          const quizContent = useQuizContentStore()
          if (typeof quizContent.fetchEvaluationItems === 'function') {
            await quizContent.fetchEvaluationItems(activeChampionship)
          }
          break
        }
        case 'phases': {
          await usePhasesStore().fetchPhases(activeChampionship)
          break
        }
        case 'suspensePhrases': {
          await useSuspensePhrasesStore().fetchPhrases()
          break
        }
        case 'jurors':
        case 'partners':
        case 'presentation': {
          // Sem estado global cacheado na Projeção para estes — as views que
          // os usam (Admin/Moderador/Jurados) já fazem fetch próprio ao
          // montar. Nada a fazer aqui por agora.
          break
        }
        default:
          break
      }
    } catch (err) {
      console.error(`Falha ao sincronizar configuração (${type}):`, err)
    }
  })
}
