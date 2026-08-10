import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  const partners = await prisma.partner.findMany({ orderBy: { order: 'asc' } })
  res.json(partners)
})

router.post('/', async (req, res) => {
  const { name, logoUrl, order } = req.body
  if (!name || !logoUrl) {
    res.status(400).json({ error: 'name e logoUrl são obrigatórios' })
    return
  }
  const partner = await prisma.partner.create({ data: { name, logoUrl, order: order ?? 0 } })
  res.status(201).json(partner)
})

router.put('/:id', async (req, res) => {
  const id = Number(req.params.id)
  const { name, logoUrl, order } = req.body
  try {
    const partner = await prisma.partner.update({ where: { id }, data: { name, logoUrl, order } })
    res.json(partner)
  } catch {
    res.status(404).json({ error: 'Parceiro não encontrado' })
  }
})

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.partner.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Parceiro não encontrado' })
  }
})

export default router
