export interface EvaluationItem {
  id: string
  championship?: string
  type: 'analitica' | 'apresentacao'
  mode: 'aberta' | 'multipla_escolha'
  text: string
  imageUrl?: string | null
  optionA?: string | null
  optionB?: string | null
  optionC?: string | null
  optionD?: string | null
  correctIndex?: number | null
  timeSeconds?: number | null
  maxPoints: number
  phase: number
  scope: 'single' | 'all'
  jurorIds?: string[]
}

export const evaluationItems: EvaluationItem[] = [
  {
    id: 'ap-1',
    type: 'apresentacao',
    mode: 'aberta',
    text: 'Apresentação de Projeto — Fase 1',
    maxPoints: 30,
    phase: 1,
    scope: 'single'
  },
  {
    id: 'an-1',
    type: 'analitica',
    mode: 'aberta',
    text: 'Explique o processo de refinação do petróleo bruto e as suas principais etapas.',
    maxPoints: 20,
    phase: 1,
    scope: 'single'
  },
  {
    id: 'an-2',
    type: 'analitica',
    mode: 'aberta',
    text: 'Analise os impactos ambientais da exploração offshore e proponha medidas de mitigação.',
    maxPoints: 20,
    phase: 2,
    scope: 'single'
  }
]
