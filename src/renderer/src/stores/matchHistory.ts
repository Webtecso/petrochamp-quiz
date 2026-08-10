import { defineStore } from 'pinia'
import { api } from '../services/api'

export interface MatchHistoryEntry {
  id: number
  championship: string
  editionName: string | null
  phase: number
  phaseLabel: string
  teamAName: string
  teamBName: string
  teamAScore: number
  teamBScore: number
  winnerName: string | null
  wasTiebreak: boolean
  startedAt: string
  endedAt: string
  durationSeconds: number
}

export const useMatchHistoryStore = defineStore('matchHistory', {
  state: () => ({
    entries: [] as MatchHistoryEntry[]
  }),
  actions: {
    async fetchHistory(filters?: { championship?: string; phase?: number }) {
      const params = new URLSearchParams()
      if (filters?.championship) params.set('championship', filters.championship)
      if (filters?.phase) params.set('phase', String(filters.phase))
      const query = params.toString() ? `?${params.toString()}` : ''
      this.entries = await api.get<MatchHistoryEntry[]>(`/match-history${query}`)
    },
    async deleteEntry(id: number) {
      await api.delete(`/match-history/${id}`)
      this.entries = this.entries.filter((e) => e.id !== id)
    }
  }
})
