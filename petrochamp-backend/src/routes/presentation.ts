import { Router } from 'express'
import { prisma } from '../db'

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

router.post('/duplas', async (req, res) => {
  const { phaseId, themeA, themeB, teamAId, teamBId } = req.body
  if (!phaseId || !themeA || !teamAId) {
    res.status(400).json({ error: 'phaseId, themeA e teamAId são obrigatórios' })
    return
  }
  const maxOrder = await prisma.presentationDupla.aggregate({
    where: { phaseId },
    _max: { order: true }
  })
  const dupla = await prisma.presentationDupla.create({
    data: {
      phaseId,
      themeA,
      themeB: teamBId ? (themeB || null) : null,
      teamAId,
      teamBId: teamBId || null,
      order: (maxOrder._max.order ?? 0) + 1
    }
  })
  res.status(201).json(dupla)
})

router.patch('/duplas/:id/theme', async (req, res) => {
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
    res.json(dupla)
  } catch {
    res.status(404).json({ error: 'Dupla não encontrada' })
  }
})

router.delete('/duplas/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.presentationDupla.delete({ where: { id } })
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

router.post('/criteria', async (req, res) => {
  const { phaseId, label, maxPoints } = req.body
  if (!phaseId || !label || !maxPoints) {
    res.status(400).json({ error: 'phaseId, label e maxPoints são obrigatórios' })
    return
  }
  const criteria = await prisma.presentationCriteria.create({
    data: { phaseId, label, maxPoints: Number(maxPoints) }
  })
  res.status(201).json(criteria)
})

router.delete('/criteria/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.presentationCriteria.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Critério não encontrado' })
  }
})

export default router
