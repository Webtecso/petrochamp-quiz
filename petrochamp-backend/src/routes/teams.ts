import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

router.get('/', async (_req, res) => {
  const teams = await prisma.team.findMany({
    where: { deletedAt: null }, // NOVO
    orderBy: { createdAt: 'asc' }
  })
  res.json(teams)
})

router.post('/', requireAdmin, async (req, res) => {
  const { name, institution, category, logoUrl, group, bracketPosition } = req.body
  if (!name || !institution || !category) {
    return res.status(400).json({ error: 'name, institution e category são obrigatórios' })
  }
  const team = await prisma.team.create({
    data: {
      name,
      institution,
      category,
      logoUrl: logoUrl || null,
      group: group || null,
      bracketPosition: bracketPosition ?? null
    }
  })
  emitConfigUpdated('teams', category)
  res.status(201).json(team)
})

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { name, institution, category, logoUrl, group, bracketPosition } = req.body
  try {
    const team = await prisma.team.update({
      where: { id },
      data: {
        name,
        institution,
        category,
        logoUrl: logoUrl || null,
        group: group || null,
        bracketPosition: bracketPosition ?? null
      }
    })
    emitConfigUpdated('teams', category)
    res.json(team)
  } catch {
    res.status(404).json({ error: 'Equipa não encontrada' })
  }
})

// CORRIGIDO - soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const existing = await prisma.team.update({
      where: { id },
      data: { deletedAt: new Date() }
    })
    emitConfigUpdated('teams', existing.category)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Equipa não encontrada' })
  }
})

export default router
