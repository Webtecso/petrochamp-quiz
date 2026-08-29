import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (req, res) => {
  const { championship } = req.query as { championship?: string }
  const phases = await prisma.phase.findMany({
    where: championship ? { championship } : undefined,
    orderBy: { order: 'asc' }
  })
  res.json(phases)
})

router.post('/', async (req, res) => {
  const { championship, label, type, useQuestions, useJudges, maxQuestions, questionsPerTeam } = req.body
  if (!label || !championship) {
    res.status(400).json({ error: 'championship e label são obrigatórios' })
    return
  }
  const maxOrder = await prisma.phase.aggregate({
    where: { championship },
    _max: { order: true }
  })
  const phase = await prisma.phase.create({
    data: {
      championship,
      label,
      type: type ?? 'quiz',
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
  // CORRIGIDO - Phase.id é uma string (cuid), não um número. O
  // `Number(req.params.id)` convertia o cuid para NaN, o que o TypeScript
  // apanhou em tempo de build (Type 'number' is not assignable to type
  // 'string') e que também partiria em runtime (nunca encontraria a fase
  // certa). Basta usar o id tal como vem da URL.
  const id = req.params.id
  const { label, type, useQuestions, useJudges, order, maxQuestions, questionsPerTeam } = req.body
  try {
    const phase = await prisma.phase.update({
      where: { id },
      data: { label, type, useQuestions, useJudges, order, maxQuestions, questionsPerTeam }
    })
    res.json(phase)
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

router.delete('/:id', async (req, res) => {
  // CORRIGIDO - mesmo motivo do PUT acima: id é string (cuid).
  const id = req.params.id
  try {
    await prisma.phase.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

export default router
