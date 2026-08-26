import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

router.get('/', async (req, res) => {
  const { championship, phase } = req.query as { championship?: string; phase?: string }
  const items = await prisma.evaluationItem.findMany({
    where: {
      championship: championship || undefined,
      phase: phase ? Number(phase) : undefined
    },
    include: { jurorAssignments: true },
    orderBy: { createdAt: 'asc' }
  })
  res.json(
    items.map((i) => ({
      ...i,
      correctIndexes: typeof i.correctIndexes === 'string' ? JSON.parse(i.correctIndexes || '[]') : (i.correctIndexes || []),
      jurorIds: i.jurorAssignments.map((a) => a.jurorId),
      jurorAssignments: undefined
    }))
  )
})

router.post('/', requireAdmin, async (req, res) => {
  const { championship, type, mode, text, imageUrl, optionA, optionB, optionC, optionD, correctIndexes, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body

  if (!championship || !type || !text || !maxPoints || !phase) {
    return res.status(400).json({ error: 'championship, type, text, maxPoints e phase são obrigatórios' })
  }
  if (mode === 'multipla_escolha' && (!optionA || !optionB || !correctIndexes)) {
    return res.status(400).json({ error: 'Perguntas de múltipla escolha precisam de opções e de pelo menos uma resposta correta' })
  }

  const serializedCorrectIndexes = mode === 'multipla_escolha'
    ? (typeof correctIndexes === 'string' ? correctIndexes : JSON.stringify(correctIndexes || []))
    : null

  const item = await prisma.evaluationItem.create({
    data: {
      championship,
      type,
      mode: mode || 'aberta',
      text,
      imageUrl: imageUrl || null,
      optionA: mode === 'multipla_escolha' ? optionA : null,
      optionB: mode === 'multipla_escolha' ? optionB : null,
      optionC: mode === 'multipla_escolha' ? optionC : null,
      optionD: mode === 'multipla_escolha' ? optionD : null,
      correctIndexes: serializedCorrectIndexes,
      timeSeconds: timeSeconds ? Number(timeSeconds) : 30,
      maxPoints: Number(maxPoints),
      phase: Number(phase),
      scope: scope || 'single',
      jurorAssignments:
        mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
          ? { create: jurorIds.map((jurorId: string) => ({ jurorId })) }
          : undefined
    },
    include: { jurorAssignments: true }
  })

  emitConfigUpdated('evaluationItems', championship)
  res.status(201).json({
    ...item,
    correctIndexes: typeof item.correctIndexes === 'string' ? JSON.parse(item.correctIndexes || '[]') : (item.correctIndexes || []),
    jurorIds: item.jurorAssignments.map((a) => a.jurorId)
  })
})

router.put('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { type, mode, text, imageUrl, optionA, optionB, optionC, optionD, correctIndexes, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body

  try {
    await prisma.evaluationItemJuror.deleteMany({ where: { itemId: id } })

    const serializedCorrectIndexes = mode === 'multipla_escolha'
      ? (typeof correctIndexes === 'string' ? correctIndexes : JSON.stringify(correctIndexes || []))
      : null

    const item = await prisma.evaluationItem.update({
      where: { id },
      data: {
        type,
        mode,
        text,
        imageUrl: imageUrl || null,
        optionA: mode === 'multipla_escolha' ? optionA : null,
        optionB: mode === 'multipla_escolha' ? optionB : null,
        optionC: mode === 'multipla_escolha' ? optionC : null,
        optionD: mode === 'multipla_escolha' ? optionD : null,
        correctIndexes: serializedCorrectIndexes,
        timeSeconds: timeSeconds ? Number(timeSeconds) : 30,
        maxPoints: Number(maxPoints),
        phase: Number(phase),
        scope,
        jurorAssignments:
          mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
            ? { create: jurorIds.map((jurorId: string) => ({ jurorId })) }
            : undefined
      },
      include: { jurorAssignments: true }
    })

    emitConfigUpdated('evaluationItems', item.championship)
    res.json({
      ...item,
      correctIndexes: typeof item.correctIndexes === 'string' ? JSON.parse(item.correctIndexes || '[]') : (item.correctIndexes || []),
      jurorIds: item.jurorAssignments.map((a) => a.jurorId)
    })
  } catch (err) {
    console.error(err)
    res.status(404).json({ error: 'Item não encontrado ou erro na atualização' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params
  try {
    const existing = await prisma.evaluationItem.delete({ where: { id } })
    emitConfigUpdated('evaluationItems', existing.championship)
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Item não encontrado' })
  }
})

export default router
