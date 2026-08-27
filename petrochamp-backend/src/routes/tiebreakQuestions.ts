import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function toApiShape(q: any) {
  const options = LABELS.map((label) => ({
    label,
    text: q[`option${label}`] as string | null
  })).filter((o) => o.text !== null && o.text !== undefined)
  let correctIndexes: number[] = []
  try {
    correctIndexes = q.correctIndexes ? JSON.parse(q.correctIndexes) : []
  } catch {
    correctIndexes = []
  }
  return {
    id: q.id,
    championship: q.championship,
    text: q.text,
    imageUrl: q.imageUrl ?? undefined,
    correctIndexes,
    correctIndex: correctIndexes[0] ?? 0,
    points: q.points,
    phase: q.phase,
    options
  }
}

function buildOptionsData(options: { label: string; text: string }[]) {
  const data: Record<string, string | null> = {}
  for (const label of LABELS) {
    const found = options.find((o) => o.label === label)
    data[`option${label}`] = found ? found.text : null
  }
  return data
}

router.get('/', async (req, res) => {
  const { championship, phase } = req.query as { championship?: string; phase?: string }
  const questions = await prisma.tiebreakQuestion.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined,
      deletedAt: null // NOVO
    },
    orderBy: { id: 'asc' }
  })
  res.json(questions.map(toApiShape))
})

router.post('/', requireAdmin, async (req, res) => {
  const { championship, text, imageUrl, options, correctIndexes, correctIndex, points, phase } =
    req.body
  if (
    !text ||
    !championship ||
    !Array.isArray(options) ||
    options.length < 2 ||
    options.length > 8
  ) {
    return res
      .status(400)
      .json({ error: 'championship, text e entre 2 e 8 options são obrigatórios' })
  }

  const resolvedCorrectIndexes: number[] = Array.isArray(correctIndexes)
    ? correctIndexes
    : correctIndex !== undefined
      ? [Number(correctIndex)]
      : []

  const question = await prisma.tiebreakQuestion.create({
    data: {
      championship,
      text,
      imageUrl: imageUrl || null,
      ...buildOptionsData(options),
      correctIndexes: JSON.stringify(resolvedCorrectIndexes),
      points,
      phase
    }
  })
  emitConfigUpdated('tiebreakQuestions', championship)
  res.status(201).json(toApiShape(question))
})

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { text, imageUrl, options, correctIndexes, correctIndex, points, phase } = req.body

  if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
    return res.status(400).json({ error: 'options deve ter entre 2 e 8 itens' })
  }

  const resolvedCorrectIndexes: number[] = Array.isArray(correctIndexes)
    ? correctIndexes
    : correctIndex !== undefined
      ? [Number(correctIndex)]
      : []

  try {
    const question = await prisma.tiebreakQuestion.update({
      where: { id },
      data: {
        text,
        imageUrl: imageUrl || null,
        ...buildOptionsData(options),
        correctIndexes: JSON.stringify(resolvedCorrectIndexes),
        points,
        phase
      }
    })
    emitConfigUpdated('tiebreakQuestions', question.championship)
    res.json(toApiShape(question))
  } catch {
    res.status(404).json({ error: 'Pergunta não encontrada' })
  }
})

// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const existing = await prisma.tiebreakQuestion.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
    emitConfigUpdated('tiebreakQuestions', existing.championship)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Pergunta não encontrada' })
  }
})

export default router
