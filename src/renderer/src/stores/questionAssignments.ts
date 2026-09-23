import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface QuestionAssignment {
  id: string
  phaseId: string
  teamId: string
  questionId: string
  order: number
  usedAt: string | null
  question?: { id: string; text: string; phase: number }
  team?: { id: string; name: string }
}

export const useQuestionAssignmentsStore = defineStore('questionAssignments', {
  state: () => ({
    assignments: [] as QuestionAssignment[]
  }),
  getters: {
    forTeam: (state) => {
      return (teamId: string): QuestionAssignment[] =>
        state.assignments
          .filter((a) => a.teamId === teamId)
          .sort((a, b) => a.order - b.order)
    }
  },
  actions: {
    async fetchForPhase(phaseId: string) {
      if (!phaseId) {
        this.assignments = []
        return
      }
      this.assignments = await api.get<QuestionAssignment[]>(
        `/question-assignments?phaseId=${encodeURIComponent(phaseId)}`
      )
    },
    async saveForTeam(phaseId: string, teamId: string, questionIds: string[]) {
      await api.post('/question-assignments', { phaseId, teamId, questionIds })
      await this.fetchForPhase(phaseId)
    },
    async removeAssignment(id: string, phaseId: string) {
      await api.delete(`/question-assignments/${id}`)
      await this.fetchForPhase(phaseId)
    }
  }
})
