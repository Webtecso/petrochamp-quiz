import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

router.get('/', async (_req, res) => {
  const partners = await prisma.partner.findMany({
    where: { deletedAt: null }, // NOVO
    orderBy: { order: 'asc' }
  })
  res.json(partners)
})

router.post('/', requireAdmin, async (req, res) => {
  const { name, logoUrl, order } = req.body
  if (!name || !logoUrl) {
    res.status(400).json({ error: 'name e logoUrl são obrigatórios' })
    return
  }
  const partner = await prisma.partner.create({ data: { name, logoUrl, order: order ?? 0 } })
  emitConfigUpdated('partners')
  res.status(201).json(partner)
})

router.put('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  const { name, logoUrl, order } = req.body
  try {
    const partner = await prisma.partner.update({ where: { id }, data: { name, logoUrl, order } })
    emitConfigUpdated('partners')
    res.json(partner)
  } catch {
    res.status(404).json({ error: 'Parceiro não encontrado' })
  }
})

// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.partner.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('partners')
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Parceiro não encontrado' })
  }
})

export default router
