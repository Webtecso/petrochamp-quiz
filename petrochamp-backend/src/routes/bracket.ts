import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

// GET /api/bracket/:championship - Obter a estrutura do chaveamento
router.get('/:championship', async (req, res) => {
  const { championship } = req.params
  const teams = await prisma.team.findMany({
    where: { category: championship },
    orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
  })

  const grouped = new Map<string, typeof teams>()
  for (const t of teams) {
    const g = t.group || 'Sem Grupo'
    if (!grouped.has(g)) grouped.set(g, [])
    grouped.get(g)!.push(t)
  }

  const round1Matches: unknown[] = []
  for (const [groupName, groupTeams] of grouped) {
    for (let i = 0; i < groupTeams.length; i += 2) {
      const teamA = groupTeams[i]
      const teamB = groupTeams[i + 1]
      round1Matches.push({
        id: `r1-${teamA.id}`,
        groupName,
        teamA: { id: teamA.id, name: teamA.name, logoUrl: teamA.logoUrl },
        teamB: teamB ? { id: teamB.id, name: teamB.name, logoUrl: teamB.logoUrl } : null
      })
    }
  }

  let totalSlots = 1
  while (totalSlots < Math.max(round1Matches.length * 2, 2)) totalSlots *= 2
  const totalRounds = Math.log2(totalSlots)

  res.json({ championship, teamCount: teams.length, round1Matches, totalRounds })
})

// Função auxiliar para eliminar o chaveamento e as duplas de apresentação
async function deleteBracketData(championship?: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Apagar as duplas de apresentação (e as respetivas pontuações se existirem)
    await tx.presentationScore.deleteMany({})

    if (championship) {
      // Apaga as duplas vinculadas às fases daquela categoria/championship
      await tx.presentationDupla.deleteMany({
        where: {
          phase: {
            championship
          }
        }
      })

      // 2. Apagar os jogos do chaveamento da categoria especificada
      await tx.bracketMatch.deleteMany({
        where: { championship }
      })
    } else {
      // Apaga todas as duplas e jogos de chaveamento
      await tx.presentationDupla.deleteMany({})
      await tx.bracketMatch.deleteMany({})
    }
  })
}

// DELETE /api/bracket/:championship - Eliminar chaveamento de uma categoria específica
router.delete('/:championship', async (req, res) => {
  try {
    const { championship } = req.params
    await deleteBracketData(championship)

    // Emitir eventos em tempo real para atualizar o Admin e os Jurados
    emitConfigUpdated('bracket')
    emitConfigUpdated('presentation')

    res.json({ success: true, message: `Chaveamento e duplas da categoria ${championship} eliminados com sucesso.` })
  } catch (error) {
    console.error('Erro ao eliminar chaveamento:', error)
    res.status(500).json({ error: 'Erro ao eliminar chaveamento e duplas de apresentação.' })
  }
})

// POST /api/bracket/clear ou DELETE /api/bracket - Eliminar todo o chaveamento
const handleClearAll = async (_req: any, res: any) => {
  try {
    await deleteBracketData()

    emitConfigUpdated('bracket')
    emitConfigUpdated('presentation')

    res.json({ success: true, message: 'Todo o chaveamento e duplas de apresentação foram eliminados com sucesso.' })
  } catch (error) {
    console.error('Erro ao eliminar chaveamento:', error)
    res.status(500).json({ error: 'Erro ao eliminar chaveamento e duplas de apresentação.' })
  }
}

router.post('/clear', handleClearAll)
router.delete('/', handleClearAll)

export default router
