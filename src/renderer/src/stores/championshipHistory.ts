import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface ChampionshipHistoryEntry {
  id: number
  championship: string
  editionName: string
  championTeamId: string | null
  championTeamName: string | null
  finalRankingJson: string
  matchesJson: string
  totalMatches: number
  startedAt: string
  endedAt: string
  createdAt: string
}

export const useChampionshipHistoryStore = defineStore('championshipHistory', {
  state: () => ({
    entries: [] as ChampionshipHistoryEntry[]
  }),
  actions: {
    async fetchHistory(filter?: { championship?: string }) {
      const query = filter?.championship ? `?championship=${encodeURIComponent(filter.championship)}` : ''
      this.entries = await api.get<ChampionshipHistoryEntry[]>(`/championship-history${query}`)
    },
    async deleteEntry(id: number) {
      await api.delete(`/championship-history/${id}`)
      this.entries = this.entries.filter((e) => e.id !== id)
    }
  }
})
