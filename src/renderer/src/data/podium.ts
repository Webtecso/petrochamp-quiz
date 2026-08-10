export interface PodiumTeamResult {
  name: string
  subtitle: string
  score: number
}

export const podiumResult: {
  first: PodiumTeamResult
  second: PodiumTeamResult
  third: PodiumTeamResult
} = {
  first: { name: 'ISPTEC', subtitle: 'Mestre do Petróleo', score: 5250 },
  second: { name: 'UAN', subtitle: 'Perfurador de Elite', score: 3980 },
  third: { name: 'Oil Masters', subtitle: 'Especialista em Refino', score: 2860 }
}
