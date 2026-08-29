import { prisma } from '../db'

const BATTLE_PHASE_TYPES = ['quiz', 'apresentacao_quiz']

// Dado o order de uma fase, devolve a que ronda do chaveamento ela
// corresponde - contando só fases de batalha (quiz/apresentacao_quiz)
// até e incluindo essa fase. Fases de apresentação pura não contam.
// Devolve null se a fase não for uma fase de batalha (não tem ronda).
export async function getRoundForPhaseOrder(
  championship: string,
  phaseOrder: number
): Promise<number | null> {
  const phases = await prisma.phase.findMany({
    where: { championship, deletedAt: null, order: { lte: phaseOrder } },
    orderBy: { order: 'asc' }
  })
  const target = phases.find((p) => p.order === phaseOrder)
  if (!target || !BATTLE_PHASE_TYPES.includes(target.type)) return null
  return phases.filter((p) => BATTLE_PHASE_TYPES.includes(p.type)).length
}

// Inverso: dado um round do bracket, devolve a Phase correspondente
// (a N-ésima fase de batalha, por ordem).
export async function getPhaseForRound(championship: string, round: number) {
  const phases = await prisma.phase.findMany({
    where: { championship, deletedAt: null, type: { in: BATTLE_PHASE_TYPES } },
    orderBy: { order: 'asc' }
  })
  return phases[round - 1] ?? null
}
