import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

// PresentationDupla não tem relações Prisma definidas para Team/Phase (só
// teamAId/teamBId/phaseId como texto simples) — por isso, em vez de
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
        where: { phaseId, deletedAt: null }, // CORRIGIDO — filtra apagados
        orderBy: { order: 'asc' }
      })
    } else if (championship && championship !== 'undefined' && championship !== 'null') {
      const phases = await prisma.phase.findMany({ where: { championship }, select: { id: true } })
      const phaseIds = phases.map((p) => p.id)
      duplas = await prisma.presentationDupla.findMany({
        where: { phaseId: { in: phaseIds }, deletedAt: null }, // CORRIGIDO — filtra apagados
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
router.post('/duplas', requireAdmin, async (_req, res) => {
  return res.status(400).json({
    error: 'As duplas são geradas automaticamente a partir do Chaveamento (Admin → Chaveamento → Gerar). Não é possível criar manualmente.'
  })
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
// CORRIGIDO — antes usava prisma.presentationDupla.delete() (apagamento
// FÍSICO). O sistema de sincronização com o Cloud só consegue comunicar
// remoções através do campo deletedAt (soft delete) — um registo
// verdadeiramente apagado deixa de existir localmente, por isso nunca é
// "enviado" ao Cloud como apagado. No próximo ciclo de sync, o Cloud
// (que continua com o registo antigo, nunca avisado) via que o local já
// não o tem e recriava-o automaticamente — exatamente o bug "apaga e
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
      where: { phaseId, deletedAt: null }, // CORRIGIDO — filtra apagados
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
// CORRIGIDO — mesmo motivo do DELETE /duplas acima: apagamento físico
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
