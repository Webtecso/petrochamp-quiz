import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function toApiShape(q: any) {
  const options = LABELS
    .map((label, i) => ({ label, text: q[`option${label}`] as string | null }))
    .filter((o) => o.text !== null && o.text !== undefined)
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
    // mantém correctIndex singular para compatibilidade com quem ainda lê
    // só o primeiro índice correto (ex: correção de resposta única)
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
  const questions = await prisma.question.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined
    },
    orderBy: { id: 'asc' }
  })
  res.json(questions.map(toApiShape))
})

router.post('/', requireAdmin, async (req, res) => {
  const { championship, text, imageUrl, options, correctIndexes, correctIndex, points, phase } = req.body

  if (!text || !championship || !Array.isArray(options) || options.length < 2 || options.length > 8) {
    return res.status(400).json({ error: 'championship, text e entre 2 e 8 options são obrigatórios' })
  }

  const resolvedCorrectIndexes: number[] = Array.isArray(correctIndexes)
    ? correctIndexes
    : correctIndex !== undefined
      ? [Number(correctIndex)]
      : []

  try {
    const question = await prisma.question.create({
      data: {
        championship,
        text,
        imageUrl: imageUrl || null,
        ...buildOptionsData(options),
        correctIndexes: JSON.stringify(resolvedCorrectIndexes),
        points: Number(points) || 10,
        phase: Number(phase) || 1
      }
    })
    emitConfigUpdated('questions', championship)
    res.status(201).json(toApiShape(question))
  } catch (error: any) {
    console.error('Erro detalhado ao criar pergunta no Prisma:', error)
    res.status(500).json({ error: error.message || 'Erro interno ao criar pergunta' })
  }
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
    const question = await prisma.question.update({
      where: { id },
      data: {
        text,
        imageUrl: imageUrl || null,
        ...buildOptionsData(options),
        correctIndexes: JSON.stringify(resolvedCorrectIndexes),
        points: Number(points) || 10,
        phase: Number(phase) || 1
      }
    })
    emitConfigUpdated('questions', question.championship)
    res.json(toApiShape(question))
  } catch (error: any) {
    console.error('Erro detalhado ao atualizar pergunta:', error)
    res.status(500).json({ error: error.message || 'Erro interno' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const existing = await prisma.question.delete({ where: { id } })
    emitConfigUpdated('questions', existing.championship)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Pergunta não encontrada' })
  }
})

export default router
