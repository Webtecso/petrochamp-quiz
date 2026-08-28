import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const { championship } = req.query as { championship?: string }
  const entries = await prisma.championshipHistory.findMany({
    where: {
      championship: championship || undefined,
      deletedAt: null // NOVO
    },
    orderBy: { endedAt: 'desc' }
  })
  res.json(entries)
})

// CORRIGIDO — soft delete (ver nota em questions.ts) + id como string
router.delete('/:id', async (req, res) => {
  const id = req.params.id
  try {
    await prisma.championshipHistory.update({ where: { id }, data: { deletedAt: new Date() } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Registo não encontrado' })
  }
})

export default router
