import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface SuspensePhrase {
  id: number
  text: string
}

export const useSuspensePhrasesStore = defineStore('suspensePhrases', {
  state: () => ({
    phrases: [] as SuspensePhrase[]
  }),
  getters: {
    randomPhrase: (state) => {
      if (!state.phrases.length) return null
      return state.phrases[Math.floor(Math.random() * state.phrases.length)].text
    }
  },
  actions: {
    async fetchPhrases() {
      this.phrases = await api.get<SuspensePhrase[]>('/suspense-phrases')
    },
    async addPhrase(text: string) {
      await api.post('/suspense-phrases', { text })
      await this.fetchPhrases()
    },
    async deletePhrase(id: number) {
      await api.delete(`/suspense-phrases/${id}`)
      await this.fetchPhrases()
    }
  }
})
