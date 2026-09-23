import { defineStore } from 'pinia'
import { api } from '../services/api'
import { adminFetch } from '../services/adminAuth'

export interface Phase {
  id: string
  championship: string
  order: number
  label: string
  type: 'quiz' | 'apresentacao' | 'apresentacao_quiz'
  useQuestions: boolean
  useJudges: boolean
  maxQuestions?: number | null
  questionsPerTeam?: number | null
  avoidRepeatQuestions?: boolean
  useInitialScores: boolean
  initialScoreMaxPoints?: number | null
  presentationMinutes?: number | null
  presentationWeight?: number | null
  quizWeight?: number | null
  // Fase de Apresentação sem eliminação: todas as equipas avançam, e a
  // nota fica guardada para ser somada (com presentationWeight/quizWeight)
  // à nota do Quiz da fase seguinte.
  noElimination?: boolean
  // NOVO - 'automatic' (padrao, sorteio aleatorio) ou 'per_team' (usa a
  // lista atribuida em QuestionAssignment, por ordem, por equipa).
  questionSelectionMode?: 'automatic' | 'per_team'
}

const DEFAULT_LABELS: Record<number, string> = {
  1: 'Perfuração',
  2: 'Extração',
  3: 'Refinação'
}

export const usePhasesStore = defineStore('phases', {
  state: () => ({
    phases: [] as Phase[]
  }),
  getters: {
    totalPhases: (state) => (state.phases.length > 0 ? state.phases.length : 3),
    labelFor: (state) => {
      return (order: number | string): string => {
        const found = state.phases.find((p) => Number(p.order) === Number(order))
        if (found) return found.label
        return DEFAULT_LABELS[Number(order)] ?? `Fase ${order}`
      }
    },
    configFor: (state) => {
      return (order: number | string) => {
        const found = state.phases.find((p) => Number(p.order) === Number(order))
        if (found) {
          const type = found.type ?? 'quiz'
          return {
            type,
            useQuestions: type === 'apresentacao' ? false : Boolean(found.useQuestions),
            useJudges: Boolean(found.useJudges),
            maxQuestions: found.maxQuestions ?? null,
            questionsPerTeam: found.questionsPerTeam ?? null,
            avoidRepeatQuestions: Boolean(found.avoidRepeatQuestions),
            useInitialScores: Boolean(found.useInitialScores),
            initialScoreMaxPoints: found.initialScoreMaxPoints ?? null,
            presentationMinutes: found.presentationMinutes ?? null,
            presentationWeight: found.presentationWeight ?? null,
            quizWeight: found.quizWeight ?? null,
            noElimination: Boolean(found.noElimination)
          }
        }
        return {
          type: 'quiz' as const,
          useQuestions: true,
          useJudges: false,
          maxQuestions: null,
          questionsPerTeam: null,
          avoidRepeatQuestions: false,
          useInitialScores: false,
          initialScoreMaxPoints: null,
          presentationMinutes: null,
          presentationWeight: null,
          quizWeight: null,
          noElimination: false
        }
      }
    },
    // NOVO - traduz Phase.order (numeração das fases do campeonato,
    // visível ao utilizador) para BracketMatch.round (a ronda real do
    // chaveamento, gerada em bracketLive.ts). São o mesmo número só
    // enquanto todas as fases geram uma ronda de chaveamento própria
    // (ex: apresentacao_quiz no universitario). Assim que existe uma
    // fase "apresentacao" com noElimination: true no meio da sequência
    // (que não gera nenhum BracketMatch - ver bracketLive.ts e
    // socket/index.ts), Phase.order fica à frente do round real em 1
    // (ou mais, se houver várias fases assim) - este getter compensa
    // esse desvio contando, entre as fases ordenadas por `order` até
    // (e incluindo) a fase pedida, quantas delas correspondem
    // efetivamente a uma ronda de bracket.
    //
    // No universitario (sem nenhuma fase apresentacao+noElimination),
    // isto devolve sempre o mesmo valor que `order` - função identidade,
    // nada muda lá.
    phaseOrderToBracketRound: (state) => {
      return (order: number | string): number => {
        const targetOrder = Number(order)
        const sorted = [...state.phases].sort((a, b) => a.order - b.order)
        let round = 0
        let matchedRound: number | null = null
        for (const p of sorted) {
          const isOutsideBracket = p.type === 'apresentacao' && Boolean(p.noElimination)
          if (!isOutsideBracket) round += 1
          if (Number(p.order) === targetOrder) {
            matchedRound = isOutsideBracket ? round + 1 : round
            break
          }
        }
        // Fallback: se a fase não foi encontrada na lista (ainda a
        // carregar, ou dados inconsistentes), assume-se a identidade
        // para não partir nada no caso simples de 1-para-1.
        return matchedRound ?? targetOrder
      }
    }
  },
  actions: {
    async fetchPhases(championship?: string) {
      if (!championship) {
        this.phases = []
        return
      }
      this.phases = await api.get<Phase[]>(`/phases?championship=${encodeURIComponent(championship)}`)
    },
    async addPhase(data: Omit<Phase, 'id' | 'order'>) {
      await api.post('/phases', data)
      await this.fetchPhases(data.championship)
    },
    async updatePhase(id: string, patch: Partial<Phase>) {
      await api.put(`/phases/${id}`, patch)
      if (patch.championship) await this.fetchPhases(patch.championship)
    },
    async deletePhase(id: string, championship: string) {
      await api.delete(`/phases/${id}`)
      await this.fetchPhases(championship)
    },
    async swapPhases(firstId: string, secondId: string, championship: string) {
      const res = await adminFetch('/api/phases/swap', {
        method: 'POST',
        body: JSON.stringify({ firstId, secondId })
      })
      if (!res.ok) throw new Error('Falha ao trocar a ordem das fases')
      await this.fetchPhases(championship)
    },
    async repairNumbering(championship: string) {
      const res = await adminFetch('/api/phases/repair-numbering', {
        method: 'POST',
        body: JSON.stringify({ championship })
      })
      if (!res.ok) throw new Error('Falha ao reparar numeração das fases')
      await this.fetchPhases(championship)
    }
  }
})
