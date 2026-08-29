import { Router } from 'express'
import { prisma } from '../db'

export const evaluationCriteriaRouter = Router()

// GET /api/evaluation-criteria?itemId=xxx
evaluationCriteriaRouter.get('/', async (req, res) => {
  const itemId = req.query.itemId as string | undefined
  if (!itemId) {
    res.json([])
    return
  }
  const criteria = await prisma.evaluationCriteria.findMany({
    where: { itemId, deletedAt: null }, // NOVO
    orderBy: { order: 'asc' }
  })
  res.json(criteria)
})

evaluationCriteriaRouter.post('/', async (req, res) => {
  const { itemId, label, maxPoints } = req.body as {
    itemId?: string
    label?: string
    maxPoints?: number
  }
  if (!itemId || !label || !label.trim()) {
    res.status(400).json({ error: 'itemId e label são obrigatórios.' })
    return
  }
  const count = await prisma.evaluationCriteria.count({ where: { itemId, deletedAt: null } })
  const created = await prisma.evaluationCriteria.create({
    data: { itemId, label: label.trim(), maxPoints: Number(maxPoints) || 10, order: count }
  })
  res.json(created)
})

evaluationCriteriaRouter.put('/:id', async (req, res) => {
  const { label, maxPoints } = req.body as { label?: string; maxPoints?: number }
  const updated = await prisma.evaluationCriteria.update({
    where: { id: req.params.id },
    data: {
      ...(label !== undefined ? { label } : {}),
      ...(maxPoints !== undefined ? { maxPoints: Number(maxPoints) } : {})
    }
  })
  res.json(updated)
})

// CORRIGIDO - soft delete (ver nota em questions.ts)
evaluationCriteriaRouter.delete('/:id', async (req, res) => {
  await prisma.evaluationCriteria.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() }
  })
  res.json({ success: true })
})
