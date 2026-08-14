import { Router } from 'express'
import { prisma } from '../db'

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
    items.map((i) => ({ ...i, jurorIds: i.jurorAssignments.map((a) => a.jurorId), jurorAssignments: undefined }))
  )
})

router.post('/', async (req, res) => {
  const { championship, type, mode, text, imageUrl, optionA, optionB, optionC, optionD, correctIndex, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body
  if (!championship || !type || !text || !maxPoints || !phase) {
    return res.status(400).json({ error: 'championship, type, text, maxPoints e phase são obrigatórios' })
  }
  if (mode === 'multipla_escolha' && (!optionA || !optionB || correctIndex === undefined)) {
    return res.status(400).json({ error: 'Perguntas de múltipla escolha precisam de opções e da resposta correta' })
  }
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
      correctIndex: mode === 'multipla_escolha' ? correctIndex : null,
      timeSeconds: mode === 'multipla_escolha' ? (timeSeconds || 30) : null,
      maxPoints,
      phase,
      scope: scope || 'single',
      jurorAssignments:
        mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
          ? { create: jurorIds.map((jurorId: string) => ({ jurorId })) }
          : undefined
    },
    include: { jurorAssignments: true }
  })
  res.status(201).json({ ...item, jurorIds: item.jurorAssignments.map((a) => a.jurorId) })
})

router.put('/:id', async (req, res) => {
  const { id } = req.params
  const { type, mode, text, imageUrl, optionA, optionB, optionC, optionD, correctIndex, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body
  try {
    await prisma.evaluationItemJuror.deleteMany({ where: { itemId: id } })
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
        correctIndex: mode === 'multipla_escolha' ? correctIndex : null,
        timeSeconds: mode === 'multipla_escolha' ? (timeSeconds || 30) : null,
        maxPoints,
        phase,
        scope,
        jurorAssignments:
          mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
            ? { create: jurorIds.map((jurorId: string) => ({ jurorId })) }
            : undefined
      },
      include: { jurorAssignments: true }
    })
    res.json({ ...item, jurorIds: item.jurorAssignments.map((a) => a.jurorId) })
  } catch {
    res.status(404).json({ error: 'Item não encontrado' })
  }
})

router.delete('/:id', async (req, res) => {
  const { id } = req.params
  try {
    await prisma.evaluationItem.delete({ where: { id } })
    res.status(204).send()
  } catch {
    res.status(404).json({ error: 'Item não encontrado' })
  }
})

export default router
