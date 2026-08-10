import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  const phrases = await prisma.suspensePhrase.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(phrases)
})

router.post('/', async (req, res) => {
  const { text } = req.body
  if (!text) {
    res.status(400).json({ error: 'text é obrigatório' })
    return
  }
  const phrase = await prisma.suspensePhrase.create({ data: { text } })
  res.status(201).json(phrase)
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.suspensePhrase.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Frase não encontrada' })
  }
})

export default router
