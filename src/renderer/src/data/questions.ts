export interface QuizQuestion {
  id: number
  text: string
  options: { label: string; text: string }[]
  correctIndex: number
  points: number
  phase: number
  isTiebreaker: boolean
  imageUrl?: string
}

export const questions: QuizQuestion[] = []
