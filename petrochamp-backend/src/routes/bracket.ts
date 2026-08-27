import { Router } from 'express'
import { prisma } from '../db'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

// GET /api/bracket/:championship - Obter a estrutura do chaveamento
router.get('/:championship', async (req, res) => {
  try {
    const { championship } = req.params
    const rawTeams = await prisma.team.findMany({
      where: {
        category: championship,
        group: { not: null },
        deletedAt: null // NOVO
      },
      orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
    })

    // Eliminar duplicados por ID e por Nome (case-insensitive)
    const uniqueTeamsMap = new Map<string, (typeof rawTeams)[0]>()
    for (const t of rawTeams) {
      const nameKey = t.name.trim().toLowerCase()
      const exists = Array.from(uniqueTeamsMap.values()).some(
        (existing) => existing.id === t.id || existing.name.trim().toLowerCase() === nameKey
      )
      if (!exists && t.group) {
        uniqueTeamsMap.set(t.id, t)
      }
    }
    const teams = Array.from(uniqueTeamsMap.values())

    const grouped = new Map<string, typeof teams>()
    for (const t of teams) {
      const g = t.group!
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
  } catch (error) {
    console.error('Erro ao obter chaveamento:', error)
    res.status(500).json({ error: 'Erro ao carregar chaveamento.' })
  }
})

// Função auxiliar para eliminar o chaveamento, duplas e limpar grupos das
// equipas. NOTA: este apagamento em massa continua intencionalmente hard
// delete/deleteMany — é dado derivado, sempre recalculado do zero quando
// se gera um novo chaveamento, e não uma entidade que o utilizador apaga
// individualmente através de um botão "remover".
async function deleteBracketData(championship?: string) {
  return await prisma.$transaction(async (tx) => {
    await tx.presentationScore.deleteMany({})

    if (championship) {
      await tx.presentationDupla.deleteMany({
        where: {
          phase: {
            championship
          }
        }
      })

      await tx.bracketMatch.deleteMany({
        where: { championship }
      })

      // Limpar o grupo e a posição para o chaveamento ficar vazio
      await tx.team.updateMany({
        where: { category: championship },
        data: { group: null, bracketPosition: null }
      })
    } else {
      await tx.presentationDupla.deleteMany({})
      await tx.bracketMatch.deleteMany({})
      await tx.team.updateMany({
        data: { group: null, bracketPosition: null }
      })
    }
  })
}

// DELETE /api/bracket/:championship
router.delete('/:championship', async (req, res) => {
  try {
    const { championship } = req.params
    await deleteBracketData(championship)

    emitConfigUpdated('bracket')
    emitConfigUpdated('presentation')
    emitConfigUpdated('teams')

    res.json({
      success: true,
      message: `Chaveamento e duplas da categoria ${championship} eliminados com sucesso.`
    })
  } catch (error) {
    console.error('Erro ao eliminar chaveamento:', error)
    res.status(500).json({ error: 'Erro ao eliminar chaveamento e duplas de apresentação.' })
  }
})

const handleClearAll = async (_req: any, res: any) => {
  try {
    await deleteBracketData()

    emitConfigUpdated('bracket')
    emitConfigUpdated('presentation')
    emitConfigUpdated('teams')

    res.json({
      success: true,
      message: 'Todo o chaveamento e duplas de apresentação foram eliminados com sucesso.'
    })
  } catch (error) {
    console.error('Erro ao eliminar chaveamento:', error)
    res.status(500).json({ error: 'Erro ao eliminar chaveamento e duplas de apresentação.' })
  }
}

router.post('/clear', handleClearAll)
router.delete('/', handleClearAll)

export default router
