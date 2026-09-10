import { defineStore } from 'pinia'
import { api } from '../services/api'
import type { QuizQuestion } from '../data/questions'
import type { EvaluationItem } from '../data/evaluationItems'

export { EvaluationItem }

// Mesma forma que QuizQuestion (o modelo TiebreakQuestion no Prisma
// tem os mesmos campos optionA-D/correctIndex), mas é uma tabela separada.
export type TiebreakQuestion = QuizQuestion

// NOVO - critério de avaliação de uma Pergunta Analítica "aberta"
// (Admin → Avaliação). Um item pode ter vários; se tiver pelo menos um,
// os jurados pontuam por critério (para as duas equipas) em vez de uma
// nota única.
export interface EvaluationCriteria {
  id: string
  itemId: string
  label: string
  maxPoints: number
  order: number
}

export const useQuizContentStore = defineStore('quizContent', {
  state: () => ({
    questions: [] as QuizQuestion[],
    evaluationItems: [] as EvaluationItem[],
    tiebreakQuestions: [] as TiebreakQuestion[],
    // NOVO - critérios carregados, indexados por itemId (mais barato que
    // filtrar uma lista plana sempre que uma view precisa dos critérios
    // de um item específico).
    evaluationCriteriaByItem: {} as Record<string, EvaluationCriteria[]>
  }),
  getters: {
    questionsForPhase: (state) => {
      return (phase: number): QuizQuestion[] => {
        const exact = state.questions.filter((q) => q.phase === phase)
        if (exact.length > 0) return exact

        // Algumas fases compostas (ex.: apresentacao_quiz) podem avançar
        // o estado do frontend para um número de fase que não bate
        // exatamente com o campo `question.phase` gravado na base de dados.
        // Em vez de deixar a UI em vazio, usamos a lista completa da
        // competição como fallback até ao frontend ajustar a fase real.
        return state.questions
      }
    },
    itemsForPhase: (state) => {
      return (phase: number): EvaluationItem[] => state.evaluationItems.filter((i) => i.phase === phase)
    },
    tiebreakQuestionsForPhase: (state) => {
      return (phase: number): TiebreakQuestion[] => {
        const exact = state.tiebreakQuestions.filter((q) => q.phase === phase)
        if (exact.length > 0) return exact
        return state.tiebreakQuestions
      }
    },
    // NOVO
    criteriaForItem: (state) => {
      return (itemId: string): EvaluationCriteria[] => state.evaluationCriteriaByItem[itemId] ?? []
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
    async fetchTiebreakQuestions(championship?: string) {
      if (!championship) {
        this.tiebreakQuestions = []
        return
      }
      this.tiebreakQuestions = await api.get<TiebreakQuestion[]>(
        `/tiebreak-questions?championship=${encodeURIComponent(championship)}`
      )
    },
    async addQuestion(question: Partial<QuizQuestion> & { championship: string; text: string; options: QuizQuestion['options'] }) {
      await api.post('/questions', question)
      await this.fetchQuestions(question.championship)
    },
    async updateQuestion(id: string, patch: Partial<QuizQuestion> & { championship: string }) {
      const current = this.questions.find((q) => q.id === id)
      if (!current) return
      await api.put(`/questions/${id}`, { ...current, ...patch })
      await this.fetchQuestions(patch.championship)
    },
    async deleteQuestion(id: string, championship: string) {
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
    },
    // NOVO - carrega os critérios de um item específico e guarda-os
    // indexados por itemId.
    async fetchEvaluationCriteria(itemId: string) {
      const criteria = await api.get<EvaluationCriteria[]>(`/evaluation-criteria?itemId=${encodeURIComponent(itemId)}`)
      this.evaluationCriteriaByItem = { ...this.evaluationCriteriaByItem, [itemId]: criteria }
    },
    // NOVO
    async addEvaluationCriteria(itemId: string, label: string, maxPoints: number) {
      await api.post('/evaluation-criteria', { itemId, label, maxPoints })
      await this.fetchEvaluationCriteria(itemId)
    },
    // NOVO
    async updateEvaluationCriteria(id: string, itemId: string, patch: { label?: string; maxPoints?: number }) {
      await api.put(`/evaluation-criteria/${id}`, patch)
      await this.fetchEvaluationCriteria(itemId)
    },
    // NOVO
    async deleteEvaluationCriteria(id: string, itemId: string) {
      await api.delete(`/evaluation-criteria/${id}`)
      await this.fetchEvaluationCriteria(itemId)
    }
  }
})
