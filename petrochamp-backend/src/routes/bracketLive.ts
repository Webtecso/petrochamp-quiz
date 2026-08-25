import { Router } from 'express'
import { prisma } from '../db'
import { requireAdmin } from '../middleware/requireAdmin'
import { emitConfigUpdated } from '../socket/configEvents'

const router = Router()

// evita que duas chamadas a /generate corram em paralelo para a
// mesma categoria (ex: duplo clique, ou um pedido novo disparado antes do
// anterior terminar). Sem isto, o deleteMany de um pedido podia correr
// entre o deleteMany e o createMany de outro, e os dois createMany
// acabavam por inserir os mesmos confrontos duas vezes (ou mais, se
// houvesse mais pedidos concorrentes) — foi isto que causou os
// chaveamentos duplicados infinitamente.
const generatingChampionships = new Set<string>()

function nextPowerOfTwo(n: number): number {
  let p = 1
  while (p < n) p *= 2
  return p
}

function roundLabel(round: number, total: number): string {
  const remaining = total - round
  if (remaining === 0) return 'Final'
  if (remaining === 1) return 'Meias-Finais'
  if (remaining === 2) return 'Quartas de Final'
  return `Ronda ${round}`
}

async function ensurePhasesForRounds(championship: string, totalRounds: number): Promise<void> {
  const existing = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  for (let round = 1; round <= totalRounds; round++) {
    const already = existing.find((p) => p.order === round)
    if (!already) {
      await prisma.phase.create({
        data: {
          championship,
          order: round,
          label: roundLabel(round, totalRounds),
          useQuestions: true,
          useJudges: false,
          avoidRepeatQuestions: true
        }
      })
    }
  }
}

async function resolveByesRecursively(championship: string, totalRounds: number): Promise<void> {
  for (let round = 1; round < totalRounds; round++) {
    const matches = await prisma.bracketMatch.findMany({ where: { championship, round, winnerId: null } })
    for (const m of matches) {
      const hasA = !!m.teamAId
      const hasB = !!m.teamBId
      if (hasA !== hasB) {
        const winnerId = hasA ? m.teamAId! : m.teamBId!
        await prisma.bracketMatch.update({ where: { id: m.id }, data: { winnerId } })
        const nextSlot = Math.floor(m.slot / 2)
        const nextMatch = await prisma.bracketMatch.findFirst({
          where: { championship, round: m.round + 1, slot: nextSlot }
        })
        if (nextMatch) {
          const isFirstChild = m.slot % 2 === 0
          await prisma.bracketMatch.update({
            where: { id: nextMatch.id },
            data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
          })
        }
      }
    }
  }
}

// Cria/atualiza as PresentationDuplas de uma ronda específica, sempre que
// essa ronda corresponder a uma fase de Apresentação (pura ou + Quiz) e já
// tiver equipas definidas nos confrontos. Chamada tanto ao gerar o
// chaveamento (Ronda 1) como sempre que uma equipa avança para uma ronda
// seguinte (ver recordBracketResult em socket/index.ts) — assim as duplas
// nunca dessincronizam do chaveamento, seja qual for a ronda escolhida
// para ser de Apresentação.
//
// IMPORTANTE: como os dois jogos que alimentam uma mesma dupla de
// Apresentação normalmente NÃO terminam ao mesmo tempo, esta função pode
// ser chamada primeiro só com teamAId preenchido (e teamBId ainda null),
// e mais tarde outra vez já com teamBId preenchido. Por isso a
// identidade de uma dupla é sempre o teamAId (que nunca muda depois de
// definido) — nunca comparamos teamAId+teamBId juntos, para não criar
// duplicados quando a segunda equipa só chega mais tarde.
//
// CORRIGIDO — a causa da duplicação de duplas: o array `existingDuplas`
// era lido UMA VEZ antes do loop e nunca atualizado depois de criar uma
// dupla nova dentro do próprio loop. Sempre que havia mais do que um
// `bracketMatch` com o mesmo teamAId na mesma ronda (exatamente o que a
// duplicação do /generate produzia), a 1ª ocorrência criava a dupla mas
// as seguintes não a encontravam no array desatualizado — e criavam-na
// outra vez. Agora usamos um Map local que é atualizado a cada criação, e
// além disso o upsert usa a constraint única (phaseId, teamAId) da BD
// como rede de segurança final, mesmo que outra via de código chame esta
// função em paralelo.
export async function syncPresentationDuplasForRound(championship: string, round: number): Promise<void> {
  const phase = await prisma.phase.findFirst({ where: { championship, order: round } })
  if (!phase || (phase.type !== 'apresentacao' && phase.type !== 'apresentacao_quiz')) return

  const matches = await prisma.bracketMatch.findMany({
    where: { championship, round },
    orderBy: { slot: 'asc' }
  })
  const existingDuplas = await prisma.presentationDupla.findMany({ where: { phaseId: phase.id } })

  // Map local mantido em sincronia com as criações feitas dentro deste
  // próprio loop — é isto que faltava antes.
  const byTeamA = new Map(existingDuplas.map((d) => [d.teamAId, d]))

  let order = existingDuplas.length + 1
  let changedAny = false

  for (const m of matches) {
    if (!m.teamAId) continue

    const existing = byTeamA.get(m.teamAId)

    if (!existing) {
      const created = await prisma.presentationDupla.upsert({
        where: { phaseId_teamAId: { phaseId: phase.id, teamAId: m.teamAId } },
        create: {
          phaseId: phase.id,
          order: order++,
          themeA: '',
          themeB: m.teamBId ? '' : null,
          teamAId: m.teamAId,
          teamBId: m.teamBId ?? null
        },
        update: {}
      })
      byTeamA.set(m.teamAId, created)
      changedAny = true
      continue
    }

    // A dupla já existe (foi criada quando só a equipa A tinha avançado,
    // ou por uma iteração anterior deste mesmo loop). Se agora a equipa B
    // já está definida no confronto e a dupla ainda não a tem, atualiza-a
    // em vez de criar uma duplicada.
    if (m.teamBId && !existing.teamBId) {
      const updated = await prisma.presentationDupla.update({
        where: { id: existing.id },
        data: { teamBId: m.teamBId, themeB: existing.themeB ?? '' }
      })
      byTeamA.set(m.teamAId, updated)
      changedAny = true
    }
  }
  if (changedAny) emitConfigUpdated('presentation', championship)
}

router.get('/:championship', async (req, res) => {
  const { championship } = req.params
  const matches = await prisma.bracketMatch.findMany({
    where: { championship },
    orderBy: [{ round: 'asc' }, { slot: 'asc' }]
  })

  const teamIds = new Set<string>()
  for (const m of matches) {
    if (m.teamAId) teamIds.add(m.teamAId)
    if (m.teamBId) teamIds.add(m.teamBId)
  }
  const teams = await prisma.team.findMany({ where: { id: { in: Array.from(teamIds) } } })
  const teamMap = new Map(teams.map((t) => [t.id, t]))

  const shaped = matches.map((m) => ({
    id: m.id,
    round: m.round,
    slot: m.slot,
    groupName: m.groupName,
    teamA: m.teamAId
      ? { id: m.teamAId, name: teamMap.get(m.teamAId)?.name ?? '?', logoUrl: teamMap.get(m.teamAId)?.logoUrl ?? null }
      : null,
    teamB: m.teamBId
      ? { id: m.teamBId, name: teamMap.get(m.teamBId)?.name ?? '?', logoUrl: teamMap.get(m.teamBId)?.logoUrl ?? null }
      : null,
    winnerId: m.winnerId
  }))

  res.json({ championship, matches: shaped })
})

// a causa da duplicação infinita de bracketMatch: o deleteMany e o
// createMany corriam como duas operações separadas, sem transação. Se o
// /generate fosse chamado mais do que uma vez em sucessão (duplo clique,
// nova chamada antes da resposta anterior voltar, etc.), os pedidos
// entrelaçavam-se — ex: A apaga, B apaga (nada a apagar), A cria, B cria
// — e cada chamada extra ficava a somar mais um conjunto completo de
// confrontos em cima dos anteriores, sem nunca limpar os que já lá
// estavam. Agora:
//   1. Um "lock" em memória (generatingChampionships) rejeita pedidos
//      concorrentes para a mesma categoria com 409, em vez de os deixar
//      correr ao mesmo tempo.
//   2. O apagar + criar corre dentro de uma prisma.$transaction, que
//      garante atomicidade mesmo que o lock falhe por algum motivo (ex:
//      reinício do processo entre pedidos).
//   3. A constraint @@unique([championship, round, slot]) na BD rejeita
//      qualquer duplicado que ainda assim escape aos dois pontos acima.
router.post('/:championship/generate', requireAdmin, async (req, res) => {
  const { championship } = req.params

  if (generatingChampionships.has(championship)) {
    res.status(409).json({ error: 'Já existe uma geração de chaveamento em curso para esta categoria. Aguarde terminar.' })
    return
  }
  generatingChampionships.add(championship)

  try {
    const teams = await prisma.team.findMany({
      where: { category: championship },
      orderBy: [{ group: 'asc' }, { bracketPosition: 'asc' }]
    })

    if (teams.length < 2) {
      res.status(400).json({ error: 'É preciso pelo menos 2 equipas cadastradas nesta categoria.' })
      return
    }

    const slotsNeeded = nextPowerOfTwo(teams.length)
    const round1Count = slotsNeeded / 2
    const totalRounds = Math.log2(slotsNeeded)

    const created: { round: number; slot: number; teamAId?: string | null; teamBId?: string | null; groupName?: string }[] = []

    for (let slot = 0; slot < round1Count; slot++) {
      const teamA = teams[slot * 2]
      const teamB = teams[slot * 2 + 1]
      created.push({ round: 1, slot, teamAId: teamA?.id ?? null, teamBId: teamB?.id ?? null, groupName: teamA?.group ?? undefined })
    }

    for (let round = 2; round <= totalRounds; round++) {
      const count = slotsNeeded / Math.pow(2, round)
      for (let slot = 0; slot < count; slot++) {
        created.push({ round, slot })
      }
    }

    // Apagar o chaveamento anterior e criar o novo dentro da mesma
    // transação: ou as duas operações são aplicadas juntas, ou nenhuma é
    // — nunca fica um estado a meio onde os antigos já foram apagados mas
    // os novos ainda não existem (nem o inverso, os dois a coexistir).
    //
    // As PresentationDuplas da categoria também são apagadas aqui: como o
    // chaveamento vai ser todo recriado com IDs novos, as duplas antigas
    // (que apontam para teamAId de confrontos que deixam de existir da
    // forma anterior) deixam de fazer sentido e seriam reconstruídas de
    // qualquer forma pelo syncPresentationDuplasForRound logo a seguir.
    const phaseIds = (await prisma.phase.findMany({ where: { championship }, select: { id: true } })).map((p) => p.id)

    await prisma.$transaction([
      ...(phaseIds.length ? [prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } })] : []),
      prisma.bracketMatch.deleteMany({ where: { championship } }),
      prisma.bracketMatch.createMany({
        data: created.map((c) => ({
          championship,
          round: c.round,
          slot: c.slot,
          teamAId: c.teamAId ?? null,
          teamBId: c.teamBId ?? null,
          groupName: c.groupName ?? null
        }))
      })
    ])

    await resolveByesRecursively(championship, totalRounds)
    await ensurePhasesForRounds(championship, totalRounds)

    // Sincroniza duplas para todas as rondas já preenchidas neste momento
    // (normalmente só a Ronda 1, a não ser que resolveByesRecursively já
    // tenha avançado alguma equipa automaticamente por falta de adversário).
    for (let round = 1; round <= totalRounds; round++) {
      await syncPresentationDuplasForRound(championship, round)
    }

    emitConfigUpdated('bracket', championship)
    res.status(201).json({ success: true, totalRounds })
  } finally {
    generatingChampionships.delete(championship)
  }
})

// re-sincroniza as duplas de Apresentação de todas as fases já
// existentes, sem apagar/regerar o chaveamento. Útil sempre que se edita
// o "type" de uma fase (ex: mudar de "quiz" para "apresentacao_quiz")
// depois de o chaveamento já ter sido gerado — nesse caso as duplas dessa
// ronda nunca tinham sido criadas, porque syncPresentationDuplasForRound
// só corre automaticamente ao gerar o chaveamento e quando uma equipa
// avança de ronda.
router.post('/:championship/resync-presentation', requireAdmin, async (req, res) => {
  const { championship } = req.params
  const phases = await prisma.phase.findMany({ where: { championship }, orderBy: { order: 'asc' } })
  for (const phase of phases) {
    await syncPresentationDuplasForRound(championship, phase.order)
  }
  res.json({ success: true })
})

router.delete('/:championship', requireAdmin, async (req, res) => {
  const { championship } = req.params
  const phaseIds = (await prisma.phase.findMany({ where: { championship }, select: { id: true } })).map((p) => p.id)
  await prisma.$transaction([
    ...(phaseIds.length ? [prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } })] : []),
    prisma.bracketMatch.deleteMany({ where: { championship } })
  ])
  emitConfigUpdated('bracket', championship)
  res.status(204).send()
})

export default router
