import { defineStore } from 'pinia'
import { api } from '../services/api'
import { adminFetch } from '../services/adminAuth'

export interface Phase {
  id: number
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
          return {
            type: found.type ?? 'quiz',
            useQuestions: Boolean(found.useQuestions),
            useJudges: Boolean(found.useJudges),
            maxQuestions: found.maxQuestions ?? null,
            questionsPerTeam: found.questionsPerTeam ?? null,
            avoidRepeatQuestions: Boolean(found.avoidRepeatQuestions),
            useInitialScores: Boolean(found.useInitialScores),
            initialScoreMaxPoints: found.initialScoreMaxPoints ?? null,
            presentationMinutes: found.presentationMinutes ?? null,
            presentationWeight: found.presentationWeight ?? null,
            quizWeight: found.quizWeight ?? null
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
          quizWeight: null
        }
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
    async updatePhase(id: number, patch: Partial<Phase>) {
      await api.put(`/phases/${id}`, patch)
      if (patch.championship) await this.fetchPhases(patch.championship)
    },
    async deletePhase(id: number, championship: string) {
      await api.delete(`/phases/${id}`)
      await this.fetchPhases(championship)
    },
    async swapPhases(firstId: number, secondId: number, championship: string) {
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
