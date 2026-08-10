import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const { championship, phase } = req.query as { championship?: string; phase?: string }
  const items = await prisma.evaluationItem.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined
    },
    orderBy: { createdAt: 'asc' }
  })
  res.json(items)
})

router.post('/', async (req, res) => {
  const { championship, type, text, maxPoints, phase, scope } = req.body
  if (!championship || !type || !text || !maxPoints || !phase) {
    return res.status(400).json({ error: 'championship, type, text, maxPoints e phase são obrigatórios' })
  }
  const item = await prisma.evaluationItem.create({
    data: { championship, type, text, maxPoints, phase, scope: scope || 'single' }
  })
  res.status(201).json(item)
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { type, text, maxPoints, phase, scope } = req.body
  try {
    const item = await prisma.evaluationItem.update({
      where: { id },
      data: { type, text, maxPoints, phase, scope }
    })
    res.json(item)
  } catch {
    res.status(404).json({ error: 'Item não encontrado' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.evaluationItem.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Item não encontrado' })
  }
})

export default router
