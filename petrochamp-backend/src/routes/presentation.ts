import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

router.get('/duplas', async (req, res) => {
  const { phaseId } = req.query as { phaseId?: string }
  if (!phaseId) {
    res.json([])
    return
  }
  const duplas = await prisma.presentationDupla.findMany({
    where: { phaseId: Number(phaseId) },
    orderBy: { order: 'asc' }
  })
  res.json(duplas)
})

// As duplas passam a ser geradas automaticamente a partir do Chaveamento
// (ver syncPresentationDuplasForRound em routes/bracketLive.ts). Criar à mão
// deixaria de bater certo com os confrontos reais do chaveamento, por isso
// esta rota já não permite criação manual — só devolve um erro explicativo.
router.post('/duplas', requireAdmin, async (_req, res) => {
  res.status(400).json({
    error: 'As duplas são geradas automaticamente a partir do Chaveamento (Admin → Chaveamento → Gerar). Não é possível criar manualmente.'
  })
})

router.patch('/duplas/:id/theme', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { team, theme } = req.body as { team?: 'A' | 'B'; theme?: string }
  if (!team || !theme) {
    res.status(400).json({ error: 'team e theme são obrigatórios' })
    return
  }
  try {
    const dupla = await prisma.presentationDupla.update({
      where: { id },
      data: team === 'A' ? { themeA: theme } : { themeB: theme }
    })
    emitConfigUpdated('presentation')
    res.json(dupla)
  } catch {
    res.status(404).json({ error: 'Dupla não encontrada' })
  }
})

router.delete('/duplas/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.presentationDupla.delete({ where: { id } })
    emitConfigUpdated('presentation')
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Dupla não encontrada' })
  }
})

router.get('/criteria', async (req, res) => {
  const { phaseId } = req.query as { phaseId?: string }
  if (!phaseId) {
    res.json([])
    return
  }
  const criteria = await prisma.presentationCriteria.findMany({
    where: { phaseId: Number(phaseId) },
    orderBy: { id: 'asc' }
  })
  res.json(criteria)
})

router.post('/criteria', requireAdmin, async (req, res) => {
  const { phaseId, label, maxPoints } = req.body
  if (!phaseId || !label || !maxPoints) {
    res.status(400).json({ error: 'phaseId, label e maxPoints são obrigatórios' })
    return
  }
  const criteria = await prisma.presentationCriteria.create({
    data: { phaseId, label, maxPoints: Number(maxPoints) }
  })
  emitConfigUpdated('presentation')
  res.status(201).json(criteria)
})

router.delete('/criteria/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.presentationCriteria.delete({ where: { id } })
    emitConfigUpdated('presentation')
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Critério não encontrado' })
  }
})

export default router
