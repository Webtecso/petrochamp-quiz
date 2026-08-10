export interface EvaluationItem {
  id: string
  type: 'analitica' | 'apresentacao'
  text: string
  maxPoints: number
  phase: number
  scope: 'single' | 'all'
}

export const evaluationItems: EvaluationItem[] = [
  {
    id: 'ap-1',
    type: 'apresentacao',
    text: 'Apresentação de Projeto — Fase 1',
    maxPoints: 30,
    phase: 1,
    scope: 'single'
  },
  {
    id: 'an-1',
    type: 'analitica',
    text: 'Explique o processo de refinação do petróleo bruto e as suas principais etapas.',
    maxPoints: 20,
    phase: 1,
    scope: 'single'
  },
  {
    id: 'an-2',
    type: 'analitica',
    text: 'Analise os impactos ambientais da exploração offshore e proponha medidas de mitigação.',
    maxPoints: 20,
    phase: 2,
    scope: 'single'
  }
]
