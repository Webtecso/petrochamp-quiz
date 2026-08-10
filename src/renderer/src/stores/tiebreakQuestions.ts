import { defineStore } from 'pinia'
import { api } from '../services/api'
import type { QuizQuestion } from '../data/questions'

export const useTiebreakQuestionsStore = defineStore('tiebreakQuestions', {
  state: () => ({
    questions: [] as QuizQuestion[]
  }),
  getters: {
    questionsForPhase: (state) => {
      return (phase: number): QuizQuestion[] => state.questions.filter((q) => q.phase === phase)
    }
  },
  actions: {
    async fetchQuestions(championship?: string) {
      if (!championship) {
        this.questions = []
        return
      }
      this.questions = await api.get<QuizQuestion[]>(`/tiebreak-questions?championship=${encodeURIComponent(championship)}`)
    },
    async addQuestion(question: Omit<QuizQuestion, 'id'> & { championship: string }) {
      await api.post('/tiebreak-questions', question)
      await this.fetchQuestions(question.championship)
    },
    async updateQuestion(id: number, patch: Partial<QuizQuestion> & { championship: string }) {
      const current = this.questions.find((q) => q.id === id)
      if (!current) return
      await api.put(`/tiebreak-questions/${id}`, { ...current, ...patch })
      await this.fetchQuestions(patch.championship)
    },
    async deleteQuestion(id: number, championship: string) {
      await api.delete(`/tiebreak-questions/${id}`)
      await this.fetchQuestions(championship)
    }
  }
})
