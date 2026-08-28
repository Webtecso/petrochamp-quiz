import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function getClientIp(req: import('express').Request): string {
  const cf = req.headers['cf-connecting-ip']
  if (typeof cf === 'string') return cf
  const xff = req.headers['x-forwarded-for']
  if (typeof xff === 'string') return xff.split(',')[0].trim()
  return req.ip ?? 'unknown'
}

export async function getEligibleTeams(championship: string, phase: number) {
  const matches = await prisma.matchHistory.findMany({ where: { championship, phase } })
  const loserIds = new Set<string>()
  const winnerIds = new Set<string>()
  for (const m of matches) {
    if (!m.winnerId) continue
    winnerIds.add(m.winnerId)
    const loserId = m.winnerId === m.teamAId ? m.teamBId : m.teamAId
    loserIds.add(loserId)
  }
  for (const w of winnerIds) loserIds.delete(w)
  return prisma.team.findMany({ where: { id: { in: Array.from(loserIds) }, deletedAt: null } })
}

// NOVO — Admin: listar configurações de um campeonato
router.get('/configs', async (req, res) => {
  const { championship } = req.query as { championship?: string }
  const configs = await prisma.repescagemConfig.findMany({
    where: {
      championship: championship || undefined,
      deletedAt: null // NOVO
    },
    orderBy: { createdAt: 'desc' }
  })
  res.json(configs)
})

// NOVO — Admin: criar configuração (não abre votação, só prepara)
router.post('/config', async (req, res) => {
  const { championship, phase, maxRepescados, votingDurationSeconds } = req.body
  if (!championship || !phase || !maxRepescados) {
    res.status(400).json({ error: 'championship, phase e maxRepescados são obrigatórios' })
    return
  }
  const config = await prisma.repescagemConfig.create({
    data: {
      championship,
      phase,
      maxRepescados,
      votingDurationSeconds: votingDurationSeconds || 60,
      votingOpen: false,
      started: false
    }
  })
  res.status(201).json(config)
})

// NOVO — Admin: editar configuração (só antes de ser iniciada pelo Moderador)
// CORRIGIDO — id é cuid() (string) no schema, não Int.
router.put('/config/:id', async (req, res) => {
  const id = req.params.id
  const { maxRepescados, votingDurationSeconds } = req.body
  const existing = await prisma.repescagemConfig.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: 'Configuração não encontrada' })
    return
  }
  if (existing.started) {
    res
      .status(400)
      .json({ error: 'Esta repescagem já foi iniciada pelo Moderador e não pode ser editada.' })
    return
  }
  const config = await prisma.repescagemConfig.update({
    where: { id },
    data: { maxRepescados, votingDurationSeconds }
  })
  res.json(config)
})

// NOVO — Admin: apagar configuração não usada
// CORRIGIDO — soft delete (ver nota em questions.ts) + id como string
router.delete('/config/:id', async (req, res) => {
  const id = req.params.id
  const existing = await prisma.repescagemConfig.findUnique({ where: { id } })
  if (!existing || existing.deletedAt) {
    res.status(404).json({ error: 'Configuração não encontrada' })
    return
  }
  if (existing.started) {
    res.status(400).json({ error: 'Esta repescagem já foi iniciada e não pode ser apagada.' })
    return
  }
  await prisma.repescagemConfig.update({ where: { id }, data: { deletedAt: new Date() } })
  res.status(204).send()
})

// NOVO — usado pelo backend/Moderador: existe uma configuração por iniciar
// para esta fase deste campeonato?
router.get('/for-phase', async (req, res) => {
  const { championship, phase } = req.query as { championship?: string; phase?: string }
  if (!championship || !phase) {
    res.json(null)
    return
  }
  const config = await prisma.repescagemConfig.findFirst({
    where: { championship, phase: Number(phase), deletedAt: null }, // NOVO
    orderBy: { createdAt: 'desc' }
  })
  res.json(config)
})

// Portal público + Moderador: repescagem atualmente EM VOTAÇÃO (só as já iniciadas)
router.get('/active', async (_req, res) => {
  const config = await prisma.repescagemConfig.findFirst({
    where: { started: true, deletedAt: null }, // NOVO
    orderBy: { startedAt: 'desc' }
  })
  if (!config) {
    res.json(null)
    return
  }
  const eligibleTeams = await getEligibleTeams(config.championship, config.phase)
  const votes = await prisma.repescagemVote.findMany({ where: { configId: config.id } })
  const tally = eligibleTeams
    .map((t) => ({
      teamId: t.id,
      name: t.name,
      institution: t.institution,
      logoUrl: t.logoUrl,
      votes: votes.filter((v) => v.teamId === t.id).length
    }))
    .sort((a, b) => b.votes - a.votes)
  res.json({ config, tally })
})

router.get('/has-voted', async (req, res) => {
  const { configId, voterToken } = req.query as { configId?: string; voterToken?: string }
  if (!configId || !voterToken) {
    res.json({ voted: false })
    return
  }
  // CORRIGIDO — configId é cuid() (string), sem Number(...)
  const existing = await prisma.repescagemVote.findUnique({
    where: { configId_voterToken: { configId, voterToken } }
  })
  res.json({ voted: !!existing })
})

router.post('/vote', async (req, res) => {
  const { configId, teamId, voterToken } = req.body
  if (!voterToken) {
    res.status(400).json({ error: 'Identificador de dispositivo em falta.' })
    return
  }
  const config = await prisma.repescagemConfig.findUnique({ where: { id: configId } })
  if (!config || config.deletedAt || !config.votingOpen) {
    res.status(400).json({ error: 'Votação não está aberta' })
    return
  }
  try {
    await prisma.repescagemVote.create({
      data: { configId, teamId, voterToken, voterIp: getClientIp(req) }
    })
    res.status(201).json({ success: true })
  } catch (err: any) {
    if (err.code === 'P2002') {
      res.status(409).json({ error: 'Já votaste nesta votação.' })
      return
    }
    console.error(err)
    res.status(500).json({ error: 'Falha ao registar o voto.' })
  }
})

router.post('/:id/generate-bracket', async (req, res) => {
  const id = req.params.id
  const config = await prisma.repescagemConfig.findUnique({ where: { id } })
  if (!config) {
    res.status(404).json({ error: 'Configuração não encontrada' })
    return
  }
  const eligibleTeams = await getEligibleTeams(config.championship, config.phase)
  const votes = await prisma.repescagemVote.findMany({ where: { configId: id } })
  const ranked = eligibleTeams
    .map((t) => ({ team: t, votes: votes.filter((v) => v.teamId === t.id).length }))
    .sort((a, b) => b.votes - a.votes)

  let selected = ranked.slice(0, config.maxRepescados).map((r) => r.team)

  const syntheticChampionship = `${config.championship}__repescagem__fase${config.phase}`
  // Reset de um chaveamento sintético derivado, sempre recalculado do
  // zero — intencionalmente hard-delete/deleteMany, não é uma entidade
  // que o utilizador "apaga" manualmente através de um botão.
  await prisma.bracketMatch.deleteMany({ where: { championship: syntheticChampionship } })

  if (selected.length % 2 !== 0 && selected.length > 1) {
    const decider = selected.slice(-2)
    selected = selected.slice(0, -2)
    await prisma.bracketMatch.create({
      data: {
        championship: syntheticChampionship,
        round: 0,
        slot: 0,
        groupName: 'Decisão de Vaga',
        teamAId: decider[0]?.id,
        teamBId: decider[1]?.id ?? null
      }
    })
  }

  const slotsNeeded = nextPowerOfTwo(Math.max(selected.length, 2))
  const round1Count = slotsNeeded / 2
  const created: { round: number; slot: number; teamAId?: string; teamBId?: string }[] = []

  for (let slot = 0; slot < round1Count; slot++) {
    const teamA = selected[slot * 2]
    const teamB = selected[slot * 2 + 1]
    created.push({ round: 1, slot, teamAId: teamA?.id, teamBId: teamB?.id })
  }

  const totalRounds = Math.log2(slotsNeeded)
  for (let round = 2; round <= totalRounds; round++) {
    const count = slotsNeeded / Math.pow(2, round)
    for (let slot = 0; slot < count; slot++) {
      created.push({ round, slot })
    }
  }

  await prisma.bracketMatch.createMany({
    data: created.map((c) => ({
      championship: syntheticChampionship,
      round: c.round,
      slot: c.slot,
      groupName: 'Repescagem',
      teamAId: c.teamAId ?? null,
      teamBId: c.teamBId ?? null
    }))
  })

  res.status(201).json({ syntheticChampionship })
})

router.get('/:id/bracket', async (req, res) => {
  const id = req.params.id
  const config = await prisma.repescagemConfig.findUnique({ where: { id } })
  if (!config) {
    res.status(404).json({ error: 'Configuração não encontrada' })
    return
  }
  const syntheticChampionship = `${config.championship}__repescagem__fase${config.phase}`
  const matches = await prisma.bracketMatch.findMany({
    where: { championship: syntheticChampionship },
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
  res.json({ championship: syntheticChampionship, matches: shaped })
})

router.post('/:id/insert-champion', async (req, res) => {
  const id = req.params.id
  const { targetMatchId } = req.body as { targetMatchId?: string }
  const config = await prisma.repescagemConfig.findUnique({ where: { id } })
  if (!config) {
    res.status(404).json({ error: 'Configuração não encontrada' })
    return
  }
  const syntheticChampionship = `${config.championship}__repescagem__fase${config.phase}`
  const finalMatch = await prisma.bracketMatch.findFirst({
    where: { championship: syntheticChampionship },
    orderBy: { round: 'desc' }
  })
  if (!finalMatch?.winnerId) {
    res.status(400).json({ error: 'O grupo de repescagem ainda não tem uma campeã definida.' })
    return
  }
  const championId = finalMatch.winnerId

  if (targetMatchId) {
    const target = await prisma.bracketMatch.findUnique({ where: { id: targetMatchId } })
    if (!target) {
      res.status(404).json({ error: 'Confronto de destino não encontrado.' })
      return
    }
    await prisma.bracketMatch.update({
      where: { id: targetMatchId },
      data: target.teamAId ? { teamBId: championId } : { teamAId: championId }
    })
    res.json({ success: true, championId, matchId: targetMatchId })
    return
  }

  const nextRound = config.phase + 1
  const openSlotMatch = await prisma.bracketMatch.findFirst({
    where: {
      championship: config.championship,
      round: nextRound,
      OR: [
        { teamAId: { not: null }, teamBId: null },
        { teamAId: null, teamBId: { not: null } }
      ]
    },
    orderBy: { slot: 'asc' }
  })

  if (!openSlotMatch) {
    res.status(400).json({
      error:
        'Não encontrei nenhum confronto da próxima ronda com uma equipa apurada à espera de adversário. Indica manualmente o confronto de destino (targetMatchId).'
    })
    return
  }

  await prisma.bracketMatch.update({
    where: { id: openSlotMatch.id },
    data: openSlotMatch.teamAId ? { teamBId: championId } : { teamAId: championId }
  })

  res.json({ success: true, championId, matchId: openSlotMatch.id })
})

export default router
