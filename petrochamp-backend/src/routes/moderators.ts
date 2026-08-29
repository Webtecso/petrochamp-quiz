import { Router } from 'express'
import { prisma } from '../db'
import { generateModeratorCode } from '../socket/liveState'

const router = Router()

const VALID_AREAS = ['quiz', 'apresentacao', 'jurados', 'repescagem']

function sanitizeAreas(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return Array.from(new Set(input.filter((a): a is string => VALID_AREAS.includes(a))))
}

router.get('/', async (_req, res) => {
  const moderators = await prisma.moderator.findMany({
    where: { deletedAt: null }, // NOVO
    orderBy: { createdAt: 'asc' },
    include: { areas: true }
  })
  res.json(
    moderators.map((m) => ({
      id: m.id,
      name: m.name,
      code: m.code,
      role: m.role,
      areas: m.areas.map((a) => a.area)
    }))
  )
})

router.post('/', async (req, res) => {
  const { name, role, areas } = req.body as {
    name?: string
    role?: 'principal' | 'secundario'
    areas?: string[]
  }
  if (!name) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }
  if (role === 'principal') {
    const existingPrincipal = await prisma.moderator.findFirst({
      where: { role: 'principal', deletedAt: null }
    })
    if (existingPrincipal) {
      res.status(400).json({
        error: 'Já existe um Moderador Principal. Remove-o primeiro ou escolhe Secundário.'
      })
      return
    }
  }
  let code = generateModeratorCode()
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.moderator.findUnique({ where: { code } })
    if (!exists) break
    code = generateModeratorCode()
  }
  const cleanAreas = role === 'principal' ? [] : sanitizeAreas(areas) // Principal não precisa de áreas - já tem tudo
  const moderator = await prisma.moderator.create({
    data: {
      name,
      code,
      role: role === 'principal' ? 'principal' : 'secundario',
      areas: { create: cleanAreas.map((area) => ({ area })) }
    },
    include: { areas: true }
  })
  res.status(201).json({ ...moderator, areas: moderator.areas.map((a) => a.area) })
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { name, role, areas } = req.body as {
    name?: string
    role?: 'principal' | 'secundario'
    areas?: string[]
  }
  if (role === 'principal') {
    const existingPrincipal = await prisma.moderator.findFirst({
      where: { role: 'principal', id: { not: id }, deletedAt: null }
    })
    if (existingPrincipal) {
      res.status(400).json({ error: 'Já existe outro Moderador Principal.' })
      return
    }
  }
  try {
    const finalRole = role === 'principal' ? 'principal' : 'secundario'
    const cleanAreas = finalRole === 'principal' ? [] : sanitizeAreas(areas)
    const moderator = await prisma.moderator.update({
      where: { id },
      data: {
        name,
        role: finalRole,
        // Sempre que 'areas' vem no payload, substitui o conjunto inteiro
        // (delete + recreate) - tabela auxiliar, não precisa de soft delete.
        ...(areas !== undefined
          ? { areas: { deleteMany: {}, create: cleanAreas.map((area) => ({ area })) } }
          : {})
      },
      include: { areas: true }
    })
    res.json({ ...moderator, areas: moderator.areas.map((a) => a.area) })
  } catch {
    res.status(404).json({ error: 'Moderador não encontrado' })
  }
})

// CORRIGIDO - soft delete (ver nota em questions.ts)
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.moderator.update({ where: { id }, data: { deletedAt: new Date() } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Moderador não encontrado' })
  }
})

export default router
