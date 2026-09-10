import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface TiebreakQuestionOption {
  label: string
  text: string
}

export interface TiebreakQuestion {
  id: string
  championship: string
  text: string
  imageUrl?: string
  correctIndexes: number[]
  correctIndex: number
  points: number
  phase: number
  options: TiebreakQuestionOption[]
}

export const useTiebreakQuestionsStore = defineStore('tiebreakQuestions', {
  state: () => ({
    questions: [] as TiebreakQuestion[]
  }),
  getters: {
    questionsForPhase: (state) => {
      return (phase: number): TiebreakQuestion[] => {
        const exact = state.questions.filter((q) => q.phase === phase)
        if (exact.length > 0) return exact
        return state.questions
      }
    }
  },
  actions: {
    async fetchQuestions(championship?: string) {
      if (!championship) {
        this.questions = []
        return
      }
      this.questions = await api.get<TiebreakQuestion[]>(`/tiebreak-questions?championship=${encodeURIComponent(championship)}`)
    },
    async addQuestion(question: {
      championship: string
      text: string
      imageUrl?: string
      options: TiebreakQuestionOption[]
      correctIndexes: number[]
      points: number
      phase: number
    }) {
      await api.post('/tiebreak-questions', question)
      await this.fetchQuestions(question.championship)
    },
    async updateQuestion(
      id: string,
      patch: {
        championship: string
        text: string
        imageUrl?: string
        options: TiebreakQuestionOption[]
        correctIndexes: number[]
        points: number
        phase: number
      }
    ) {
      await api.put(`/tiebreak-questions/${id}`, patch)
      await this.fetchQuestions(patch.championship)
    },
    async deleteQuestion(id: string, championship: string) {
      await api.delete(`/tiebreak-questions/${id}`)
      await this.fetchQuestions(championship)
    }
  }
})
