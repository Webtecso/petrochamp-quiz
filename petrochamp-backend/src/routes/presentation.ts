import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

// PresentationDupla não tem relações Prisma definidas para Team/Phase (só
// teamAId/teamBId/phaseId como texto simples) - por isso, em vez de
// include, buscamos as equipas à parte e juntamos manualmente.
async function attachTeams(duplas: Array<{ teamAId: string; teamBId: string | null }>) {
  const teamIds = new Set<string>()
  for (const d of duplas) {
    teamIds.add(d.teamAId)
    if (d.teamBId) teamIds.add(d.teamBId)
  }
  const teams = await prisma.team.findMany({ where: { id: { in: Array.from(teamIds) } } })
  const teamMap = new Map(teams.map((t) => [t.id, t]))
  return duplas.map((d) => ({
    ...d,
    teamA: teamMap.get(d.teamAId) ?? null,
    teamB: d.teamBId ? teamMap.get(d.teamBId) ?? null : null
  }))
}

// GET /api/presentation/duplas?phaseId=...&championship=...
router.get('/duplas', async (req, res) => {
  try {
    const { phaseId, championship } = req.query as { phaseId?: string; championship?: string }

    let duplas: Array<{ id: string; phaseId: string; order: number; themeA: string; themeB: string | null; teamAId: string; teamBId: string | null }> = []

    if (phaseId && phaseId !== 'undefined' && phaseId !== 'null') {
      duplas = await prisma.presentationDupla.findMany({
        where: { phaseId, deletedAt: null }, // CORRIGIDO - filtra apagados
        orderBy: { order: 'asc' }
      })
    } else if (championship && championship !== 'undefined' && championship !== 'null') {
      const phases = await prisma.phase.findMany({ where: { championship }, select: { id: true } })
      const phaseIds = phases.map((p) => p.id)
      duplas = await prisma.presentationDupla.findMany({
        where: { phaseId: { in: phaseIds }, deletedAt: null }, // CORRIGIDO - filtra apagados
        orderBy: { order: 'asc' }
      })
    }

    const shaped = await attachTeams(duplas)
    return res.json(shaped)
  } catch (error: any) {
    console.error('[Presentation Duplas GET Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao carregar as duplas.' })
  }
})

// POST /api/presentation/duplas
// ALTERADO - permite criação manual só em fases "apresentacao" com
// noElimination: true. Nas restantes fases (ligadas a chaveamento), as
// duplas continuam a vir exclusivamente de syncPresentationDuplasForRound()
// em bracketLive.ts - este endpoint bloqueia esse caso com 400.
//
// CORRIGIDO - usava prisma.presentationDupla.create(), que falha com
// P2002 (unique constraint) sempre que já existir uma linha
// soft-deleted com o mesmo (phaseId, teamAId) - o @@unique do schema
// não distingue linhas "apagadas" (deletedAt preenchido) de ativas,
// por isso o create() batia contra esse registo antigo. A mesma
// situação já era tratada em syncPresentationDuplasForRound()
// (bracketLive.ts) com upsert + update: { deletedAt: null } - aplicado
// aqui também, para reativar/atualizar uma dupla apagada em vez de
// rebentar com erro 500.
//
// Também valida que as equipas escolhidas pertencem à mesma categoria
// (Team.category) do campeonato da fase - mantém o comportamento manual
// consistente com o automático, que já filtra por category no
// bracketLive.ts generate.
router.post('/duplas', requireAdmin, async (req, res) => {
  try {
    const { phaseId, teamAId, teamBId, themeA, themeB } = req.body as {
      phaseId?: string
      teamAId?: string
      teamBId?: string | null
      themeA?: string
      themeB?: string | null
    }

    if (!phaseId || !teamAId) {
      return res.status(400).json({ error: 'phaseId e teamAId são obrigatórios.' })
    }

    const phase = await prisma.phase.findUnique({ where: { id: phaseId } })
    if (!phase || phase.deletedAt) {
      return res.status(404).json({ error: 'Fase não encontrada.' })
    }
    if (phase.type !== 'apresentacao' || !phase.noElimination) {
      return res.status(400).json({
        error:
          'As duplas só podem ser criadas manualmente em fases do tipo Apresentação sem eliminação. Nas restantes fases, as duplas são geradas automaticamente a partir do Chaveamento (Admin → Chaveamento → Gerar).'
      })
    }
    if (teamBId && teamBId === teamAId) {
      return res.status(400).json({ error: 'As duas equipas da dupla têm de ser diferentes.' })
    }

    const teamIdsToCheck = [teamAId, ...(teamBId ? [teamBId] : [])]
    const teams = await prisma.team.findMany({ where: { id: { in: teamIdsToCheck }, deletedAt: null } })
    if (teams.length !== teamIdsToCheck.length) {
      return res.status(404).json({ error: 'Uma das equipas selecionadas não foi encontrada.' })
    }
    const wrongCategory = teams.find((t) => t.category !== phase.championship)
    if (wrongCategory) {
      return res.status(400).json({
        error: `A equipa "${wrongCategory.name}" pertence a outra categoria e não pode ser usada nesta fase (${phase.championship}).`
      })
    }

    // Verifica se já existe uma dupla ATIVA (não apagada) com esta
    // Equipa A nesta fase - só aí bloqueamos com 409. Uma dupla
    // soft-deleted com o mesmo par não conta como "já existe" para o
    // utilizador, mas ainda ocupa a linha na base de dados - por isso
    // é tratada no upsert abaixo, não aqui.
    const existingActive = await prisma.presentationDupla.findFirst({
      where: { phaseId, teamAId, deletedAt: null }
    })
    if (existingActive) {
      return res.status(409).json({ error: 'Esta equipa já está numa dupla desta fase (como Equipa A).' })
    }

    const maxOrder = await prisma.presentationDupla.aggregate({
      where: { phaseId, deletedAt: null },
      _max: { order: true }
    })
    const nextOrder = (maxOrder._max.order ?? 0) + 1

    const dupla = await prisma.presentationDupla.upsert({
      where: { phaseId_teamAId: { phaseId, teamAId } },
      create: {
        phaseId,
        order: nextOrder,
        themeA: themeA?.trim() ?? '',
        themeB: teamBId ? (themeB?.trim() ?? '') : null,
        teamAId,
        teamBId: teamBId ?? null
      },
      update: {
        order: nextOrder,
        themeA: themeA?.trim() ?? '',
        themeB: teamBId ? (themeB?.trim() ?? '') : null,
        teamBId: teamBId ?? null,
        deletedAt: null
      }
    })

    const [shaped] = await attachTeams([dupla])
    emitConfigUpdated('presentation')
    return res.status(201).json(shaped)
  } catch (error: any) {
    console.error('[Presentation Duplas POST Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao criar a dupla.' })
  }
})

// PATCH /api/presentation/duplas/:id/theme
router.patch('/duplas/:id/theme', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { team, theme } = req.body as { team?: 'A' | 'B'; theme?: string }

  if (!team || !theme || !['A', 'B'].includes(team)) {
    return res.status(400).json({ error: 'team ("A" ou "B") e theme são obrigatórios.' })
  }

  try {
    const dataUpdate = team === 'A' ? { themeA: theme } : { themeB: theme }
    const dupla = await prisma.presentationDupla.update({ where: { id }, data: dataUpdate })
    const [shaped] = await attachTeams([dupla])
    emitConfigUpdated('presentation')
    return res.json(shaped)
  } catch (error) {
    return res.status(404).json({ error: 'Dupla não encontrada.' })
  }
})

// DELETE /api/presentation/duplas/:id
// CORRIGIDO - antes usava prisma.presentationDupla.delete() (apagamento
// FÍSICO). O sistema de sincronização com o Cloud só consegue comunicar
// remoções através do campo deletedAt (soft delete) - um registo
// verdadeiramente apagado deixa de existir localmente, por isso nunca é
// "enviado" ao Cloud como apagado. No próximo ciclo de sync, o Cloud
// (que continua com o registo antigo, nunca avisado) via que o local já
// não o tem e recriava-o automaticamente - exatamente o bug "apaga e
// depois volta a aparecer".
router.delete('/duplas/:id', requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    await prisma.presentationDupla.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('presentation')
    return res.status(204).send()
  } catch (error) {
    return res.status(404).json({ error: 'Dupla não encontrada.' })
  }
})

// GET /api/presentation/criteria?phaseId=...
router.get('/criteria', async (req, res) => {
  try {
    const { phaseId } = req.query as { phaseId?: string }
    if (!phaseId) return res.json([])

    const criteria = await prisma.presentationCriteria.findMany({
      where: { phaseId, deletedAt: null }, // CORRIGIDO - filtra apagados
      orderBy: { id: 'asc' }
    })
    return res.json(criteria)
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao carregar os critérios.' })
  }
})

// POST /api/presentation/criteria
router.post('/criteria', requireAdmin, async (req, res) => {
  try {
    const { phaseId, label, maxPoints } = req.body

    if (!phaseId || !label || maxPoints === undefined || maxPoints === null) {
      return res.status(400).json({ error: 'phaseId, label e maxPoints são obrigatórios.' })
    }

    const points = Number(maxPoints)
    if (isNaN(points) || points <= 0) {
      return res.status(400).json({ error: 'maxPoints deve ser um número válido e maior que zero.' })
    }

    const criteria = await prisma.presentationCriteria.create({
      data: { phaseId, label, maxPoints: points }
    })

    emitConfigUpdated('presentation')
    return res.status(201).json(criteria)
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Erro ao criar o critério.' })
  }
})

// DELETE /api/presentation/criteria/:id
// CORRIGIDO - mesmo motivo do DELETE /duplas acima: apagamento físico
// impedia o sync de comunicar a remoção ao Cloud, fazendo o critério
// reaparecer no próximo ciclo de sincronização.
router.delete('/criteria/:id', requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    await prisma.presentationCriteria.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('presentation')
    return res.status(204).send()
  } catch (error) {
    return res.status(404).json({ error: 'Critério não encontrado.' })
  }
})

export default router
