export interface BracketTeamSlot {
  id: string
  name: string
}

export interface BracketMatch {
  id: string
  teamA?: BracketTeamSlot
  teamB?: BracketTeamSlot
  winnerId?: string
}

export interface BracketRound {
  name: string
  leftMatches: BracketMatch[]
  rightMatches: BracketMatch[]
}

export interface BracketPhase {
  name: string
  matches: BracketMatch[]
}

export interface ChampionshipBracket {
  championship: 'universitario' | 'ensino_medio' | 'exibicao'
  title: string
  rounds: BracketRound[]
  finalMatch: BracketMatch
}

export const brackets: ChampionshipBracket[] = [
  {
    championship: 'ensino_medio',
    title: 'Campeonato do Ensino Médio · Quartas de Final',
    rounds: [
      {
        name: 'Quartas de Final',
        leftMatches: [{ id: 'em-q1' }],
        rightMatches: [{ id: 'em-q2' }]
      }
    ],
    finalMatch: { id: 'em-final' }
  },
  {
    championship: 'exibicao',
    title: 'Batalha de Exibição · Final',
    rounds: [
      {
        name: 'Final',
        leftMatches: [{ id: 'ex-q1' }],
        rightMatches: []
      }
    ],
    finalMatch: { id: 'ex-final' }
  },
  {
    championship: 'universitario',
    title: 'Campeonato Universitário · Quartas de Final',
    rounds: [
      {
        name: 'Quartas de Final',
        leftMatches: [{ id: 'u-q1' }, { id: 'u-q2' }],
        rightMatches: [{ id: 'u-q3' }, { id: 'u-q4' }]
      },
      {
        name: 'Meias-Finais',
        leftMatches: [{ id: 'u-s1' }],
        rightMatches: [{ id: 'u-s2' }]
      }
    ],
    finalMatch: { id: 'u-final' }
  }
]

export function getBracketFor(championship: string): ChampionshipBracket | undefined {
  return brackets.find((b) => b.championship === championship)
}
