import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const { championship, phase } = req.query
  const history = await prisma.matchHistory.findMany({
    where: {
      championship: championship ? String(championship) : undefined,
      phase: phase ? Number(phase) : undefined
    },
    orderBy: { endedAt: 'desc' }
  })
  res.json(history)
})

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const entry = await prisma.matchHistory.findUnique({ where: { id } })
  if (!entry) {
    res.status(404).json({ error: 'Registo não encontrado' })
    return
  }
  res.json(entry)
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.matchHistory.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Registo não encontrado' })
  }
})

export default router
