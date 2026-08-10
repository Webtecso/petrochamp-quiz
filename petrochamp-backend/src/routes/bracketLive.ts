import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function roundLabel(round: number, total: number): string {
  const remaining = total - round
  if (remaining === 0) return 'Final'
  if (remaining === 1) return 'Meias-Finais'
  if (remaining === 2) return 'Quartas de Final'
  return `Ronda ${round}`
}

// Cria automaticamente as Fases que faltarem para cobrir todas as rondas do
// chaveamento — nunca apaga fases já existentes, só acrescenta as que faltam.
async function ensurePhasesForRounds(championship: string, totalRounds: number): Promise<void> {
  const existing = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  for (let round = 1; round <= totalRounds; round++) {
    const already = existing.find((p) => p.order === round)
    if (!already) {
      await prisma.phase.create({
        data: {
          championship,
          order: round,
          label: roundLabel(round, totalRounds),
          useQuestions: true,
          useJudges: false,
          avoidRepeatQuestions: true
        }
      })
    }
  }
}

// Se uma equipa ficar sozinha num confronto (número ímpar de equipas), ela
// avança automaticamente sem batalha — em cascata, ronda a ronda.
async function resolveByesRecursively(championship: string, totalRounds: number): Promise<void> {
  for (let round = 1; round < totalRounds; round++) {
    const matches = await prisma.bracketMatch.findMany({ where: { championship, round, winnerId: null } })
    for (const m of matches) {
      const hasA = !!m.teamAId
      const hasB = !!m.teamBId
      if (hasA !== hasB) {
        const winnerId = hasA ? m.teamAId! : m.teamBId!
        await prisma.bracketMatch.update({ where: { id: m.id }, data: { winnerId } })
        const nextSlot = Math.floor(m.slot / 2)
        const nextMatch = await prisma.bracketMatch.findFirst({
          where: { championship, round: m.round + 1, slot: nextSlot }
        })
        if (nextMatch) {
          const isFirstChild = m.slot % 2 === 0
          await prisma.bracketMatch.update({
            where: { id: nextMatch.id },
            data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
          })
        }
      }
    }
  }
}

router.get('/:championship', async (req, res) => {
  const { championship } = req.params
  const matches = await prisma.bracketMatch.findMany({
    where: { championship },
    orderBy: [{ round: 'asc' }, { slot: 'asc' }]
  })

  const teamIds = new Set<string>()
  for (const m of matches) {
    if (m.teamAId) teamIds.add(m.teamAId)
    if (m.teamBId) teamIds.add(m.teamBId)
  }
  const teams = await prisma.team.findMany({ where: { id: { in: Array.from(teamIds) } } })
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  const shaped = matches.map((m) => ({
    id: m.id,
    round: m.round,
    slot: m.slot,
    groupName: m.groupName,
    teamA: m.teamAId
      ? { id: m.teamAId, name: teamMap.get(m.teamAId)?.name ?? '?', logoUrl: teamMap.get(m.teamAId)?.logoUrl ?? null }
      : null,
    teamB: m.teamBId
      ? { id: m.teamBId, name: teamMap.get(m.teamBId)?.name ?? '?', logoUrl: teamMap.get(m.teamBId)?.logoUrl ?? null }
      : null,
    winnerId: m.winnerId
  }))

  res.json({ championship, matches: shaped })
})

router.post('/:championship/generate', async (req, res) => {
  const { championship } = req.params
  await prisma.bracketMatch.deleteMany({ where: { championship } })

  const teams = await prisma.team.findMany({
    where: { category: championship },
    orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
  })

  if (teams.length < 2) {
    res.status(400).json({ error: 'É preciso pelo menos 2 equipas cadastradas nesta categoria.' })
    return
  }

  const slotsNeeded = nextPowerOfTwo(teams.length)
  const round1Count = slotsNeeded / 2
  const totalRounds = Math.log2(slotsNeeded)

  const created: { round: number; slot: number; teamAId?: string | null; teamBId?: string | null; groupName?: string }[] = []

  for (let slot = 0; slot < round1Count; slot++) {
    const teamA = teams[slot * 2]
    const teamB = teams[slot * 2 + 1]
    created.push({ round: 1, slot, teamAId: teamA?.id ?? null, teamBId: teamB?.id ?? null, groupName: teamA?.group ?? undefined })
  }

  for (let round = 2; round <= totalRounds; round++) {
    const count = slotsNeeded / Math.pow(2, round)
    for (let slot = 0; slot < count; slot++) {
      created.push({ round, slot })
    }
  }

  await prisma.bracketMatch.createMany({
    data: created.map((c) => ({
      championship,
      round: c.round,
      slot: c.slot,
      teamAId: c.teamAId ?? null,
      teamBId: c.teamBId ?? null,
      groupName: c.groupName ?? null
    }))
  })

  await resolveByesRecursively(championship, totalRounds)
  await ensurePhasesForRounds(championship, totalRounds)

  res.status(201).json({ success: true, totalRounds })
})

// Novo — "Eliminar Chaveamento": apaga só os confrontos, mantém equipas e histórico.
router.delete('/:championship', async (req, res) => {
  const { championship } = req.params
  await prisma.bracketMatch.deleteMany({ where: { championship } })
  res.status(204).send()
})

export default router
