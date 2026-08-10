import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

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

export default router
