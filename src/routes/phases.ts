import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  const phases = await prisma.phase.findMany({ orderBy: { order: 'asc' } })
  res.json(phases)
})

router.post('/', async (req, res) => {
  const { label, useQuestions, useJudges, maxQuestions, questionsPerTeam } = req.body
  if (!label) {
    res.status(400).json({ error: 'label é obrigatório' })
    return
  }
  const maxOrder = await prisma.phase.aggregate({ _max: { order: true } })
  const phase = await prisma.phase.create({
    data: {
      label,
      useQuestions: useQuestions ?? true,
      useJudges: useJudges ?? false,
      maxQuestions: maxQuestions ?? null,
      questionsPerTeam: questionsPerTeam ?? null,
      order: (maxOrder._max.order ?? 0) + 1
    }
  })
  res.status(201).json(phase)
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { label, useQuestions, useJudges, order, maxQuestions, questionsPerTeam } = req.body
  try {
    const phase = await prisma.phase.update({
      where: { id },
      data: { label, useQuestions, useJudges, order, maxQuestions, questionsPerTeam }
    })
    res.json(phase)
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.phase.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

export default router
