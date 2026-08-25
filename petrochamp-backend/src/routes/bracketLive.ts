import { Router } from 'express'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'
import { emitConfigUpdated } from '../socket/configEvents'

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

// Cria/atualiza as PresentationDuplas de uma ronda específica, sempre que
// essa ronda corresponder a uma fase de Apresentação (pura ou + Quiz) e já
// tiver equipas definidas nos confrontos. Chamada tanto ao gerar o
// chaveamento (Ronda 1) como sempre que uma equipa avança para uma ronda
// seguinte (ver recordBracketResult em socket/index.ts) — assim as duplas
// nunca dessincronizam do chaveamento, seja qual for a ronda escolhida
// para ser de Apresentação.
//
// IMPORTANTE: como os dois jogos que alimentam uma mesma dupla de
// Apresentação normalmente NÃO terminam ao mesmo tempo, esta função pode
// ser chamada primeiro só com teamAId preenchido (e teamBId ainda null),
// e mais tarde outra vez já com teamBId preenchido. Por isso a
// identidade de uma dupla é sempre o teamAId (que nunca muda depois de
// definido) — nunca comparamos teamAId+teamBId juntos, para não criar
// duplicados quando a segunda equipa só chega mais tarde.
export async function syncPresentationDuplasForRound(championship: string, round: number): Promise<void> {
  const phase = await prisma.phase.findFirst({ where: { championship, order: round } })
  if (!phase || (phase.type !== 'apresentacao' && phase.type !== 'apresentacao_quiz')) return

  const matches = await prisma.bracketMatch.findMany({
    where: { championship, round },
    orderBy: { slot: 'asc' }
  })
  const existingDuplas = await prisma.presentationDupla.findMany({ where: { phaseId: phase.id } })

  let order = existingDuplas.length + 1
  let changedAny = false
  for (const m of matches) {
    if (!m.teamAId) continue

    const existing = existingDuplas.find((d) => d.teamAId === m.teamAId)

    if (!existing) {
      await prisma.presentationDupla.create({
        data: {
          phaseId: phase.id,
          order: order++,
          themeA: '',
          themeB: m.teamBId ? '' : null,
          teamAId: m.teamAId,
          teamBId: m.teamBId ?? null
        }
      })
      changedAny = true
      continue
    }

    // A dupla já existe (foi criada quando só a equipa A tinha avançado).
    // Se agora a equipa B já está definida no confronto e a dupla ainda
    // não a tem, atualiza-a em vez de criar uma duplicada.
    if (m.teamBId && !existing.teamBId) {
      await prisma.presentationDupla.update({
        where: { id: existing.id },
        data: { teamBId: m.teamBId, themeB: existing.themeB ?? '' }
      })
      changedAny = true
    }
  }
  if (changedAny) emitConfigUpdated('presentation', championship)
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

router.post('/:championship/generate', requireAdmin, async (req, res) => {
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

  // Sincroniza duplas para todas as rondas já preenchidas neste momento
  // (normalmente só a Ronda 1, a não ser que resolveByesRecursively já
  // tenha avançado alguma equipa automaticamente por falta de adversário).
  for (let round = 1; round <= totalRounds; round++) {
    await syncPresentationDuplasForRound(championship, round)
  }

  emitConfigUpdated('bracket', championship)
  res.status(201).json({ success: true, totalRounds })
})

// NOVO — re-sincroniza as duplas de Apresentação de todas as fases já
// existentes, sem apagar/regerar o chaveamento. Útil sempre que se edita
// o "type" de uma fase (ex: mudar de "quiz" para "apresentacao_quiz")
// depois de o chaveamento já ter sido gerado — nesse caso as duplas dessa
// ronda nunca tinham sido criadas, porque syncPresentationDuplasForRound
// só corre automaticamente ao gerar o chaveamento e quando uma equipa
// avança de ronda.
router.post('/:championship/resync-presentation', requireAdmin, async (req, res) => {
  const { championship } = req.params
  const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  for (const phase of phases) {
    await syncPresentationDuplasForRound(championship, phase.order)
  }
  res.json({ success: true })
})

router.delete('/:championship', requireAdmin, async (req, res) => {
  const { championship } = req.params
  await prisma.bracketMatch.deleteMany({ where: { championship } })
  emitConfigUpdated('bracket', championship)
  res.status(204).send()
})

export default router
