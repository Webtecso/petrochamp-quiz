import { Router } from 'express'
import { prisma } from '../db'
import { generateJurorCode } from '../socket/liveState'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

router.get('/', async (_req, res) => {
  const jurors = await prisma.juror.findMany({ orderBy: { createdAt: 'asc' } })
  res.json(jurors)
})

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body
  if (!name) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }
  let code = generateJurorCode()
  for (let i = 0; i < 5; i++) {
    const exists = await prisma.juror.findUnique({ where: { code } })
    if (!exists) break
    code = generateJurorCode()
  }
  const juror = await prisma.juror.create({ data: { name, code } })
  emitConfigUpdated('jurors')
  res.status(201).json(juror)
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.phaseJurorAuthorization.deleteMany({ where: { jurorId: id } })
    await prisma.juror.delete({ where: { id } })
    emitConfigUpdated('jurors')
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Jurado não encontrado' })
  }
})

router.get('/authorizations', async (req, res) => {
  const { phaseId } = req.query as { phaseId?: string }
  const auths = await prisma.phaseJurorAuthorization.findMany({
    where: phaseId ? { phaseId: Number(phaseId) } : undefined
  })
  res.json(auths)
})

router.post('/authorizations', requireAdmin, async (req, res) => {
  const { phaseId, jurorId } = req.body
  if (!phaseId || !jurorId) {
    res.status(400).json({ error: 'phaseId e jurorId são obrigatórios' })
    return
  }
  try {
    const auth = await prisma.phaseJurorAuthorization.create({ data: { phaseId, jurorId } })
    emitConfigUpdated('jurors')
    res.status(201).json(auth)
  } catch {
    res.status(400).json({ error: 'Já autorizado, ou erro ao criar.' })
  }
})

router.delete('/authorizations/:id', requireAdmin, async (req, res) => {
  const id = Number(req.params.id)
  try {
    await prisma.phaseJurorAuthorization.delete({ where: { id } })
    emitConfigUpdated('jurors')
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Autorização não encontrada' })
  }
})

export default router
