import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const championship = req.query.championship as string | undefined
  const phase = req.query.phase ? Number(req.query.phase) : undefined
  const matches = await prisma.tiebreakMatch.findMany({
    where: { championship, phase },
    orderBy: { createdAt: 'asc' }
  })
  res.json(matches)
})

export default router
