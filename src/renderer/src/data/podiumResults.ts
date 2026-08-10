export interface PodiumEntry {
  id: string
  name: string
  institution: string
  score: number
}

export interface PodiumPhaseResult {
  phase: number
  phaseLabel: string
  entries: PodiumEntry[]
}

export const podiumResults: PodiumPhaseResult[] = [
  {
    phase: 1,
    phaseLabel: 'Perfuração',
    entries: [
      { id: 'isptec', name: 'ISPTEC', institution: 'Instituto Politécnico', score: 30 },
      { id: 'uan', name: 'UAN', institution: 'Universidade Agostinho Neto', score: 24 },
      { id: 'unia', name: 'UNIA', institution: 'Universidade Independente de Angola', score: 18 }
    ]
  },
  {
    phase: 2,
    phaseLabel: 'Extração',
    entries: [
      { id: 'isptec', name: 'ISPTEC', institution: 'Instituto Politécnico', score: 58 },
      { id: 'ucan', name: 'UCAN', institution: 'Universidade Católica de Angola', score: 47 },
      { id: 'uan', name: 'UAN', institution: 'Universidade Agostinho Neto', score: 41 }
    ]
  },
  {
    phase: 3,
    phaseLabel: 'Refinação · Grande Final',
    entries: [
      { id: 'isptec', name: 'ISPTEC', institution: 'Instituto Politécnico', score: 92 },
      { id: 'ucan', name: 'UCAN', institution: 'Universidade Católica de Angola', score: 81 },
      { id: 'ippl', name: 'IPPL', institution: 'Instituto Politécnico Pascoal Luvualu', score: 76 }
    ]
  }
]
