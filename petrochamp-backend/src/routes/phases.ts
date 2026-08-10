import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

async function renumberPhases(championship: string): Promise<void> {
  const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  for (let i = 0; i < phases.length; i++) {
    const newOrder = i + 1
    const oldOrder = phases[i].order
    if (oldOrder === newOrder) continue

    await prisma.phase.update({ where: { id: phases[i].id }, data: { order: newOrder } })
    await prisma.question.updateMany({ where: { phase: oldOrder, championship }, data: { phase: newOrder } })
    await prisma.evaluationItem.updateMany({ where: { phase: oldOrder }, data: { phase: newOrder } })
    await prisma.tiebreakQuestion.updateMany({ where: { phase: oldOrder, championship }, data: { phase: newOrder } })
  }
}

router.get('/', async (req, res) => {
  const { championship } = req.query as { championship?: string }
  const phases = await prisma.phase.findMany({
    where: championship ? { championship } : undefined,
    orderBy: { order: 'asc' }
  })
  res.json(phases)
})

router.post('/', async (req, res) => {
  const {
    championship,
    label,
    type,
    useQuestions,
    useJudges,
    maxQuestions,
    questionsPerTeam,
    avoidRepeatQuestions,
    useInitialScores,
    initialScoreMaxPoints,
    presentationMinutes,
    presentationWeight,
    quizWeight
  } = req.body

  if (!label || !championship) {
    res.status(400).json({ error: 'label e championship são obrigatórios' })
    return
  }

  const maxOrder = await prisma.phase.aggregate({ where: { championship }, _max: { order: true } })

  const phase = await prisma.phase.create({
    data: {
      championship,
      label,
      type: type ?? 'quiz',
      useQuestions: useQuestions ?? true,
      useJudges: useJudges ?? false,
      maxQuestions: maxQuestions ?? null,
      questionsPerTeam: questionsPerTeam ?? null,
      avoidRepeatQuestions: avoidRepeatQuestions ?? true,
      useInitialScores: useInitialScores ?? false,
      initialScoreMaxPoints: initialScoreMaxPoints ?? null,
      presentationMinutes: presentationMinutes ?? null,
      presentationWeight: presentationWeight ?? 50,
      quizWeight: quizWeight ?? 50,
      order: (maxOrder._max.order ?? 0) + 1
    }
  })
  res.status(201).json(phase)
})

// NOVO: troca a ordem de duas fases de forma atómica, arrastando com elas
// todas as perguntas/itens já cadastrados (que só referenciam por número
// de ordem) — evita que trocar ▲▼ misture o conteúdo de fases diferentes.
router.post('/swap', async (req, res) => {
  const { firstId, secondId } = req.body as { firstId?: number; secondId?: number }
  if (!firstId || !secondId) {
    res.status(400).json({ error: 'firstId e secondId são obrigatórios' })
    return
  }

  const [first, second] = await Promise.all([
    prisma.phase.findUnique({ where: { id: firstId } }),
    prisma.phase.findUnique({ where: { id: secondId } })
  ])
  if (!first || !second || first.championship !== second.championship) {
    res.status(404).json({ error: 'Fases não encontradas ou de campeonatos diferentes' })
    return
  }

  const championship = first.championship
  const orderA = first.order
  const orderB = second.order  // Usa um número temporário para evitar colisão de índice único (order)  // durante a troca.
  const TEMP_ORDER = -1

  await prisma.phase.update({ where: { id: first.id }, data: { order: TEMP_ORDER } })
  await prisma.phase.update({ where: { id: second.id }, data: { order: orderA } })
  await prisma.phase.update({ where: { id: first.id }, data: { order: orderB } })

  await prisma.question.updateMany({ where: { phase: orderA, championship }, data: { phase: TEMP_ORDER } })
  await prisma.question.updateMany({ where: { phase: orderB, championship }, data: { phase: orderA } })
  await prisma.question.updateMany({ where: { phase: TEMP_ORDER, championship }, data: { phase: orderB } })

  await prisma.tiebreakQuestion.updateMany({ where: { phase: orderA, championship }, data: { phase: TEMP_ORDER } })
  await prisma.tiebreakQuestion.updateMany({ where: { phase: orderB, championship }, data: { phase: orderA } })
  await prisma.tiebreakQuestion.updateMany({ where: { phase: TEMP_ORDER, championship }, data: { phase: orderB } })

  await prisma.evaluationItem.updateMany({ where: { phase: orderA, championship }, data: { phase: TEMP_ORDER } })
  await prisma.evaluationItem.updateMany({ where: { phase: orderB, championship }, data: { phase: orderA } })
  await prisma.evaluationItem.updateMany({ where: { phase: TEMP_ORDER, championship }, data: { phase: orderB } })

  const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  res.json({ success: true, phases })
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const {
    label,
    type,
    useQuestions,
    useJudges,
    order,
    maxQuestions,
    questionsPerTeam,
    avoidRepeatQuestions,
    useInitialScores,
    initialScoreMaxPoints,
    presentationMinutes,
    presentationWeight,
    quizWeight
  } = req.body

  try {
    const phase = await prisma.phase.update({
      where: { id },
      data: {
        label,
        type,
        useQuestions,
        useJudges,
        order,
        maxQuestions,
        questionsPerTeam,
        avoidRepeatQuestions,
        useInitialScores,
        initialScoreMaxPoints,
        presentationMinutes,
        presentationWeight,
        quizWeight
      }
    })
    res.json(phase)
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    const existing = await prisma.phase.findUnique({ where: { id } })
    await prisma.phase.delete({ where: { id } })
    if (existing) await renumberPhases(existing.championship)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Fase não encontrada' })
  }
})

router.post('/repair-numbering', async (req, res) => {
  const { championship } = req.body as { championship?: string }
  if (!championship) {
    res.status(400).json({ error: 'championship é obrigatório' })
    return
  }
  await renumberPhases(championship)
  const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  res.json({ success: true, phases })
})

export default router
