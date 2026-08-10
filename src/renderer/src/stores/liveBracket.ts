import { defineStore } from 'pinia'
import { getBackendUrl } from '../services/backendConfig'

export interface LiveBracketTeam {
  id: string
  name: string
  logoUrl: string | null
}

export interface LiveBracketMatch {
  id: number
  round: number
  slot: number
  groupName: string | null
  teamA: LiveBracketTeam | null
  teamB: LiveBracketTeam | null
  winnerId: string | null
}

export const useLiveBracketStore = defineStore('liveBracket', {
  state: () => ({
    matches: [] as LiveBracketMatch[]
  }),
  getters: {
    totalRounds: (state) => (state.matches.length ? Math.max(...state.matches.map((m) => m.round)) : 0),
    pendingMatches: (state) => state.matches.filter((m) => !m.winnerId && m.teamA && m.teamB),
    forTournamentBracket: (state) => {
      const total = state.matches.length ? Math.max(...state.matches.map((m) => m.round)) : 0
      if (total === 0) return null
      const rounds = []
      for (let r = 1; r < total; r++) {
        const roundMatches = state.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)
        const half = Math.ceil(roundMatches.length / 2)
        const remaining = total - r
        const name = remaining === 1 ? 'Meias-Finais' : remaining === 2 ? 'Quartas de Final' : `Ronda ${r}`
        rounds.push({ name, leftMatches: roundMatches.slice(0, half), rightMatches: roundMatches.slice(half) })
      }
      const finalMatch = state.matches.find((m) => m.round === total) ?? { id: 'final' }
      return { rounds, finalMatch }
    }
  },
  actions: {
    async fetchBracket(championship: string) {
      const res = await fetch(`${getBackendUrl()}/api/bracket-live/${championship}`)
      const data = await res.json()
      this.matches = data.matches
    },
    async generate(championship: string) {
      await fetch(`${getBackendUrl()}/api/bracket-live/${championship}/generate`, { method: 'POST' })
      await this.fetchBracket(championship)
    },
    // NOVO: usa o DELETE /:championship que já existe no bracketLive.ts —
    // apaga só o chaveamento ativo, nunca o histórico de campeonatos já
    // finalizados (esses vivem numa tabela completamente separada).
    async clearBracket(championship: string): Promise<void> {
      await fetch(`${getBackendUrl()}/api/bracket-live/${championship}`, { method: 'DELETE' })
      this.matches = []
    }
  }
})
