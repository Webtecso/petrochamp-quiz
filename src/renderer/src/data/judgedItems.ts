export interface JudgedItem {
  id: string
  kind: 'analitica' | 'apresentacao'
  phase: number
  text: string
  maxPoints: number
}

export const judgedItems: JudgedItem[] = [
  {
    id: 'apresentacao-1',
    kind: 'apresentacao',
    phase: 1,
    text: 'Apresentação do Projeto - Fase 1 (Perfuração)',
    maxPoints: 30
  },
  {
    id: 'analitica-1',
    kind: 'analitica',
    phase: 2,
    text: 'Explique o processo de refinação do petróleo bruto e as suas principais etapas.',
    maxPoints: 20
  },
  {
    id: 'analitica-2',
    kind: 'analitica',
    phase: 2,
    text: 'Analise os impactos ambientais da exploração offshore e proponha medidas de mitigação.',
    maxPoints: 20
  }
]
