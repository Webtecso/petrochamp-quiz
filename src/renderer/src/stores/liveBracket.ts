import { defineStore } from 'pinia'
import { getBackendUrl } from '../services/backendConfig'
import { adminFetch } from '../services/adminAuth'

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
    // MANTIDO por compatibilidade com outros usos existentes, mas
    // NÃO deve ser usado para a tela de escolha de confronto do
    // moderador - ver pendingMatchesForRound abaixo.
    pendingMatches: (state) => state.matches.filter((m) => !m.winnerId && m.teamA && m.teamB),
    // CORRIGIDO - bug em que equipas de rondas diferentes apareciam
    // juntas na tela de escolha do moderador. `pendingMatches` (acima)
    // filtra por TODO o chaveamento, sem olhar à ronda - assim que uma
    // equipa avançava automaticamente para a ronda seguinte (por bye, ou
    // por o adversário já estar decidido), o confronto dessa ronda
    // seguinte aparecia na lista ao mesmo tempo que confrontos antigos
    // da ronda anterior, dando a impressão de uma equipa "já batalhou"
    // reaparecer e impedindo a seleção correta da dupla certa.
    // Esta versão filtra explicitamente pela ronda pedida (a fase atual
    // do campeonato, store.phase), pelo que só mostra os confrontos que
    // pertencem mesmo à ronda em curso.
    pendingMatchesForRound: (state) => (round: number) =>
      state.matches.filter((m) => m.round === round && !m.winnerId && m.teamA && m.teamB),
    forTournamentBracket: (state) => {
      const total = state.matches.length ? Math.max(...state.matches.map((m) => m.round)) : 0
      if (total === 0) return null
      const rounds: { name: string; leftMatches: LiveBracketMatch[]; rightMatches: LiveBracketMatch[] }[] = []
      for (let r = 1; r < total; r++) {
        const roundMatches = state.matches.filter((m) => m.round === r).sort((a, b) => a.slot - b.slot)
        const half = Math.ceil(roundMatches.length / 2)
        const remaining = total - r
        const name = remaining === 1 ? 'Meias-Finais' : remaining === 2 ? 'Quartas de Final' : `Ronda ${r}`
        rounds.push({ name, leftMatches: roundMatches.slice(0, half), rightMatches: roundMatches.slice(half) })
      }
      const finalMatch = state.matches.find((m) => m.round === total) ?? ({ id: 0 } as any) // Cast forçado para evitar erro de tipo com objeto dummy
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
      await adminFetch(`/api/bracket-live/${championship}/generate`, { method: 'POST' })
      await this.fetchBracket(championship)
    },
    async clearBracket(championship: string): Promise<void> {
      await adminFetch(`/api/bracket-live/${championship}`, { method: 'DELETE' })
      this.matches = []
    }
  }
})
