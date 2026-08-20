import { defineStore } from 'pinia'
import { api } from '../services/api'
import type { QuizQuestion } from '../data/questions'
import type { EvaluationItem } from '../data/evaluationItems'

export { EvaluationItem }

// NOVO — mesma forma que QuizQuestion (o modelo TiebreakQuestion no Prisma
// tem os mesmos campos optionA-D/correctIndex), mas é uma tabela separada.
export type TiebreakQuestion = QuizQuestion

export const useQuizContentStore = defineStore('quizContent', {
  state: () => ({
    questions: [] as QuizQuestion[],
    evaluationItems: [] as EvaluationItem[],
    tiebreakQuestions: [] as TiebreakQuestion[] // NOVO
  }),
  getters: {
    questionsForPhase: (state) => {
      return (phase: number): QuizQuestion[] => state.questions.filter((q) => q.phase === phase)
    },
    itemsForPhase: (state) => {
      return (phase: number): EvaluationItem[] => state.evaluationItems.filter((i) => i.phase === phase)
    },
    // NOVO
    tiebreakQuestionsForPhase: (state) => {
      return (phase: number): TiebreakQuestion[] => state.tiebreakQuestions.filter((q) => q.phase === phase)
    }
  },
  actions: {
    async fetchQuestions(championship?: string) {
      if (!championship) {
        this.questions = []
        return
      }
      this.questions = await api.get<QuizQuestion[]>(`/questions?championship=${encodeURIComponent(championship)}`)
    },
    async fetchEvaluationItems(championship?: string) {
      if (!championship) {
        this.evaluationItems = []
        return
      }
      this.evaluationItems = await api.get<EvaluationItem[]>(`/evaluation-items?championship=${encodeURIComponent(championship)}`)
    },
    // NOVO — segue o mesmo padrão de fetchQuestions. Ajusta o path se a tua
    // rota REST para TiebreakQuestion tiver outro nome.
    async fetchTiebreakQuestions(championship?: string) {
      if (!championship) {
        this.tiebreakQuestions = []
        return
      }
      this.tiebreakQuestions = await api.get<TiebreakQuestion[]>(
        `/tiebreak-questions?championship=${encodeURIComponent(championship)}`
      )
    },
    async addQuestion(question: Omit<QuizQuestion, 'id'> & { championship: string }) {
      await api.post('/questions', question)
      await this.fetchQuestions(question.championship)
    },
    async updateQuestion(id: number, patch: Partial<QuizQuestion> & { championship: string }) {
      const current = this.questions.find((q) => q.id === id)
      if (!current) return
      await api.put(`/questions/${id}`, { ...current, ...patch })
      await this.fetchQuestions(patch.championship)
    },
    async deleteQuestion(id: number, championship: string) {
      await api.delete(`/questions/${id}`)
      await this.fetchQuestions(championship)
    },
    async addEvaluationItem(item: Omit<EvaluationItem, 'id'> & { championship: string }) {
      await api.post('/evaluation-items', item)
      await this.fetchEvaluationItems(item.championship)
    },
    async updateEvaluationItem(id: string, patch: Partial<EvaluationItem> & { championship: string }) {
      const current = this.evaluationItems.find((i) => i.id === id)
      if (!current) return
      await api.put(`/evaluation-items/${id}`, { ...current, ...patch })
      await this.fetchEvaluationItems(patch.championship)
    },
    async deleteEvaluationItem(id: string, championship?: string) {
      await api.delete(`/evaluation-items/${id}`)
      await this.fetchEvaluationItems(championship)
    },
    async clearAllEvaluationItems(championship?: string) {
      for (const item of [...this.evaluationItems]) {
        await api.delete(`/evaluation-items/${item.id}`)
      }
      await this.fetchEvaluationItems(championship)
    }
  }
})
