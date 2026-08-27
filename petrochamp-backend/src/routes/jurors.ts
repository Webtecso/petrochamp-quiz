import { Router } from 'express'
import { prisma } from '../db'
import { generateJurorCode } from '../socket/liveState'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

/* ==========================================================================
   ROTAS DE AUTORIZAÇÕES (Devem vir antes de /:id para evitar sobreposição)
   ========================================================================== */

router.get('/authorizations', async (req, res) => {
  try {
    const { phaseId } = req.query as { phaseId?: string }

    // phaseId tratado como String (CUID), evitando conversão para NaN
    const auths = await prisma.phaseJurorAuthorization.findMany({
      where: {
        ...(phaseId ? { phaseId: String(phaseId) } : {}),
        deletedAt: null // NOVO
      }
    })
    res.json(auths)
  } catch (error) {
    console.error('[GET /authorizations Error]:', error)
    res.status(500).json({ error: 'Erro ao buscar autorizações dos jurados.' })
  }
})

router.post('/authorizations', requireAdmin, async (req, res) => {
  const { phaseId, jurorId } = req.body
  if (!phaseId || !jurorId) {
    res.status(400).json({ error: 'phaseId e jurorId são obrigatórios' })
    return
  }
  try {
    const auth = await prisma.phaseJurorAuthorization.create({
      data: {
        phaseId: String(phaseId),
        jurorId: String(jurorId)
      }
    })
    emitConfigUpdated('jurors')
    res.status(201).json(auth)
  } catch (error) {
    console.error('[POST /authorizations Error]:', error)
    res.status(400).json({ error: 'Já autorizado, ou erro ao criar.' })
  }
})

// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/authorizations/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  if (!id) {
    res.status(400).json({ error: 'ID de autorização inválido.' })
    return
  }

  try {
    const parsedId = isNaN(Number(id)) ? id : Number(id)
    await prisma.phaseJurorAuthorization.update({
      where: { id: parsedId as any },
      data: { deletedAt: new Date() }
    })
    emitConfigUpdated('jurors')
    res.status(204).send()
  } catch (error) {
    console.error('[DELETE /authorizations Error]:', error)
    res.status(404).json({ error: 'Autorização não encontrada' })
  }
})

/* ==========================================================================
   ROTAS PRINCIPAIS DE JURADOS
   ========================================================================== */

router.get('/', async (_req, res) => {
  try {
    const jurors = await prisma.juror.findMany({
      where: { deletedAt: null }, // NOVO
      orderBy: { createdAt: 'asc' }
    })
    res.json(jurors)
  } catch (error) {
    console.error('[GET /jurors Error]:', error)
    res.status(500).json({ error: 'Erro ao buscar jurados.' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  const { name } = req.body
  if (!name) {
    res.status(400).json({ error: 'name é obrigatório' })
    return
  }
  try {
    let code = generateJurorCode()
    for (let i = 0; i < 5; i++) {
      const exists = await prisma.juror.findUnique({ where: { code } })
      if (!exists) break
      code = generateJurorCode()
    }
    const juror = await prisma.juror.create({ data: { name, code } })
    emitConfigUpdated('jurors')
    res.status(201).json(juror)
  } catch (error) {
    console.error('[POST /jurors Error]:', error)
    res.status(500).json({ error: 'Erro ao criar jurado.' })
  }
})

// CORRIGIDO — este é o botão "remover" que estava a apresentar o bug: o
// jurado desaparecia só de um lado (o que fez o DELETE) porque o
// syncService nunca via a linha apagada fisicamente. Agora tanto o jurado
// como as suas autorizações passam a soft delete, e o syncService apanha
// e propaga a mudança no próximo ciclo.
router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    await prisma.phaseJurorAuthorization.updateMany({
      where: { jurorId: id },
      data: { deletedAt: new Date() }
    })
    await prisma.juror.update({ where: { id }, data: { deletedAt: new Date() } })
    emitConfigUpdated('jurors')
    res.status(204).send()
  } catch (error) {
    console.error('[DELETE /jurors Error]:', error)
    res.status(404).json({ error: 'Jurado não encontrado' })
  }
})

export default router
