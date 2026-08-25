import { Router } from 'express'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'

const router = Router()

// GET /api/phases?championship=universitario
router.get('/', async (req, res) => {
  try {
    const { championship } = req.query as { championship?: string }

    const where: any = {}
    if (championship && championship !== 'undefined' && championship !== 'null') {
      where.championship = championship
    }

    const phases = await prisma.phase.findMany({
      where,
      orderBy: { order: 'asc' }
    })

    return res.json(phases)
  } catch (error: any) {
    console.error('[Phases GET / Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao carregar as fases.' })
  }
})

// POST /api/phases/swap — troca a posição (order) de duas fases.
router.post('/swap', requireAdmin, async (req, res) => {
  try {
    const { firstId, secondId } = req.body as { firstId?: string; secondId?: string }
    if (!firstId || !secondId) {
      return res.status(400).json({ error: 'firstId e secondId são obrigatórios.' })
    }

    const [first, second] = await Promise.all([
      prisma.phase.findUnique({ where: { id: firstId } }),
      prisma.phase.findUnique({ where: { id: secondId } })
    ])
    if (!first || !second || first.championship !== second.championship) {
      return res.status(404).json({ error: 'Fases não encontradas ou de campeonatos diferentes.' })
    }

    const orderA = first.order
    const orderB = second.order
    const TEMP_ORDER = -1

    await prisma.phase.update({ where: { id: first.id }, data: { order: TEMP_ORDER } })
    await prisma.phase.update({ where: { id: second.id }, data: { order: orderA } })
    await prisma.phase.update({ where: { id: first.id }, data: { order: orderB } })

    const phases = await prisma.phase.findMany({ where: { championship: first.championship }, orderBy: { order: 'asc' } })
    return res.json({ success: true, phases })
  } catch (error: any) {
    console.error('[Phases POST /swap Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao trocar a ordem das fases.' })
  }
})

// POST /api/phases/repair-numbering — corrige buracos na numeração de ordem.
router.post('/repair-numbering', requireAdmin, async (req, res) => {
  try {
    const { championship } = req.body as { championship?: string }
    if (!championship) {
      return res.status(400).json({ error: 'championship é obrigatório.' })
    }
    const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
    for (let i = 0; i < phases.length; i++) {
      const desiredOrder = i + 1
      if (phases[i].order !== desiredOrder) {
        await prisma.phase.update({ where: { id: phases[i].id }, data: { order: desiredOrder } })
      }
    }
    const updated = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
    return res.json({ success: true, phases: updated })
  } catch (error: any) {
    console.error('[Phases POST /repair-numbering Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao reparar numeração.' })
  }
})

// GET /api/phases/:id
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da fase inválido ou não fornecido.' })
    }

    const phase = await prisma.phase.findUnique({ where: { id } })

    if (!phase) {
      return res.status(404).json({ error: 'Fase não encontrada.' })
    }

    return res.json(phase)
  } catch (error: any) {
    console.error('[Phases GET /:id Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao obter a fase.' })
  }
})

// POST /api/phases
router.post('/', requireAdmin, async (req, res) => {
  try {
    console.log('[Backend POST /api/phases] Body recebido:', req.body)

    const {
      name,
      label,
      championship,
      order,
      type,
      useQuestions,
      useJudges,
      maxQuestions,
      questionsPerTeam,
      useInitialScores,
      initialScoreMaxPoints,
      presentationMinutes,
      presentationWeight,
      quizWeight,
      noElimination
    } = req.body || {}

    const phaseLabel = (typeof label === 'string' && label.trim())
      ? label.trim()
      : (typeof name === 'string' && name.trim())
        ? name.trim()
        : null

    if (!phaseLabel) {
      console.warn('[Backend POST /api/phases] Rejeitado: campo "label" ou "name" em falta.')
      return res.status(400).json({
        error: 'O nome da fase é obrigatório (envie "label" ou "name").',
        receivedData: req.body
      })
    }

    const championshipValue = championship && championship !== 'undefined' && championship !== 'null' ? championship : null

    let resolvedOrder: number
    if (order !== undefined && order !== null) {
      resolvedOrder = Number(order)
    } else {
      const maxOrder = await prisma.phase.aggregate({
        where: { championship: championshipValue ?? undefined },
        _max: { order: true }
      })
      resolvedOrder = (maxOrder._max.order ?? 0) + 1
    }

    const dataToCreate: any = {
      label: phaseLabel,
      championship: championshipValue,
      order: resolvedOrder
    }

    if (type !== undefined) dataToCreate.type = type
    if (useQuestions !== undefined) dataToCreate.useQuestions = Boolean(useQuestions)
    if (useJudges !== undefined) dataToCreate.useJudges = Boolean(useJudges)
    if (maxQuestions !== undefined) dataToCreate.maxQuestions = Number(maxQuestions)
    if (questionsPerTeam !== undefined) dataToCreate.questionsPerTeam = Number(questionsPerTeam)
    if (useInitialScores !== undefined) dataToCreate.useInitialScores = Boolean(useInitialScores)
    if (initialScoreMaxPoints !== undefined) dataToCreate.initialScoreMaxPoints = initialScoreMaxPoints ? Number(initialScoreMaxPoints) : null
    if (presentationMinutes !== undefined) dataToCreate.presentationMinutes = Number(presentationMinutes)
    if (presentationWeight !== undefined) dataToCreate.presentationWeight = Number(presentationWeight)
    if (quizWeight !== undefined) dataToCreate.quizWeight = Number(quizWeight)
    // NOVO — fase de Apresentação sem eliminação: todas as equipas avançam
    // e a nota é transportada (ponderada) para o Quiz da fase seguinte.
    if (noElimination !== undefined) dataToCreate.noElimination = Boolean(noElimination)

    const phase = await prisma.phase.create({ data: dataToCreate })

    console.log('[Backend POST /api/phases] Fase criada com sucesso:', phase.id, 'order:', phase.order)
    return res.status(201).json(phase)
  } catch (error: any) {
    console.error('[Phases POST / Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao criar a fase.' })
  }
})

// PUT /api/phases/:id
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      label,
      championship,
      order,
      type,
      useQuestions,
      useJudges,
      maxQuestions,
      questionsPerTeam,
      useInitialScores,
      initialScoreMaxPoints,
      presentationMinutes,
      presentationWeight,
      quizWeight,
      noElimination
    } = req.body || {}

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da fase inválido.' })
    }

    const existing = await prisma.phase.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Fase não encontrada.' })
    }

    const phaseLabel = (label && typeof label === 'string' && label.trim()) || (name && typeof name === 'string' && name.trim())

    const dataToUpdate: any = {}

    if (phaseLabel) dataToUpdate.label = phaseLabel
    if (championship !== undefined) dataToUpdate.championship = championship || null
    if (order !== undefined) dataToUpdate.order = Number(order)
    if (type !== undefined) dataToUpdate.type = type
    if (useQuestions !== undefined) dataToUpdate.useQuestions = Boolean(useQuestions)
    if (useJudges !== undefined) dataToUpdate.useJudges = Boolean(useJudges)
    if (maxQuestions !== undefined) dataToUpdate.maxQuestions = Number(maxQuestions)
    if (questionsPerTeam !== undefined) dataToUpdate.questionsPerTeam = Number(questionsPerTeam)
    if (useInitialScores !== undefined) dataToUpdate.useInitialScores = Boolean(useInitialScores)
    if (initialScoreMaxPoints !== undefined) dataToUpdate.initialScoreMaxPoints = initialScoreMaxPoints ? Number(initialScoreMaxPoints) : null
    if (presentationMinutes !== undefined) dataToUpdate.presentationMinutes = Number(presentationMinutes)
    if (presentationWeight !== undefined) dataToUpdate.presentationWeight = Number(presentationWeight)
    if (quizWeight !== undefined) dataToUpdate.quizWeight = Number(quizWeight)
    // NOVO
    if (noElimination !== undefined) dataToUpdate.noElimination = Boolean(noElimination)

    const phase = await prisma.phase.update({ where: { id }, data: dataToUpdate })

    return res.json(phase)
  } catch (error: any) {
    console.error('[Phases PUT /:id Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao atualizar a fase.' })
  }
})

// DELETE /api/phases/:id
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params

    if (!id || id === 'undefined' || id === 'null') {
      return res.status(400).json({ error: 'ID da fase inválido.' })
    }

    const existing = await prisma.phase.findUnique({ where: { id } })
    if (!existing) {
      return res.status(404).json({ error: 'Fase não encontrada.' })
    }

    await prisma.phase.delete({ where: { id } })

    return res.json({ message: 'Fase eliminada com sucesso.' })
  } catch (error: any) {
    console.error('[Phases DELETE /:id Error]:', error)
    return res.status(500).json({ error: error?.message || 'Erro ao eliminar a fase.' })
  }
})

export default router
