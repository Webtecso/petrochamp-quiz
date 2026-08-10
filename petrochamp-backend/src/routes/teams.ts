import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/', async (_req, res) => {
  const teams = await prisma.team.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(teams)
})

router.post('/', async (req, res) => {
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
  res.status(201).json(team)
})

router.put('/:id', async (req, res) => {
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
    res.json(team)
  } catch {
    res.status(404).json({ error: 'Equipa não encontrada' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.team.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Equipa não encontrada' })
  }
})

export default router
