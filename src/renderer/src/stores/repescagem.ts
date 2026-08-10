import { defineStore } from 'pinia'
import { getBackendUrl } from '../services/backendConfig'

export interface RepescagemTally {
  teamId: string
  name: string
  institution: string
  logoUrl: string | null
  votes: number
}

export interface RepescagemConfig {
  id: number
  championship: string
  phase: number
  maxRepescados: number
  votingDurationSeconds: number
  votingOpen: boolean
  started: boolean
}

export interface RepescagemBracketMatch {
  id: number
  round: number
  slot: number
  groupName: string | null
  teamA: { id: string; name: string; logoUrl: string | null } | null
  teamB: { id: string; name: string; logoUrl: string | null } | null
  winnerId: string | null
}

export const useRepescagemStore = defineStore('repescagem', {
  state: () => ({
    config: null as RepescagemConfig | null,
    tally: [] as RepescagemTally[],
    bracketMatches: [] as RepescagemBracketMatch[]
  }),
  getters: {
    pendingMatches: (state) => state.bracketMatches.filter((m) => !m.winnerId && m.teamA && m.teamB)
  },
  actions: {
    async fetchActive() {
      const res = await fetch(`${getBackendUrl()}/api/repescagem/active`)
      const data = await res.json()
      this.config = data?.config ?? (data && 'id' in data ? data : null)
      if (data?.tally) {
        this.tally = data.tally
      }
      return data
    },
    async fetchForPhase(championship: string, phase: number) {
      const res = await fetch(`${getBackendUrl()}/api/repescagem/for-phase?championship=${championship}&phase=${phase}`)
      const data = await res.json()
      this.config = data ?? null
    },
    async fetchTally() {
      const res = await fetch(`${getBackendUrl()}/api/repescagem/active`)
      const data = await res.json()
      this.config = data?.config ?? null
      this.tally = data?.tally ?? []
    },
    async generateBracket() {
      if (!this.config) return
      await fetch(`${getBackendUrl()}/api/repescagem/${this.config.id}/generate-bracket`, { method: 'POST' })
      await this.fetchBracket()
    },
    async fetchBracket() {
      if (!this.config) return
      const res = await fetch(`${getBackendUrl()}/api/repescagem/${this.config.id}/bracket`)
      const data = await res.json()
      this.bracketMatches = data.matches ?? []
    },
    async insertChampion(targetMatchId?: number): Promise<{ success: boolean; error?: string }> {
      if (!this.config) return { success: false, error: 'Nenhuma repescagem configurada.' }
      const res = await fetch(`${getBackendUrl()}/api/repescagem/${this.config.id}/insert-champion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetMatchId })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) return { success: false, error: data.error ?? 'Falha ao inserir a campeã.' }
      await this.fetchBracket()
      return { success: true }
    }
  }
})
