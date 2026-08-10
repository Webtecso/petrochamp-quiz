import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

function toApiShape(q: any) {
  return {
    id: q.id,
    championship: q.championship,
    text: q.text,
    imageUrl: q.imageUrl ?? undefined,
    correctIndex: q.correctIndex,
    points: q.points,
    phase: q.phase,
    isTiebreaker: q.isTiebreaker ?? false,
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
  const questions = await prisma.question.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined
    },
    orderBy: { id: 'asc' }
  })
  res.json(questions.map(toApiShape))
})

router.post('/', async (req, res) => {
  const { championship, text, imageUrl, options, correctIndex, points, phase } = req.body

  if (!text || !championship || !Array.isArray(options) || options.length !== 4) {
    return res.status(400).json({ error: 'championship, text e options (4 itens) são obrigatórios' })
  }

  try {
    const question = await prisma.question.create({
      data: {
        championship,
        text,
        imageUrl: imageUrl || null,
        optionA: options[0]?.text ?? '',
        optionB: options[1]?.text ?? '',
        optionC: options[2]?.text ?? '',
        optionD: options[3]?.text ?? '',
        correctIndex: Number(correctIndex) || 0,
        points: Number(points) || 10,
        phase: Number(phase) || 1
      }
    })
    res.status(201).json(toApiShape(question))
  } catch (error: any) {
    console.error('Erro detalhado ao criar pergunta no Prisma:', error)
    res.status(500).json({ error: error.message || 'Erro interno ao criar pergunta' })
  }
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { text, imageUrl, options, correctIndex, points, phase } = req.body

  try {
    const question = await prisma.question.update({
      where: { id },
      data: {
        text,
        imageUrl: imageUrl || null,
        optionA: options[0]?.text ?? '',
        optionB: options[1]?.text ?? '',
        optionC: options[2]?.text ?? '',
        optionD: options[3]?.text ?? '',
        correctIndex: Number(correctIndex) || 0,
        points: Number(points) || 10,
        phase: Number(phase) || 1
      }
    })
    res.json(toApiShape(question))
  } catch (error: any) {
    console.error('Erro detalhado ao atualizar pergunta:', error)
    res.status(500).json({ error: error.message || 'Erro interno' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.question.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Pergunta não encontrada' })
  }
})

export default router
