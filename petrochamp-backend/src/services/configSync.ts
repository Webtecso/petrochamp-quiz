import { getSocket } from './socket'
import { useTeamsStore } from '../stores/teams'
import { useQuizContentStore } from '../stores/quizContent'
import { useTiebreakQuestionsStore } from '../stores/tiebreakQuestions'
import { usePhasesStore } from '../stores/phases'
import { useCampeonatoStore } from '../stores/campeonato'

interface ConfigUpdatedPayload {
  type: string
  championship: string | null
}

let listening = false

export function startConfigSync(): void {
  if (listening) return
  listening = true

  getSocket().on('config:updated', async (payload: ConfigUpdatedPayload) => {
    const campeonatoStore = useCampeonatoStore()
    const championship = payload.championship ?? campeonatoStore.championship ?? undefined

    switch (payload.type) {
      case 'teams':
        await useTeamsStore().fetchTeams()
        break
      case 'questions':
        await useQuizContentStore().fetchQuestions(championship)
        break
      case 'evaluationItems':
        await useQuizContentStore().fetchEvaluationItems(championship)
        break
      case 'tiebreakQuestions':
        await useTiebreakQuestionsStore().fetchQuestions(championship)
        break
      case 'phases':
        await usePhasesStore().fetchPhases(championship)
        break
      // jurors, partners, suspensePhrases, presentation: os ecrãs que usam
      // esses dados hoje buscam-nos diretamente via fetch() local (não têm
      // store dedicado com action de refetch) — nada a fazer aqui por agora.
    }
  })
}
