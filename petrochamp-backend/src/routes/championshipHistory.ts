import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const { championship } = req.query as { championship?: string }
  const entries = await prisma.championshipHistory.findMany({
    where: championship ? { championship } : undefined,
    orderBy: { endedAt: 'desc' }
  })
  res.json(entries)
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.championshipHistory.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Registo não encontrado' })
  }
})

export default router
