import { Router } from 'express'
import { prisma } from '../db'

export const questionAssignmentsRouter = Router()

// GET /api/question-assignments?phaseId=xxx&teamId=xxx
questionAssignmentsRouter.get('/', async (req, res) => {
  const { phaseId, teamId } = req.query as { phaseId?: string; teamId?: string }
  const where: any = { deletedAt: null }
  if (phaseId) where.phaseId = phaseId
  if (teamId) where.teamId = teamId
  const rows = await prisma.questionAssignment.findMany({
    where,
    orderBy: { order: 'asc' },
    include: { question: true, team: true }
  })
  res.json(rows)
})

// POST /api/question-assignments  { phaseId, teamId, questionIds: string[] }
// Substitui (soft-delete + recria) toda a atribuicao dessa equipa/fase pela lista enviada, na ordem dada.
questionAssignmentsRouter.post('/', async (req, res) => {
  const { phaseId, teamId, questionIds } = req.body as {
    phaseId?: string
    teamId?: string
    questionIds?: string[]
  }
  if (!phaseId || !teamId || !Array.isArray(questionIds)) {
    res.status(400).json({ error: 'phaseId, teamId e questionIds[] sao obrigatorios.' })
    return
  }

  await prisma.questionAssignment.updateMany({
    where: { phaseId, teamId, deletedAt: null },
    data: { deletedAt: new Date() }
  })

  const created = await Promise.all(
    questionIds.map((questionId, index) =>
      prisma.questionAssignment.upsert({
        where: { questionId_teamId_phaseId: { questionId, teamId, phaseId } },
        update: { order: index, deletedAt: null, usedAt: null },
        create: { questionId, teamId, phaseId, order: index }
      })
    )
  )

  res.status(201).json(created)
})

// DELETE /api/question-assignments/:id
questionAssignmentsRouter.delete('/:id', async (req, res) => {
  await prisma.questionAssignment.update({
    where: { id: req.params.id },
    data: { deletedAt: new Date() }
  })
  res.json({ success: true })
})
