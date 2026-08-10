import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

router.get('/:championship', async (req, res) => {
  try {
    const { championship } = req.params

    // 1. Busca as equipas filtradas pela categoria/campeonato
    const teams = await prisma.team.findMany({
      where: { category: championship },
      orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
    })

    // 2. Agrupa as equipas por Grupo
    const grouped = new Map<string, typeof teams>()
    for (const t of teams) {
      const g = t.group || 'Sem Grupo'
      if (!grouped.has(g)) grouped.set(g, [])
      grouped.get(g)!.push(t)
    }

    // 3. Monta os confrontos da Ronda 1
    const round1Matches: unknown[] = []
    for (const [groupName, groupTeams] of grouped) {
      for (let i = 0; i < groupTeams.length; i += 2) {
        const teamA = groupTeams[i]
        const teamB = groupTeams[i + 1]

        if (teamA) {
          round1Matches.push({
            id: `r1-${teamA.id}`,
            groupName,
            teamA: { id: teamA.id, name: teamA.name, logoUrl: teamA.logoUrl },
            teamB: teamB ? { id: teamB.id, name: teamB.name, logoUrl: teamB.logoUrl } : null
          })
        }
      }
    }

    // 4. Calcula o total de rondas necessárias
    let totalSlots = 1
    while (totalSlots < Math.max(round1Matches.length * 2, 2)) {
      totalSlots *= 2
    }
    const totalRounds = Math.log2(totalSlots)

    // 5. Retorna o JSON com sucesso
    return res.json({
      championship,
      teamCount: teams.length,
      round1Matches,
      totalRounds
    })

  } catch (error) {
    // Se a base de dados falhar ou algum campo não existir, isto captura o erro sem derrubar o servidor
    console.error('Erro na rota /api/bracket/:championship ->', error)

    return res.status(500).json({
      error: 'Erro ao calcular o chaveamento.',
      details: error instanceof Error ? error.message : String(error)
    })
  }
})

export default router
