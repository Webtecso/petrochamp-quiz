import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

function toApiShape(q: {
  id: number
  championship: string
  text: string
  imageUrl: string | null
  optionA: string
  optionB: string
  optionC: string
  optionD: string
  correctIndex: number
  points: number
  phase: number
}) {
  return {
    id: q.id,
    championship: q.championship,
    text: q.text,
    imageUrl: q.imageUrl ?? undefined,
    correctIndex: q.correctIndex,
    points: q.points,
    phase: q.phase,
    options: [
      { label: 'A', text: q.optionA },
      { label: 'B', text: q.optionB },
      { label: 'C', text: q.optionC },
      { label: 'D', text: q.optionD }
    ]
  }
}

router.get('/', async (req, res) => {
  const { championship, phase } = req.query as { championship?: string; phase?: string }
  const questions = await prisma.tiebreakQuestion.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined
    },
    orderBy: { id: 'asc' }
  })
  res.json(questions.map(toApiShape))
})

router.post('/', requireAdmin, async (req, res) => {
  const { championship, text, imageUrl, options, correctIndex, points, phase } = req.body
  if (!text || !championship || !Array.isArray(options) || options.length !== 4) {
    return res.status(400).json({ error: 'championship, text e options (4 itens) são obrigatórios' })
  }
  const question = await prisma.tiebreakQuestion.create({
    data: {
      championship,
      text,
      imageUrl: imageUrl || null,
      optionA: options[0]?.text ?? '',
      optionB: options[1]?.text ?? '',
      optionC: options[2]?.text ?? '',
      optionD: options[3]?.text ?? '',
      correctIndex,
      points,
      phase
    }
  })
  emitConfigUpdated('tiebreakQuestions', championship)
  res.status(201).json(toApiShape(question))
})

router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { text, imageUrl, options, correctIndex, points, phase } = req.body
  try {
    const question = await prisma.tiebreakQuestion.update({
      where: { id },
      data: {
        text,
        imageUrl: imageUrl || null,
        optionA: options[0]?.text ?? '',
        optionB: options[1]?.text ?? '',
        optionC: options[2]?.text ?? '',
        optionD: options[3]?.text ?? '',
        correctIndex,
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

router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    const existing = await prisma.tiebreakQuestion.delete({ where: { id } })
    emitConfigUpdated('tiebreakQuestions', existing.championship)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Pergunta não encontrada' })
  }
})

export default router
