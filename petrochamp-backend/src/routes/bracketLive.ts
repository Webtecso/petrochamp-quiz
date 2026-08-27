import { Router } from 'express'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

// evita que duas chamadas a /generate corram em paralelo para a
// mesma categoria (ex: duplo clique, ou um pedido novo disparado antes do
// anterior terminar). Sem isto, o deleteMany de um pedido podia correr
// entre o deleteMany e o createMany de outro, e os dois createMany
// acabavam por inserir os mesmos confrontos duas vezes (ou mais, se
// houvesse mais pedidos concorrentes) — foi isto que causou os
// chaveamentos duplicados infinitamente.
const generatingChampionships = new Set<string>()

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
  const existing = await prisma.phase.findMany({
    where: { championship, deletedAt: null },
    orderBy: { order: 'asc' }
  })
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
    const matches = await prisma.bracketMatch.findMany({
      where: { championship, round, winnerId: null }
    })
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

// Cria/atualiza as PresentationDuplas de uma ronda específica — ver
// comentário histórico original sobre o Map local anti-duplicação.
export async function syncPresentationDuplasForRound(
  championship: string,
  round: number
): Promise<void> {
  const phase = await prisma.phase.findFirst({
    where: { championship, order: round, deletedAt: null }
  })
  if (!phase || (phase.type !== 'apresentacao' && phase.type !== 'apresentacao_quiz')) return

  const matches = await prisma.bracketMatch.findMany({
    where: { championship, round },
    orderBy: { slot: 'asc' }
  })
  const existingDuplas = await prisma.presentationDupla.findMany({
    where: { phaseId: phase.id, deletedAt: null } // NOVO
  })

  const byTeamA = new Map(existingDuplas.map((d) => [d.teamAId, d]))

  let order = existingDuplas.length + 1
  let changedAny = false

  for (const m of matches) {
    if (!m.teamAId) continue

    const existing = byTeamA.get(m.teamAId)

    if (!existing) {
      const created = await prisma.presentationDupla.upsert({
        where: { phaseId_teamAId: { phaseId: phase.id, teamAId: m.teamAId } },
        create: {
          phaseId: phase.id,
          order: order++,
          themeA: '',
          themeB: m.teamBId ? '' : null,
          teamAId: m.teamAId,
          teamBId: m.teamBId ?? null
        },
        update: { deletedAt: null }
      })
      byTeamA.set(m.teamAId, created)
      changedAny = true
      continue
    }

    if (m.teamBId && !existing.teamBId) {
      const updated = await prisma.presentationDupla.update({
        where: { id: existing.id },
        data: { teamBId: m.teamBId, themeB: existing.themeB ?? '' }
      })
      byTeamA.set(m.teamAId, updated)
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
      ? {
          id: m.teamAId,
          name: teamMap.get(m.teamAId)?.name ?? '?',
          logoUrl: teamMap.get(m.teamAId)?.logoUrl ?? null
        }
      : null,
    teamB: m.teamBId
      ? {
          id: m.teamBId,
          name: teamMap.get(m.teamBId)?.name ?? '?',
          logoUrl: teamMap.get(m.teamBId)?.logoUrl ?? null
        }
      : null,
    winnerId: m.winnerId
  }))

  res.json({ championship, matches: shaped })
})

// NOTA — /generate continua a apagar bracketMatch e presentationDupla com
// deleteMany/hard-delete dentro da transação: o chaveamento é sempre
// recriado do zero a partir das equipas atuais, é dado derivado e não uma
// entidade que o utilizador apaga manualmente através de um botão
// "remover" — não precisa de soft delete nem de propagar como "apagado"
// via sync.
router.post('/:championship/generate', requireAdmin, async (req, res) => {
  const { championship } = req.params

  if (generatingChampionships.has(championship)) {
    res.status(409).json({
      error: 'Já existe uma geração de chaveamento em curso para esta categoria. Aguarde terminar.'
    })
    return
  }
  generatingChampionships.add(championship)

  try {
    const teams = await prisma.team.findMany({
      where: { category: championship, deletedAt: null }, // NOVO
      orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
    })

    if (teams.length < 2) {
      res.status(400).json({ error: 'É preciso pelo menos 2 equipas cadastradas nesta categoria.' })
      return
    }

    const slotsNeeded = nextPowerOfTwo(teams.length)
    const round1Count = slotsNeeded / 2
    const totalRounds = Math.log2(slotsNeeded)

    const created: {
      round: number
      slot: number
      teamAId?: string | null
      teamBId?: string | null
      groupName?: string
    }[] = []

    for (let slot = 0; slot < round1Count; slot++) {
      const teamA = teams[slot * 2]
      const teamB = teams[slot * 2 + 1]
      created.push({
        round: 1,
        slot,
        teamAId: teamA?.id ?? null,
        teamBId: teamB?.id ?? null,
        groupName: teamA?.group ?? undefined
      })
    }

    for (let round = 2; round <= totalRounds; round++) {
      const count = slotsNeeded / Math.pow(2, round)
      for (let slot = 0; slot < count; slot++) {
        created.push({ round, slot })
      }
    }

    const phaseIds = (
      await prisma.phase.findMany({
        where: { championship, deletedAt: null },
        select: { id: true }
      })
    ).map((p) => p.id)

    await prisma.$transaction([
      ...(phaseIds.length
        ? [prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } })]
        : []),
      prisma.bracketMatch.deleteMany({ where: { championship } }),
      prisma.bracketMatch.createMany({
        data: created.map((c) => ({
          championship,
          round: c.round,
          slot: c.slot,
          teamAId: c.teamAId ?? null,
          teamBId: c.teamBId ?? null,
          groupName: c.groupName ?? null
        }))
      })
    ])

    await resolveByesRecursively(championship, totalRounds)
    await ensurePhasesForRounds(championship, totalRounds)

    for (let round = 1; round <= totalRounds; round++) {
      await syncPresentationDuplasForRound(championship, round)
    }

    emitConfigUpdated('bracket', championship)
    res.status(201).json({ success: true, totalRounds })
  } finally {
    generatingChampionships.delete(championship)
  }
})

router.post('/:championship/resync-presentation', requireAdmin, async (req, res) => {
  const { championship } = req.params
  const phases = await prisma.phase.findMany({
    where: { championship, deletedAt: null },
    orderBy: { order: 'asc' }
  })
  for (const phase of phases) {
    await syncPresentationDuplasForRound(championship, phase.order)
  }
  res.json({ success: true })
})

router.delete('/:championship', requireAdmin, async (req, res) => {
  const { championship } = req.params
  const phaseIds = (
    await prisma.phase.findMany({
      where: { championship, deletedAt: null },
      select: { id: true }
    })
  ).map((p) => p.id)
  await prisma.$transaction([
    ...(phaseIds.length
      ? [prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } })]
      : []),
    prisma.bracketMatch.deleteMany({ where: { championship } })
  ])
  emitConfigUpdated('bracket', championship)
  res.status(204).send()
})

export default router
