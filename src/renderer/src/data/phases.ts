export interface PhaseInfo {
  number: 1 | 2 | 3
  label: string
}

export const phases: PhaseInfo[] = [
  { number: 1, label: 'Perfuração' },
  { number: 2, label: 'Extração' },
  { number: 3, label: 'Refinação' }
]

export function getPhaseLabel(phaseNumber: number): string {
  return phases.find((p) => p.number === phaseNumber)?.label ?? 'Perfuração'
}
