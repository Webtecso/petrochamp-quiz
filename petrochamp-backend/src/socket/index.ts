import { randomUUID } from 'crypto'
import type { Server, Socket } from 'socket.io'
import { prisma } from '../db'
import { getEligibleTeams } from '../routes/repescagem'
import { syncPresentationDuplasForRound, getBracketRoundForPhaseOrder } from '../routes/bracketLive'
import {
  liveState,
  resetMatch,
  resetAnswerState,
  resetPresentationFlow,
  generateJoinCode,
  addToPhaseRanking,
  addToChampionshipRanking,
  persistLiveState,
  type PodiumEntry
} from './liveState'

let timerHandle: ReturnType<typeof setInterval> | null = null
let countdownHandle: ReturnType<typeof setInterval> | null = null
let partnersTimerHandle: ReturnType<typeof setTimeout> | null = null
let partnersNextStep: (() => void | Promise<void>) | null = null

function scheduleInstitutionalStep(fn: () => void | Promise<void>, ms: number): void {
  partnersNextStep = fn
  partnersTimerHandle = setTimeout(() => {
    partnersNextStep = null
    fn()
  }, ms)
}
let moderatorSocketId: string | null = null
let moderatorRegisteredEver = false

const RESTRICTED_TO_PRINCIPAL = new Set([
  'moderator:selectChampionship',
  'moderator:finalizeChampionship',
  'moderator:openRepescagemVoting',
  'moderator:showPodium',
  'moderator:hidePodium',
  'moderator:startFinalPodiumSequence'
])

const RESTRICTED_TO_AREA: Record<string, string> = {
  'moderator:selectTeams': 'quiz',
  'moderator:startTimer': 'quiz',
  'moderator:pauseTimer': 'quiz',
  'moderator:nextQuestion': 'quiz',
  'moderator:forceQuestion': 'quiz',
  'moderator:addScore': 'quiz',
  'moderator:endOpenQuestion': 'quiz',
  'moderator:analyticNextPage': 'quiz',
  'moderator:analyticPrevPage': 'quiz',
  'moderator:startTiebreak': 'quiz',
  'moderator:finishMatch': 'quiz',
  'moderator:confirmQuizIntro': 'quiz',
  'moderator:continueAfterRepescagem': 'quiz',
  'moderator:showPartners': 'quiz',
  'moderator:startNextPhase': 'quiz',
  'moderator:startQuizPhase': 'apresentacao',
  'moderator:advancePhase': 'quiz',
  'moderator:showPhaseRanking': 'quiz',
  'moderator:hidePhaseRanking': 'quiz',
  'moderator:showPhaseTransition': 'quiz',
  'moderator:hidePhaseTransition': 'quiz',
  'moderator:startPresentation': 'apresentacao',
  'moderator:finishPresentation': 'apresentacao',
  'moderator:presentationNextPage': 'apresentacao',
  'moderator:presentationPrevPage': 'apresentacao',
  'moderator:advanceToNextPresentation': 'apresentacao',
  'moderator:confirmPresentationRanking': 'apresentacao',
  'moderator:removeJuror': 'jurados',
  'moderator:confirmEvaluation': 'jurados',
  'moderator:confirmInitialScores': 'jurados',
  'moderator:registerJurorLocally': 'jurados',
  'moderator:closeRepescagemVoting': 'repescagem'
}

function hasRegisteredModerators(): boolean {
  return liveState.activeModerators.length > 0 || moderatorRegisteredEver
}

async function getQuestionTimeSeconds(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'questionTimeSeconds' } })
  return row ? Number(row.value) : 30
}

async function getMaxJurors(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'maxJurors' } })
  return row ? Number(row.value) : 5
}

async function getPartnersDurationSeconds(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: 'partnersDurationSeconds' } })
  return row ? Number(row.value) : 20
}

async function getTiebreakConfig(): Promise<{ autoEnabled: boolean; method: string }> {
  const rows = await prisma.setting.findMany({
    where: { key: { in: ['tiebreakAutoEnabled', 'tiebreakMethod'] } }
  })
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  return {
    autoEnabled: (map.tiebreakAutoEnabled ?? 'false') === 'true',
    method: map.tiebreakMethod ?? 'quiz'
  }
}

async function drawThirdPlaceQuestion(): Promise<void> {
  const pool = await prisma.tiebreakQuestion.findMany({
    where: { championship: liveState.championship ?? undefined, deletedAt: null }
  })
  const available = pool.filter(
    (q) => !liveState.thirdPlaceTiebreak.usedQuestionIds.includes(q.id)
  )
  const finalPool = available.length > 0 ? available : pool
  if (finalPool.length === 0) {
    liveState.thirdPlaceTiebreak.currentQuestionId = null
    return
  }
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)]
  liveState.thirdPlaceTiebreak.currentQuestionId = chosen.id
  liveState.thirdPlaceTiebreak.usedQuestionIds.push(chosen.id)
}

async function getCurrentPhaseConfig() {
  return prisma.phase.findFirst({
    where: {
      order: liveState.phase,
      championship: liveState.championship ?? undefined,
      deletedAt: null
    }
  })
}

async function getTotalPhases(): Promise<number> {
  const count = await prisma.phase.count({
    where: { championship: liveState.championship ?? undefined, deletedAt: null }
  })
  return count > 0 ? count : 1
}

function labelToIndex(label: string | null): number {
  if (!label) return -1
  return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(label)
}

function parseCorrectIndexes(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number) : []
  } catch {
    return []
  }
}

async function isRoundComplete(championship: string, round: number): Promise<boolean> {
  const pending = await prisma.bracketMatch.count({
    where: { championship, round, winnerId: null, teamAId: { not: null }, teamBId: { not: null } }
  })
  return pending === 0
}

async function getPresentationTeamIds(phaseId: string): Promise<string[]> {
  // CORRIGIDO — faltava o filtro deletedAt: null (já usado em
  // syncPresentationDuplasForRound, em bracketLive.ts, para a mesma
  // tabela). Sem isto, duplas apagadas por soft-delete continuavam a
  // contar para o total de equipas esperadas nesta fase, fazendo
  // allPresentedAndEvaluated nunca ficar true — presentationRoundReady
  // ficava preso em false para sempre, e o botão "Ir para o Ranking"
  // parecia não fazer nada (o evento chegava ao servidor mas era
  // ignorado pela guarda "if (!liveState.presentationRoundReady) return").
  const duplas = await prisma.presentationDupla.findMany({ where: { phaseId, deletedAt: null } })
  const ids = new Set<string>()
  for (const d of duplas) {
    ids.add(d.teamAId)
    if (d.teamBId) ids.add(d.teamBId)
  }
  return Array.from(ids)
}

async function getExpectedJurorCount(phaseId: string): Promise<number> {
  const authCount = await prisma.phaseJurorAuthorization.count({
    where: { phaseId, deletedAt: null }
  })
  if (authCount > 0) return authCount
  return prisma.juror.count({ where: { deletedAt: null } })
}

async function refreshExpectedJurorCount(): Promise<void> {
  const phaseConfig = await getCurrentPhaseConfig()
  liveState.expectedJurorCount = phaseConfig ? await getExpectedJurorCount(phaseConfig.id) : 0
}

function clearActiveChampionshipState(): void {
  liveState.championship = null
  liveState.editionName = null
  liveState.phase = 1
  liveState.teamA = null
  liveState.teamB = null
  liveState.phaseRankings = []
  liveState.championshipRankings = []
  liveState.championshipStartedAt = null
  liveState.eliminatedTeamIds = []
  liveState.phaseRankingReveal = { visible: false }
  liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
  liveState.presentationPhaseScores = []
  liveState.carriedPresentationScores = []
  liveState.jurors = []
  liveState.jurorEntries = []
  resetPresentationFlow()
  liveState.bracketVisible = false
  liveState.podium.active = false
  liveState.podiumReveal = {
    stage: 'idle',
    countdownValue: 0,
    suspensePhrase: null,
    finalRankingVisible: false
  }
  liveState.phaseTransition = { stage: 'idle' }
  liveState.expectedJurorCount = 0
  liveState.championReveal = { active: false, teamName: null, logoUrl: null }
}

async function startPostRoundSequence(): Promise<void> {
  if (!liveState.championship) return
  const totalPhases = await getTotalPhases()
  const isLastPhase = liveState.phase >= totalPhases
  const pendingRepescagem = await prisma.repescagemConfig.findFirst({
    where: { championship: liveState.championship, phase: liveState.phase, started: false }
  })
  liveState.phaseFlow = {
    stage: pendingRepescagem ? 'repescagem' : isLastPhase ? 'partnersPending' : 'ranking',
    suspensePhrase: null
  }
  liveState.bracketVisible = false
}

function applyPresentationWeighting(phaseConfig: {
  presentationWeight: number | null
  quizWeight: number | null
}): void {
  const presentationWeight = phaseConfig.presentationWeight ?? 50
  const quizWeight = phaseConfig.quizWeight ?? 50
  const totalWeight = presentationWeight + quizWeight || 1

  for (const presEntry of liveState.presentationPhaseScores) {
    const phaseEntry = liveState.phaseRankings.find((r) => r.teamId === presEntry.teamId)
    const champEntry = liveState.championshipRankings.find((r) => r.teamId === presEntry.teamId)
    const quizScore = phaseEntry?.score ?? 0
    const weighted = (quizScore * quizWeight + presEntry.score * presentationWeight) / totalWeight
    const delta = weighted - quizScore
    if (phaseEntry) phaseEntry.score += delta
    if (champEntry) champEntry.score += delta
  }
}

async function triggerFinalPodiumSequence(broadcast: () => void): Promise<void> {
  const phrase = await pickSuspensePhrase()
  liveState.podiumReveal.stage = 'suspense'
  liveState.podiumReveal.suspensePhrase = phrase
  liveState.podiumReveal.finalRankingVisible = false
  liveState.phaseRankingReveal = { visible: false }
  liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
  broadcast()
  setTimeout(() => {
    liveState.podiumReveal.stage = 'countdown'
    liveState.podiumReveal.countdownValue = 10
    broadcast()
    const interval = setInterval(async () => {
      liveState.podiumReveal.countdownValue -= 1
      if (liveState.podiumReveal.countdownValue <= 0) {
        clearInterval(interval)
        const ranked = [...liveState.championshipRankings].sort((a, b) => b.score - a.score)
        const thirdEntry = ranked[2]
        const fourthEntry = ranked[3]
        const tiebreakConfig = await getTiebreakConfig()

        if (
          tiebreakConfig.autoEnabled &&
          thirdEntry &&
          fourthEntry &&
          thirdEntry.score === fourthEntry.score
        ) {
          liveState.thirdPlaceTiebreak = {
            active: false,
            teamAId: thirdEntry.teamId,
            teamBId: fourthEntry.teamId,
            teamAName: thirdEntry.name,
            teamBName: fourthEntry.name,
            teamAInstitution: thirdEntry.institution,
            teamBInstitution: fourthEntry.institution,
            currentQuestionId: null,
            usedQuestionIds: [],
            teamAAnswer: null,
            teamBAnswer: null,
            teamACorrect: null,
            teamBCorrect: null,
            winnerId: null
          }
          liveState.podiumReveal.stage = 'awaitingTiebreak'
          broadcast()
          return
        }

        const top3 = ranked.slice(0, 3).map((r) => ({
          id: r.teamId,
          name: r.name,
          institution: r.institution,
          score: r.score
        }))
        liveState.podium.active = true
        liveState.podium.phaseNumber = liveState.phase
        liveState.podium.phaseLabel = 'Grande Final'
        liveState.podium.entries = top3
        liveState.podium.isGrandFinal = true
        liveState.podiumReveal.stage = 'revealed'
        broadcast()
      } else {
        broadcast()
      }
    }, 1000)
  }, 4000)
}

type PoolItem =
  | { source: 'question'; id: string; timeSeconds: number; scope: 'single' }
  | {
      source: 'analytic'
      id: string
      timeSeconds: number
      scope: 'single' | 'all'
      mode: 'multipla_escolha' | 'aberta'
    }

async function buildPool(): Promise<PoolItem[]> {
  const [questions, analyticItems, defaultTime] = await Promise.all([
    prisma.question.findMany({
      where: { phase: liveState.phase, championship: liveState.championship ?? undefined, deletedAt: null }
    }),
    prisma.evaluationItem.findMany({
      where: {
        phase: liveState.phase,
        championship: liveState.championship ?? undefined,
        type: 'analitica',
        deletedAt: null
      }
    }),
    getQuestionTimeSeconds()
  ])
  const pool: PoolItem[] = questions
    .filter((q) => !liveState.usedQuestionIds.includes(q.id))
    .map((q) => ({ source: 'question', id: q.id, timeSeconds: defaultTime, scope: 'single' }))
  for (const item of analyticItems) {
    if (liveState.usedAnalyticItemIds.includes(item.id)) continue
    pool.push({
      source: 'analytic',
      id: item.id,
      timeSeconds: item.timeSeconds ?? defaultTime,
      scope: item.scope === 'all' ? 'all' : 'single',
      mode: item.mode === 'multipla_escolha' ? 'multipla_escolha' : 'aberta'
    })
  }
  return pool
}

let isDrawingNextItem = false

// NOVO - lock de reentrancia. Duas chamadas quase simultaneas a drawNextItem
// (ex: duplo clique em "proxima pergunta", ou evento repetido por lentidao
// de rede) liam o mesmo pool antes de qualquer uma escrever em
// liveState.usedQuestionIds, podendo escolher a mesma pergunta. Este wrapper
// ignora silenciosamente qualquer chamada que chegue enquanto uma anterior
// ainda esta a decorrer, sem alterar a logica de sorteio em si.
async function drawNextItem(team: 'A' | 'B'): Promise<void> {
  if (isDrawingNextItem) {
    console.warn('[drawNextItem] chamada ignorada - ja existe um sorteio em curso')
    return
  }
  isDrawingNextItem = true
  try {
    await drawNextItemInner(team)
  } finally {
    isDrawingNextItem = false
  }
}

async function drawNextItemInner(team: 'A' | 'B'): Promise<void> {
  const phaseConfig = await getCurrentPhaseConfig()
  const avoidRepeat = phaseConfig?.avoidRepeatQuestions ?? true

  // NOVO - modo "por equipa": consome QuestionAssignment em vez do pool
  // aleatorio. Nao mexe em usedQuestionIds/buildPool (o modo automatico
  // continua identico); usa o campo usedAt da propria atribuicao.
  if (phaseConfig?.questionSelectionMode === 'per_team') {
    const teamEntity = team === 'A' ? liveState.teamA : liveState.teamB
    if (!teamEntity || !phaseConfig?.id) {
      liveState.currentQuestionId = null
      liveState.currentItemSource = null
      liveState.currentAnalyticItemId = null
      liveState.currentItemMode = null
      return
    }
    const allAssignmentsForTeamPhase = await prisma.questionAssignment.findMany({
      where: { phaseId: phaseConfig.id, teamId: teamEntity.id, deletedAt: null }
    })
    const nextAssignment = await prisma.questionAssignment.findFirst({
      where: {
        phaseId: phaseConfig.id,
        teamId: teamEntity.id,
        deletedAt: null,
        usedAt: null
      },
      orderBy: { order: 'asc' },
      include: { question: true }
    })
    if (!nextAssignment) {
      liveState.currentQuestionId = null
      liveState.currentItemSource = null
      liveState.currentAnalyticItemId = null
      liveState.currentItemMode = null
      return
    }
    const defaultTime = await getQuestionTimeSeconds()
    await prisma.questionAssignment.update({
      where: { id: nextAssignment.id },
      data: { usedAt: new Date() }
    })
    liveState.currentQuestionIndex += 1
    liveState.isRunning = false
    liveState.awaitingJuryEvaluation = false
    resetAnswerState()
    liveState.currentItemSource = 'question'
    liveState.currentItemMode = null
    liveState.currentQuestionId = nextAssignment.questionId
    liveState.currentAnalyticItemId = null
    liveState.usedQuestionIds.push(nextAssignment.questionId)
    liveState.activeTeam = team
    liveState.timeLeft = defaultTime
    return
  }

  let pool = await buildPool()
  if (avoidRepeat && pool.length === 0) {
    liveState.usedQuestionIds = []
    liveState.usedAnalyticItemIds = []
    pool = await buildPool()
  } else if (!avoidRepeat) {
    const [questions, analyticItems, defaultTime] = await Promise.all([
      prisma.question.findMany({
        where: { phase: liveState.phase, championship: liveState.championship ?? undefined, deletedAt: null }
      }),
      prisma.evaluationItem.findMany({
        where: {
          phase: liveState.phase,
          championship: liveState.championship ?? undefined,
          type: 'analitica',
          deletedAt: null
        }
      }),
      getQuestionTimeSeconds()
    ])
    pool = [
      ...questions.map((q) => ({
        source: 'question' as const,
        id: q.id,
        timeSeconds: defaultTime,
        scope: 'single' as const
      })),
      ...analyticItems.map((it) => ({
        source: 'analytic' as const,
        id: it.id,
        timeSeconds: it.timeSeconds ?? defaultTime,
        scope: (it.scope === 'all' ? 'all' : 'single') as 'single' | 'all',
        mode: (it.mode === 'multipla_escolha' ? 'multipla_escolha' : 'aberta') as
          'multipla_escolha' | 'aberta'
      }))
    ]
  }

  if (pool.length === 0) {
    liveState.currentQuestionId = null
    liveState.currentItemSource = null
    liveState.currentAnalyticItemId = null
    liveState.currentItemMode = null
    return
  }

  const chosen = pool[Math.floor(Math.random() * pool.length)]
  liveState.currentQuestionIndex += 1
  liveState.isRunning = false
  liveState.awaitingJuryEvaluation = false
  resetAnswerState()

  if (chosen.source === 'question') {
    liveState.currentItemSource = 'question'
    liveState.currentItemMode = null
    liveState.currentQuestionId = chosen.id
    liveState.currentAnalyticItemId = null
    liveState.usedQuestionIds.push(chosen.id)
    liveState.activeTeam = team
  } else {
    liveState.currentItemSource = 'analytic'
    liveState.currentItemMode = chosen.mode
    liveState.currentAnalyticItemId = chosen.id
    liveState.currentQuestionId = null
    liveState.analyticQuestionPage = 1
    liveState.usedAnalyticItemIds.push(chosen.id)
    liveState.activeTeam = team
    // Inicializa o estado de avaliação analítica para esta pergunta
    liveState.analyticEvaluation = {
      itemId: chosen.id,
      criteriaScores: [],
      jurorsSubmitted: [],
      expectedJurorCount: liveState.expectedJurorCount
    }
  }
  liveState.timeLeft = chosen.timeSeconds
}

async function roundQuestionsComplete(): Promise<boolean> {
  const phaseConfig = await getCurrentPhaseConfig()
  if (!phaseConfig?.questionsPerTeam) return false
  return (
    liveState.teamAAnsweredCount >= phaseConfig.questionsPerTeam &&
    liveState.teamBAnsweredCount >= phaseConfig.questionsPerTeam
  )
}

async function recordBracketResult(
  championship: string,
  teamAId: string,
  teamBId: string,
  winnerId: string
): Promise<void> {
  const match = await prisma.bracketMatch.findFirst({
    where: {
      championship,
      winnerId: null,
      OR:
        teamAId === teamBId
          ? [
              { teamAId, teamBId: null },
              { teamAId: null, teamBId: teamAId }
            ]
          : [
              { teamAId, teamBId },
              { teamAId: teamBId, teamBId: teamAId }
            ]
    }
  })
  if (!match) return
  await prisma.bracketMatch.update({ where: { id: match.id }, data: { winnerId } })
  const nextSlot = Math.floor(match.slot / 2)
  const nextMatch = await prisma.bracketMatch.findFirst({
    where: { championship, round: match.round + 1, slot: nextSlot }
  })
  if (nextMatch) {
    const isFirstChild = match.slot % 2 === 0
    await prisma.bracketMatch.update({
      where: { id: nextMatch.id },
      data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
    })
    await syncPresentationDuplasForRound(championship, nextMatch.round)
  }
}

async function recordRepescagemResult(
  teamAId: string,
  teamBId: string,
  winnerId: string
): Promise<void> {
  const match = await prisma.bracketMatch.findFirst({
    where: {
      championship: { contains: '__repescagem__' },
      winnerId: null,
      OR: [
        { teamAId, teamBId },
        { teamAId: teamBId, teamBId: teamAId }
      ]
    }
  })
  if (!match) return
  await prisma.bracketMatch.update({ where: { id: match.id }, data: { winnerId } })
  const nextSlot = Math.floor(match.slot / 2)
  const nextMatch = await prisma.bracketMatch.findFirst({
    where: { championship: match.championship, round: match.round + 1, slot: nextSlot }
  })
  if (nextMatch) {
    const isFirstChild = match.slot % 2 === 0
    await prisma.bracketMatch.update({
      where: { id: nextMatch.id },
      data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
    })
  }
}

async function drawTiebreakQuestion(): Promise<void> {
  const pool = await prisma.tiebreakQuestion.findMany({
    where: { phase: liveState.phase, championship: liveState.championship ?? undefined, deletedAt: null }
  })
  const available = pool.filter((q) => !liveState.tiebreak.usedQuestionIds.includes(q.id))
  const finalPool = available.length > 0 ? available : pool
  if (finalPool.length === 0) {
    liveState.tiebreak.currentQuestionId = null
    return
  }
  const chosen = finalPool[Math.floor(Math.random() * finalPool.length)]
  liveState.tiebreak.currentQuestionId = chosen.id
  liveState.tiebreak.usedQuestionIds.push(chosen.id)
}

// NOVO - alvo de caracteres por pagina de um enunciado analitico. Calibrado
// para a card da Projecao/Moderador manter uma fonte confortavel sem scroll.
const ANALYTIC_PAGE_MAX_CHARS = 420

// NOVO - divide um enunciado longo em paginas legiveis para a Projecao,
// sem cortar a meio de uma palavra ou (sempre que possivel) a meio de uma
// frase. maxChars e um alvo, nao um limite rigido: a funcao so corta numa
// fronteira de frase/espaco proxima desse alvo.
function paginateText(text: string, maxChars: number): string[] {
  const trimmed = (text ?? '').trim()
  if (trimmed.length <= maxChars) return [trimmed]

  const pages: string[] = []
  let rest = trimmed

  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars + 1)

    // Preferimos cortar depois de um fim de frase (. ; ! ?) dentro da fatia.
    let cutIndex = -1
    const sentenceEnders = ['. ', '; ', '! ', '? ']
    for (const ender of sentenceEnders) {
      const idx = slice.lastIndexOf(ender)
      if (idx > cutIndex) cutIndex = idx + ender.length
    }

    // Sem fronteira de frase razoavel: corta no ultimo espaco antes do alvo,
    // para nunca partir uma palavra a meio.
    if (cutIndex <= 0 || cutIndex < maxChars * 0.4) {
      const lastSpace = slice.lastIndexOf(' ')
      cutIndex = lastSpace > 0 ? lastSpace + 1 : maxChars
    }

    pages.push(rest.slice(0, cutIndex).trim())
    rest = rest.slice(cutIndex).trim()
  }

  if (rest.length > 0) pages.push(rest)
  return pages
}

async function pickSuspensePhrase(): Promise<string> {
  const phrases = await prisma.suspensePhrase.findMany()
  return phrases.length
    ? phrases[Math.floor(Math.random() * phrases.length)].text
    : 'Preparem-se - a próxima fase está prestes a começar...'
}

async function tryResolveBracketForPresentationPhase(phaseConfig: {
  id: string
  type: string
  noElimination: boolean | null
}): Promise<void> {
  // Só se aplica a fases "apresentacao" isoladas COM eliminação.
  // "apresentacao_quiz" e "apresentacao" com noElimination já têm os
  // seus próprios fluxos (ponderação com o quiz / transporte de nota).
  if (phaseConfig.type !== 'apresentacao' || phaseConfig.noElimination) return
  if (!liveState.championship) return

  const duplas = await prisma.presentationDupla.findMany({
    where: { phaseId: phaseConfig.id, deletedAt: null }
  })

  for (const d of duplas) {
    if (!d.teamBId) continue // apresentação individual, sem confronto a decidir

    const scoreA = liveState.phaseRankings.find((r) => r.teamId === d.teamAId)?.score
    const scoreB = liveState.phaseRankings.find((r) => r.teamId === d.teamBId)?.score
    if (scoreA === undefined || scoreB === undefined) continue // falta uma das equipas avaliar

    const alreadyResolved = await prisma.bracketMatch.findFirst({
      where: {
        championship: liveState.championship,
        winnerId: { not: null },
        OR: [
          { teamAId: d.teamAId, teamBId: d.teamBId },
          { teamAId: d.teamBId, teamBId: d.teamAId }
        ]
      }
    })
    if (alreadyResolved) continue

    const winnerId = scoreA >= scoreB ? d.teamAId : d.teamBId
    const loserId = winnerId === d.teamAId ? d.teamBId : d.teamAId

    await recordBracketResult(liveState.championship, d.teamAId, d.teamBId, winnerId)
    if (!liveState.eliminatedTeamIds.includes(loserId)) {
      liveState.eliminatedTeamIds.push(loserId)
    }
  }
}

async function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {
  const flow = liveState.presentationFlow
  if (flow.stage !== 'concluded' || !flow.teamId) return
  if (flow.allJurorsSubmitted) return

  const connectedCount = liveState.jurors.length
  const target =
    liveState.expectedJurorCount > 0 ? liveState.expectedJurorCount : connectedCount

  if (target <= 0) return
  if (flow.jurorsSubmitted.length < target) return

  flow.allJurorsSubmitted = true
  broadcast()

  const validCriteriaScores = flow.criteriaScores.filter((e) => !!e.criteriaId)

  const totalsByJuror = new Map<string, number>()
  for (const entry of validCriteriaScores) {
    totalsByJuror.set(entry.jurorId, (totalsByJuror.get(entry.jurorId) ?? 0) + entry.score)
  }
  const totals = Array.from(totalsByJuror.values())
  const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0

  await Promise.all(
    validCriteriaScores.map((entry) =>
      prisma.presentationScore
        .upsert({
          where: {
            criteriaId_jurorId_teamId: {
              criteriaId: entry.criteriaId,
              jurorId: entry.jurorId,
              teamId: flow.teamId!
            }
          },
          update: { score: entry.score },
          create: {
            criteriaId: entry.criteriaId,
            jurorId: entry.jurorId,
            teamId: flow.teamId!,
            score: entry.score
          }
        })
        .catch((err) =>
          console.error(
            '[checkAllJurorsSubmitted] Falha ao gravar nota (ignorada, a continuar):',
            err
          )
        )
    )
  )

  const team = await prisma.team.findUnique({ where: { id: flow.teamId } })
  const phaseConfig = await getCurrentPhaseConfig()

  if (phaseConfig?.type === 'apresentacao_quiz') {
    // Legado: só guarda média para ponderar depois com o quiz da mesma fase
    const existingPresScore = liveState.presentationPhaseScores.find(
      (r) => r.teamId === flow.teamId
    )
    if (existingPresScore) {
      existingPresScore.score = average
    } else if (team) {
      liveState.presentationPhaseScores.push({
        teamId: team.id,
        name: team.name,
        institution: team.institution,
        score: average
      })
    }
  } else if (phaseConfig?.type === 'apresentacao' && phaseConfig.noElimination) {
    // Apresentação sem eliminação: ranking + nota para o quiz seguinte
    addToPhaseRanking(team, average)
    if (team) {
      const existingCarried = liveState.carriedPresentationScores.find(
        (r) => r.teamId === team.id
      )
      const presentationWeight = phaseConfig.presentationWeight ?? 50
      const quizWeight = phaseConfig.quizWeight ?? 50
      if (existingCarried) {
        existingCarried.score = average
        existingCarried.presentationWeight = presentationWeight
        existingCarried.quizWeight = quizWeight
      } else {
        liveState.carriedPresentationScores.push({
          teamId: team.id,
          name: team.name,
          institution: team.institution,
          score: average,
          presentationWeight,
          quizWeight
        })
      }
    }
  } else if (phaseConfig?.type === 'apresentacao') {
    // Apresentação isolada COM eliminação: grava nota e, assim que
    // ambas as equipas da mesma dupla tiverem nota, decide o vencedor
    // e propaga para o BracketMatch (tal como o Quiz já faz).
    addToPhaseRanking(team, average)
    addToChampionshipRanking(team, average)
    await tryResolveBracketForPresentationPhase(phaseConfig)
  } else {
    // Outros tipos legados: só ranking, sem tocar no bracket aqui
    addToPhaseRanking(team, average)
    addToChampionshipRanking(team, average)
  }

  if (phaseConfig) {
    const allTeamIds = await getPresentationTeamIds(phaseConfig.id)
    const recordedTeamIds =
      phaseConfig.type === 'apresentacao_quiz'
        ? liveState.presentationPhaseScores.map((r) => r.teamId)
        : liveState.phaseRankings.map((r) => r.teamId)
    const allPresentedAndEvaluated =
      allTeamIds.length > 0 && allTeamIds.every((id) => recordedTeamIds.includes(id))

    if (allPresentedAndEvaluated) {
      if (phaseConfig.type === 'apresentacao') {
        liveState.presentationRoundReady = true
      } else if (phaseConfig.type === 'apresentacao_quiz') {
        liveState.phaseFlow = { stage: 'presentationRanking', suspensePhrase: null }
      }
    }
  }
}

async function applyEvaluationConfirmation(itemId: string): Promise<void> {
  if (liveState.jurorSubmittedItemIds.includes(itemId)) return

  if (liveState.expectedJurorCount > 0) {
    if (liveState.jurors.length < liveState.expectedJurorCount) return
    const missing = liveState.jurors.some(
      (j) => !liveState.jurorEntries.some((e) => e.jurorId === j.id && e.itemId === itemId)
    )
    if (missing) return
  }

  const relevant = liveState.jurorEntries.filter((e) => e.itemId === itemId)
  const totalA = relevant.reduce((sum, e) => sum + e.scoreA, 0)
  const totalB = relevant.reduce((sum, e) => sum + e.scoreB, 0)
  liveState.teamAScore += totalA
  liveState.teamBScore += totalB
  liveState.jurorSubmittedItemIds.push(itemId)

  const wasActiveDraw =
    liveState.currentItemSource === 'analytic' &&
    liveState.currentAnalyticItemId === itemId &&
    liveState.awaitingJuryEvaluation

  if (wasActiveDraw) {
    liveState.teamAAnsweredCount += 1
    liveState.teamBAnsweredCount += 1
    liveState.awaitingJuryEvaluation = false
    liveState.currentItemSource = null
    liveState.currentAnalyticItemId = null
    liveState.currentItemMode = null

    if (await roundQuestionsComplete()) {
      liveState.currentQuestionId = null
    } else {
      const nextTeam = liveState.activeTeam === 'A' ? 'B' : 'A'
      await drawNextItem(nextTeam)
    }
  }
}

async function checkAutoConfirmOpenItem(broadcast: () => void): Promise<void> {
  if (!liveState.awaitingJuryEvaluation) return
  if (liveState.currentItemSource !== 'analytic' || !liveState.currentAnalyticItemId) return

  const itemId = liveState.currentAnalyticItemId
  if (liveState.jurorSubmittedItemIds.includes(itemId)) return

  const connectedCount = liveState.jurors.length
  const target =
    liveState.expectedJurorCount > 0 ? liveState.expectedJurorCount : connectedCount

  if (target <= 0) return

  const submittedCount = liveState.jurors.filter((j) =>
    liveState.jurorEntries.some((e) => e.jurorId === j.id && e.itemId === itemId)
  ).length

  if (submittedCount < target) return

  await applyEvaluationConfirmation(itemId)
  broadcast()
}

export function registerSocketHandlers(io: Server): void {
  function broadcast(): void {
    io.emit('state:sync', liveState)
    persistLiveState()
  }

  if (!timerHandle) {
    timerHandle = setInterval(() => {
      let changed = false
      if (liveState.isRunning) {
        if (liveState.timeLeft > 0) {
          liveState.timeLeft -= 1
        } else {
          liveState.isRunning = false
          if (
            liveState.currentItemSource === 'analytic' &&
            liveState.currentItemMode === 'aberta'
          ) {
            liveState.awaitingJuryEvaluation = true
          }
        }
        changed = true
      }
      if (
        liveState.presentationFlow.stage === 'presenting' &&
        liveState.presentationFlow.timeLeft > 0
      ) {
        liveState.presentationFlow.timeLeft -= 1
        changed = true
      }
      if (changed) broadcast()

      if (liveState.awaitingJuryEvaluation) {
        checkAutoConfirmOpenItem(broadcast)
      }
    }, 1000)
  }

  function startCountdown(seconds: number, onComplete: () => Promise<void>): void {
    if (countdownHandle) clearInterval(countdownHandle)
    liveState.countdown = { active: true, value: seconds }
    broadcast()
    countdownHandle = setInterval(() => {
      liveState.countdown.value -= 1
      if (liveState.countdown.value <= 0) {
        if (countdownHandle) clearInterval(countdownHandle)
        countdownHandle = null
        liveState.countdown.active = false
        onComplete().then(broadcast)
      } else {
        broadcast()
      }
    }, 1000)
  }

  // NOVO - grace period antes de expulsar um jurado que desligou.
  // Sem isto, qualquer soluco de rede (Wi-Fi instavel em eventos ao vivo)
  // fazia o backend apagar o jurado de liveState.jurors/jurorEntries no
  // 'disconnect' imediato, mesmo que o socket.io do cliente reconectasse
  // sozinho 1-2 segundos depois com um socket.id novo - o jurado tinha de
  // fazer login outra vez e uma nota a meio de ser enviada perdia-se.
  const jurorDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const JUROR_DISCONNECT_GRACE_MS = 25000

  io.on('connection', (socket: Socket) => {
    console.log('Cliente ligado:', socket.id)
    socket.emit('state:sync', liveState)

    socket.on(
      'moderator:register',
      async (payload: { code: string }, callback?: (res: unknown) => void) => {
        const code = (payload.code || '').trim()
        const moderator = await prisma.moderator.findUnique({
          where: { code },
          include: { areas: true }
        })
        if (!moderator) {
          callback?.({ success: false, error: 'Código de moderador inválido.' })
          return
        }
        socket.data.moderatorId = moderator.id
        socket.data.moderatorRole = moderator.role
        socket.data.moderatorAreas = moderator.areas.map((a) => a.area)
        moderatorRegisteredEver = true
        if (!liveState.activeModerators.some((m) => m.id === moderator.id)) {
          liveState.activeModerators.push({
            id: moderator.id,
            name: moderator.name,
            role: moderator.role === 'principal' ? 'principal' : 'secundario'
          })
        }
        broadcast()
        callback?.({
          success: true,
          moderatorId: moderator.id,
          role: moderator.role,
          name: moderator.name,
          areas: moderator.areas.map((a) => a.area)
        })
      }
    )

    socket.use(([eventName, ...args], next) => {
      const maybeCallback = args[args.length - 1]
      const respondBlocked = (message: string): void => {
        if (typeof maybeCallback === 'function') {
          maybeCallback({ success: false, error: message })
        }
      }

      if (RESTRICTED_TO_PRINCIPAL.has(eventName)) {
        if (!hasRegisteredModerators()) {
          next()
          return
        }
        if (socket.data.moderatorRole === 'principal') {
          next()
          return
        }
        console.log(
          `Ação restrita a Principal bloqueada: ${eventName} (socket ${socket.id} não é Principal)`
        )
        respondBlocked('Esta ação só pode ser feita pelo Moderador Principal.')
        return
      }

      const requiredArea = RESTRICTED_TO_AREA[eventName]
      if (requiredArea) {
        if (!hasRegisteredModerators()) {
          next()
          return
        }
        if (socket.data.moderatorRole === 'principal') {
          next()
          return
        }
        const areas: string[] = socket.data.moderatorAreas || []
        if (areas.includes(requiredArea)) {
          next()
          return
        }
        console.log(`Ação sem área "${requiredArea}" bloqueada: ${eventName} (socket ${socket.id})`)
        respondBlocked(
          `Este moderador não tem a área "${requiredArea}" atribuída. Vai a Admin → Moderadores para autorizar.`
        )
        return
      }

      next()
    })

    socket.on('moderator:enterAdmin', () => {
      moderatorSocketId = socket.id
      const hasActivity =
        (!!liveState.teamA && !!liveState.teamB) || liveState.presentationFlow.stage !== 'idle'
      if (hasActivity && !liveState.moderatorAdjusting) {
        liveState.moderatorAdjusting = true
        broadcast()
      }
    })

    socket.on('moderator:exitAdmin', () => {
      if (liveState.moderatorAdjusting) {
        liveState.moderatorAdjusting = false
        broadcast()
      }
    })

    socket.on(
      'moderator:selectChampionship',
      async (
        payload: { championship: string; editionName?: string },
        callback?: (ok: boolean) => void
      ) => {
        const championship = payload.championship

        // Limpar vencedores / slots avançados (mantém estrutura da ronda 1)
        await prisma.bracketMatch.updateMany({
          where: { championship, round: { gt: 1 } },
          data: { teamAId: null, teamBId: null, winnerId: null }
        })
        await prisma.bracketMatch.updateMany({
          where: { championship, round: 1 },
          data: { winnerId: null }
        })

        liveState.championship = championship
        liveState.editionName = payload.editionName || null
        liveState.phase = 1
        liveState.teamA = null
        liveState.teamB = null
        liveState.teamAScore = 0
        liveState.teamBScore = 0
        liveState.phaseRankings = []
        liveState.championshipRankings = []
        liveState.championshipStartedAt = Date.now()
        liveState.usedQuestionIds = []
        liveState.eliminatedTeamIds = []
        liveState.phaseRankingReveal = { visible: false }
        liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
        liveState.championReveal = { active: false, teamName: null, logoUrl: null }
        liveState.presentationPhaseScores = []
        liveState.carriedPresentationScores = []
        resetPresentationFlow()
        liveState.bracketVisible = true
        await refreshExpectedJurorCount()
        broadcast()
        callback?.(true)
      }
    )

    socket.on(
      'moderator:selectTeams',
      async (payload: { teamAId: string; teamBId: string }, callback?: (ok: boolean) => void) => {
        const [teamA, teamB] = await Promise.all([
          prisma.team.findUnique({ where: { id: payload.teamAId } }),
          prisma.team.findUnique({ where: { id: payload.teamBId } })
        ])
        if (!teamA || !teamB) {
          callback?.(false)
          return
        }
        liveState.teamA = teamA
        liveState.teamB = teamB
        liveState.teamAScore = 0
        liveState.teamBScore = 0
        liveState.teamAAnsweredCount = 0
        liveState.teamBAnsweredCount = 0
        liveState.currentQuestionIndex = 0
        liveState.matchStartedAt = Date.now()
        liveState.bracketVisible = false
        liveState.matchCodes = {
          teamACode: generateJoinCode(),
          teamBCode: generateJoinCode(),
          teamAConnected: false,
          teamBConnected: false,
          teamAPlayerName: null,
          teamBPlayerName: null
        }
        broadcast()
        callback?.(true)
        startCountdown(10, async () => {
          await drawNextItem('A')
        })
      }
    )

    socket.on('moderator:startTimer', () => {
      liveState.isRunning = true
      broadcast()
    })

    socket.on('moderator:pauseTimer', () => {
      liveState.isRunning = false
      broadcast()
    })

    socket.on('moderator:nextQuestion', async () => {
      const otherTeam = liveState.activeTeam === 'A' ? 'B' : 'A'
      await drawNextItem(otherTeam)
      broadcast()
    })

    socket.on('moderator:forceQuestion', async (payload: { questionId: string }) => {
      const question = await prisma.question.findUnique({ where: { id: payload.questionId } })
      if (!question || question.phase !== liveState.phase) return
      liveState.currentItemSource = 'question'
      liveState.currentAnalyticItemId = null
      liveState.currentQuestionId = payload.questionId
      if (!liveState.usedQuestionIds.includes(payload.questionId)) {
        liveState.usedQuestionIds.push(payload.questionId)
      }
      liveState.timeLeft = await getQuestionTimeSeconds()
      liveState.isRunning = false
      resetAnswerState()
      broadcast()
    })

    socket.on('moderator:addScore', (payload: { team: 'A' | 'B'; amount: number }) => {
      if (payload.team === 'A') {
        liveState.teamAScore = Math.max(0, liveState.teamAScore + payload.amount)
      } else {
        liveState.teamBScore = Math.max(0, liveState.teamBScore + payload.amount)
      }
      broadcast()
    })

    socket.on('player:submitAnswer', async (payload: { team: 'A' | 'B'; optionLabel: string }) => {
      if (liveState.tiebreak.active) return

      if (liveState.currentItemSource === 'analytic') {
        if (liveState.currentItemMode === 'aberta') return
        if (!liveState.currentAnalyticItemId) return
        if (payload.team === 'A' && liveState.teamAAnswer) return
        if (payload.team === 'B' && liveState.teamBAnswer) return

        const item = await prisma.evaluationItem.findUnique({
          where: { id: liveState.currentAnalyticItemId }
        })
        if (!item) return
        if (item.scope !== 'all' && payload.team !== liveState.activeTeam) return

        if (payload.team === 'A') liveState.teamAAnswer = payload.optionLabel
        else liveState.teamBAnswer = payload.optionLabel

        const correctIdxs = parseCorrectIndexes(item.correctIndexes)
        const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel))
        if (payload.team === 'A') {
          liveState.teamACorrect = isCorrect
          liveState.teamAAnsweredCount += 1
          if (isCorrect) liveState.teamAScore += item.maxPoints
        } else {
          liveState.teamBCorrect = isCorrect
          liveState.teamBAnsweredCount += 1
          if (isCorrect) liveState.teamBScore += item.maxPoints
        }
        liveState.isRunning = false
        broadcast()

        const readyToAdvance =
          item.scope === 'all' ? liveState.teamAAnswer && liveState.teamBAnswer : true

        if (readyToAdvance) {
          setTimeout(async () => {
            if (await roundQuestionsComplete()) {
              liveState.currentQuestionId = null
              liveState.currentItemSource = null
              liveState.currentAnalyticItemId = null
              broadcast()
              return
            }
            const nextTeam = liveState.activeTeam === 'A' ? 'B' : 'A'
            await drawNextItem(nextTeam)
            broadcast()
          }, 2500)
        }
        return
      }

      if (payload.team !== liveState.activeTeam) return
      if (liveState.currentQuestionId === null) return
      if (payload.team === 'A' && liveState.teamAAnswer) return
      if (payload.team === 'B' && liveState.teamBAnswer) return

      if (payload.team === 'A') liveState.teamAAnswer = payload.optionLabel
      else liveState.teamBAnswer = payload.optionLabel

      const question = await prisma.question.findUnique({
        where: { id: liveState.currentQuestionId }
      })
      if (!question) {
        if (payload.team === 'A') liveState.teamAAnswer = null
        else liveState.teamBAnswer = null
        return
      }
      const correctIdxs = parseCorrectIndexes(question.correctIndexes)
      const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel))
      if (payload.team === 'A') {
        liveState.teamACorrect = isCorrect
        liveState.teamAAnsweredCount += 1
        if (isCorrect) liveState.teamAScore += question.points
      } else {
        liveState.teamBCorrect = isCorrect
        liveState.teamBAnsweredCount += 1
        if (isCorrect) liveState.teamBScore += question.points
      }
      liveState.isRunning = false
      broadcast()
      setTimeout(async () => {
        if (await roundQuestionsComplete()) {
          liveState.currentQuestionId = null
          broadcast()
          return
        }
        const nextTeam = liveState.activeTeam === 'A' ? 'B' : 'A'
        await drawNextItem(nextTeam)
        broadcast()
      }, 2500)
    })

    socket.on('moderator:endOpenQuestion', () => {
      if (liveState.currentItemSource !== 'analytic' || liveState.currentItemMode !== 'aberta')
        return
      liveState.isRunning = false
      liveState.awaitingJuryEvaluation = true
      broadcast()
      checkAutoConfirmOpenItem(broadcast)
    })

    socket.on('moderator:startTiebreak', async () => {
      if (!liveState.teamA || !liveState.teamB || !liveState.championship) return
      if (liveState.tiebreak.pending || liveState.tiebreak.active) return

      liveState.tiebreak.pending = true
      broadcast()

      startCountdown(5, async () => {
        if (!liveState.teamA || !liveState.teamB || !liveState.championship) return
        const match = await prisma.tiebreakMatch.create({
          data: {
            championship: liveState.championship,
            phase: liveState.phase,
            teamAId: liveState.teamA.id,
            teamBId: liveState.teamB.id
          }
        })
        liveState.tiebreak = {
          active: true,
          pending: false,
          matchId: match.id,
          currentQuestionId: null,
          usedQuestionIds: []
        }
        await drawTiebreakQuestion()
        liveState.timeLeft = await getQuestionTimeSeconds()
        resetAnswerState()
      })
    })

    socket.on('moderator:startThirdPlaceTiebreak', async () => {
      if (liveState.podiumReveal.stage !== 'awaitingTiebreak') return
      if (liveState.thirdPlaceTiebreak.active) return
      if (!liveState.thirdPlaceTiebreak.teamAId || !liveState.thirdPlaceTiebreak.teamBId) return

      startCountdown(5, async () => {
        if (liveState.podiumReveal.stage !== 'awaitingTiebreak') return
        liveState.thirdPlaceTiebreak.active = true
        liveState.thirdPlaceTiebreak.teamAAnswer = null
        liveState.thirdPlaceTiebreak.teamBAnswer = null
        liveState.thirdPlaceTiebreak.teamACorrect = null
        liveState.thirdPlaceTiebreak.teamBCorrect = null
        await drawThirdPlaceQuestion()
        liveState.timeLeft = await getQuestionTimeSeconds()
        broadcast()
      })
    })

    socket.on(
      'thirdPlace:submitAnswer',
      async (payload: { team: 'A' | 'B'; optionLabel: string }) => {
        const tb = liveState.thirdPlaceTiebreak
        if (!tb.active || tb.currentQuestionId === null) return
        if (payload.team === 'A' && tb.teamAAnswer) return
        if (payload.team === 'B' && tb.teamBAnswer) return

        if (payload.team === 'A') {
          tb.teamAAnswer = payload.optionLabel
        } else {
          tb.teamBAnswer = payload.optionLabel
        }

        const question = await prisma.tiebreakQuestion.findUnique({
          where: { id: tb.currentQuestionId }
        })
        if (!question) {
          if (payload.team === 'A') tb.teamAAnswer = null
          else tb.teamBAnswer = null
          return
        }
        const correctIdxs = parseCorrectIndexes(question.correctIndexes)
        const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel))
        if (payload.team === 'A') {
          tb.teamACorrect = isCorrect
        } else {
          tb.teamBCorrect = isCorrect
        }
        broadcast()

        if (tb.teamAAnswer && tb.teamBAnswer) {
          setTimeout(async () => {
            const aCorrect = tb.teamACorrect
            const bCorrect = tb.teamBCorrect
            let winner: 'A' | 'B' | null = null
            if (aCorrect && !bCorrect) winner = 'A'
            else if (bCorrect && !aCorrect) winner = 'B'

            if (winner) {
              const winnerId = winner === 'A' ? tb.teamAId : tb.teamBId
              const loserId = winner === 'A' ? tb.teamBId : tb.teamAId
              const winnerName = winner === 'A' ? tb.teamAName : tb.teamBName
              const loserName = winner === 'A' ? tb.teamBName : tb.teamAName
              const winnerInstitution = winner === 'A' ? tb.teamAInstitution : tb.teamBInstitution
              tb.active = false
              tb.winnerId = winnerId

              const ranked = [...liveState.championshipRankings].sort((a, b) => b.score - a.score)
              const first = ranked[0]
              const second = ranked[1]
              const tiedScore = ranked[2]?.score ?? 0

              liveState.podium.active = true
              liveState.podium.phaseNumber = liveState.phase
              liveState.podium.phaseLabel = 'Grande Final'
              liveState.podium.entries = [
                first && { id: first.teamId, name: first.name, institution: first.institution, score: first.score },
                second && { id: second.teamId, name: second.name, institution: second.institution, score: second.score },
                winnerId && winnerName
                  ? { id: winnerId, name: winnerName, institution: winnerInstitution ?? '', score: tiedScore }
                  : null
              ].filter(Boolean) as typeof liveState.podium.entries
              liveState.podium.isGrandFinal = true
              liveState.podiumReveal.stage = 'revealed'
              broadcast()
            } else {
              tb.teamAAnswer = null
              tb.teamBAnswer = null
              tb.teamACorrect = null
              tb.teamBCorrect = null
              await drawThirdPlaceQuestion()
              broadcast()
            }
          }, 2500)
        }
      }
    )

    socket.on(
      'tiebreak:submitAnswer',
      async (payload: { team: 'A' | 'B'; optionLabel: string }) => {
        if (!liveState.tiebreak.active || liveState.tiebreak.currentQuestionId === null) return
        if (payload.team === 'A' && liveState.teamAAnswer) return
        if (payload.team === 'B' && liveState.teamBAnswer) return

        if (payload.team === 'A') {
          liveState.teamAAnswer = payload.optionLabel
        } else {
          liveState.teamBAnswer = payload.optionLabel
        }

        const question = await prisma.tiebreakQuestion.findUnique({
          where: { id: liveState.tiebreak.currentQuestionId }
        })
        if (!question) {
          if (payload.team === 'A') liveState.teamAAnswer = null
          else liveState.teamBAnswer = null
          return
        }
        const correctIdxs = parseCorrectIndexes(question.correctIndexes)
        const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel))
        if (payload.team === 'A') {
          liveState.teamACorrect = isCorrect
        } else {
          liveState.teamBCorrect = isCorrect
        }
        broadcast()
        if (liveState.teamAAnswer && liveState.teamBAnswer) {
          setTimeout(async () => {
            const aCorrect = liveState.teamACorrect
            const bCorrect = liveState.teamBCorrect
            let winner: 'A' | 'B' | null = null
            if (aCorrect && !bCorrect) winner = 'A'
            else if (bCorrect && !aCorrect) winner = 'B'
            if (winner && liveState.tiebreak.matchId && liveState.teamA && liveState.teamB) {
              const winnerId = winner === 'A' ? liveState.teamA.id : liveState.teamB.id
              await prisma.tiebreakMatch.update({
                where: { id: liveState.tiebreak.matchId },
                data: { winnerId, resolved: true }
              })
              liveState.tiebreak.active = false
              resetAnswerState()
              broadcast()
            } else {
              resetAnswerState()
              await drawTiebreakQuestion()
              broadcast()
            }
          }, 2500)
        }
      }
    )

    socket.on('moderator:finishMatch', async () => {
      const questionTime = await getQuestionTimeSeconds()
      let shouldStartSequence = false
      if (liveState.teamA && liveState.teamB && liveState.championship) {
        const phaseConfig = await getCurrentPhaseConfig()

        let compareAScore = liveState.teamAScore
        let compareBScore = liveState.teamBScore
        if (phaseConfig?.type === 'apresentacao_quiz') {
          const presA =
            liveState.presentationPhaseScores.find((p) => p.teamId === liveState.teamA!.id)
              ?.score ?? 0
          const presB =
            liveState.presentationPhaseScores.find((p) => p.teamId === liveState.teamB!.id)
              ?.score ?? 0
          const quizWeight = phaseConfig.quizWeight ?? 50
          const presWeight = phaseConfig.presentationWeight ?? 50
          const totalWeight = quizWeight + presWeight || 1
          compareAScore = (liveState.teamAScore * quizWeight + presA * presWeight) / totalWeight
          compareBScore = (liveState.teamBScore * quizWeight + presB * presWeight) / totalWeight
        } else {
          const carriedA = liveState.carriedPresentationScores.find(
            (p) => p.teamId === liveState.teamA!.id
          )
          const carriedB = liveState.carriedPresentationScores.find(
            (p) => p.teamId === liveState.teamB!.id
          )
          if (carriedA) {
            const totalWeight = carriedA.presentationWeight + carriedA.quizWeight || 1
            compareAScore =
              (liveState.teamAScore * carriedA.quizWeight +
                carriedA.score * carriedA.presentationWeight) /
              totalWeight
          }
          if (carriedB) {
            const totalWeight = carriedB.presentationWeight + carriedB.quizWeight || 1
            compareBScore =
              (liveState.teamBScore * carriedB.quizWeight +
                carriedB.score * carriedB.presentationWeight) /
              totalWeight
          }
        }

        let winnerId: string | undefined
        if (compareAScore === compareBScore) {
          const resolvedTiebreak = liveState.tiebreak.matchId
            ? await prisma.tiebreakMatch.findUnique({ where: { id: liveState.tiebreak.matchId } })
            : null
          winnerId = resolvedTiebreak?.winnerId ?? undefined
        } else {
          winnerId = compareAScore > compareBScore ? liveState.teamA.id : liveState.teamB.id
        }

        const winnerName =
          winnerId === liveState.teamA.id
            ? liveState.teamA.name
            : winnerId === liveState.teamB.id
              ? liveState.teamB.name
              : null
        await prisma.matchHistory.create({
          data: {
            championship: liveState.championship,
            editionName: liveState.editionName,
            phase: liveState.phase,
            phaseLabel: phaseConfig?.label ?? `Fase ${liveState.phase}`,
            teamAId: liveState.teamA.id,
            teamAName: liveState.teamA.name,
            teamBId: liveState.teamB.id,
            teamBName: liveState.teamB.name,
            teamAScore: liveState.teamAScore,
            teamBScore: liveState.teamBScore,
            winnerId: winnerId ?? null,
            winnerName,
            wasTiebreak: !!liveState.tiebreak.matchId,
            deviceMode: null,
            startedAt: new Date(liveState.matchStartedAt ?? Date.now()),
            endedAt: new Date(),
            durationSeconds: liveState.matchStartedAt
              ? Math.round((Date.now() - liveState.matchStartedAt) / 1000)
              : 0
          }
        })
        if (winnerId) {
          await recordBracketResult(
            liveState.championship,
            liveState.teamA.id,
            liveState.teamB.id,
            winnerId
          )
          await recordRepescagemResult(liveState.teamA.id, liveState.teamB.id, winnerId)
          const loserId = winnerId === liveState.teamA.id ? liveState.teamB.id : liveState.teamA.id
          if (!liveState.eliminatedTeamIds.includes(loserId)) {
            liveState.eliminatedTeamIds.push(loserId)
          }
          const bracketRound = await getBracketRoundForPhaseOrder(liveState.championship, liveState.phase)
          shouldStartSequence = await isRoundComplete(liveState.championship, bracketRound)
        }
      }

      addToPhaseRanking(liveState.teamA, liveState.teamAScore)
      addToPhaseRanking(liveState.teamB, liveState.teamBScore)
      addToChampionshipRanking(liveState.teamA, liveState.teamAScore)
      addToChampionshipRanking(liveState.teamB, liveState.teamBScore)

      for (const team of [liveState.teamA, liveState.teamB]) {
        if (!team) continue
        const idx = liveState.carriedPresentationScores.findIndex((p) => p.teamId === team.id)
        if (idx === -1) continue
        const carried = liveState.carriedPresentationScores[idx]
        const rawScore =
          team.id === liveState.teamA?.id ? liveState.teamAScore : liveState.teamBScore
        const totalWeight = carried.presentationWeight + carried.quizWeight || 1
        const weighted =
          (rawScore * carried.quizWeight + carried.score * carried.presentationWeight) / totalWeight
        const delta = weighted - rawScore
        const phaseEntry = liveState.phaseRankings.find((r) => r.teamId === team.id)
        const champEntry = liveState.championshipRankings.find((r) => r.teamId === team.id)
        if (phaseEntry) phaseEntry.score += delta
        if (champEntry) champEntry.score += delta
        liveState.carriedPresentationScores.splice(idx, 1)
      }

      if (shouldStartSequence) {
        const phaseConfigForWeighting = await getCurrentPhaseConfig()
        if (phaseConfigForWeighting?.type === 'apresentacao_quiz') {
          applyPresentationWeighting(phaseConfigForWeighting)
        }
      }

      resetMatch(questionTime, false)

      if (shouldStartSequence) {
        await startPostRoundSequence()
      }
      broadcast()
    })

    socket.on('moderator:continueAfterRepescagem', async () => {
      if (liveState.phaseFlow.stage !== 'repescagem') return
      const totalPhases = await getTotalPhases()
      const isLastPhase = liveState.phase >= totalPhases
      liveState.phaseFlow = {
        stage: isLastPhase ? 'partnersPending' : 'ranking',
        suspensePhrase: null
      }
      broadcast()
    })

    socket.on('moderator:openRepescagemVoting', async (payload: { configId: string }) => {
      const config = await prisma.repescagemConfig.findUnique({ where: { id: payload.configId } })
      if (!config || config.started) return

      await prisma.repescagemConfig.update({
        where: { id: config.id },
        data: { started: true, votingOpen: true, startedAt: new Date() }
      })

      liveState.repescagemReveal = {
        stage: 'suspense',
        countdownValue: 10,
        configId: config.id,
        repescadaNames: []
      }
      broadcast()

      setTimeout(() => {
        if (liveState.repescagemReveal.configId !== config.id) return
        liveState.repescagemReveal.stage = 'countdown'
        broadcast()
        const interval = setInterval(() => {
          if (liveState.repescagemReveal.configId !== config.id) {
            clearInterval(interval)
            return
          }
          liveState.repescagemReveal.countdownValue -= 1
          if (liveState.repescagemReveal.countdownValue <= 0) {
            clearInterval(interval)
            liveState.repescagemReveal.stage = 'voting'
            broadcast()
          } else {
            broadcast()
          }
        }, 1000)
      }, 3000)
    })

    socket.on('moderator:closeRepescagemVoting', async (payload: { configId: string }) => {
      const config = await prisma.repescagemConfig.findUnique({ where: { id: payload.configId } })
      if (!config || !config.votingOpen) return

      await prisma.repescagemConfig.update({
        where: { id: config.id },
        data: { votingOpen: false, closedAt: new Date() }
      })

      const eligibleTeams = await getEligibleTeams(config.championship, config.phase)
      const votes = await prisma.repescagemVote.findMany({ where: { configId: config.id } })
      const ranked = eligibleTeams
        .map((t) => ({ team: t, votes: votes.filter((v) => v.teamId === t.id).length }))
        .sort((a, b) => b.votes - a.votes)
      const repescadaNames = ranked.slice(0, config.maxRepescados).map((r) => r.team.name)

      liveState.repescagemReveal = {
        stage: 'results',
        countdownValue: 0,
        configId: config.id,
        repescadaNames
      }
      broadcast()

      setTimeout(() => {
        if (liveState.repescagemReveal.configId !== config.id) return
        liveState.repescagemReveal = {
          stage: 'idle',
          countdownValue: 0,
          configId: null,
          repescadaNames: []
        }
        broadcast()
      }, 8000)
    })

    socket.on('moderator:showPartners', async () => {
      const currentPhaseConfig = await getCurrentPhaseConfig()
      const isPresentationQuiz =
        liveState.phaseFlow.stage === 'presentationRanking' &&
        currentPhaseConfig?.type === 'apresentacao_quiz'

      if (
        liveState.phaseFlow.stage !== 'ranking' &&
        liveState.phaseFlow.stage !== 'partnersPending' &&
        !isPresentationQuiz
      ) {
        return
      }

      const isLastPhase = liveState.phaseFlow.stage === 'partnersPending'
      const seconds = await getPartnersDurationSeconds()

      liveState.phaseFlow = { stage: 'partners', suspensePhrase: null }
      broadcast()

      if (partnersTimerHandle) clearTimeout(partnersTimerHandle)

      scheduleInstitutionalStep(() => {
        if (liveState.phaseFlow.stage !== 'partners') return

        // Fluxo especial:
        // Apresentação + Quiz → Parceiros → Introdução do Quiz
        if (isPresentationQuiz) {
          liveState.phaseFlow = { stage: 'quizIntro', suspensePhrase: null }
          liveState.bracketVisible = false
          broadcast()
          return
        }

        // Fluxo institucional normal
        liveState.phaseFlow = { stage: 'webtec', suspensePhrase: null }
        broadcast()

        scheduleInstitutionalStep(() => {
          if (liveState.phaseFlow.stage !== 'webtec') return

          liveState.phaseFlow = { stage: 'organizer', suspensePhrase: null }
          broadcast()

          scheduleInstitutionalStep(async () => {
            if (liveState.phaseFlow.stage !== 'organizer') return

            if (isLastPhase) {
              // Não há próxima fase — avança automaticamente para o pódio final
              await triggerFinalPodiumSequence(broadcast)
              return
            }

            const phrase = await pickSuspensePhrase()
            liveState.phaseFlow = {
              stage: 'suspense',
              suspensePhrase: phrase
            }
            broadcast()
          }, seconds * 1000)
        }, seconds * 1000)
      }, seconds * 1000)
    })

    socket.on('moderator:skipInstitutionalSequence', () => {
      if (!partnersTimerHandle || !partnersNextStep) return
      clearTimeout(partnersTimerHandle)
      partnersTimerHandle = null
      const step = partnersNextStep
      partnersNextStep = null
      step()
    })

    socket.on('moderator:startNextPhase', async (payload?: { force?: boolean }, callback?: (res: { success: boolean; error?: string }) => void) => {
      const force = Boolean(payload?.force)
      if (!force && liveState.phaseFlow.stage !== 'suspense') {
        callback?.({ success: false, error: 'A fase seguinte só pode avançar quando está em suspense.' })
        return
      }

      const questionTime = await getQuestionTimeSeconds()
      const totalPhases = await getTotalPhases()

      if (liveState.phase < totalPhases) liveState.phase += 1
      liveState.phaseRankings = []
      liveState.usedQuestionIds = []
      liveState.eliminatedTeamIds = []
      liveState.phaseRankingReveal = { visible: false }
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.presentationPhaseScores = []
      resetPresentationFlow()
      liveState.bracketVisible = true
      resetMatch(questionTime, false)
      await refreshExpectedJurorCount()
      broadcast()
      callback?.({ success: true })
    })

    socket.on('moderator:startQuizPhase', async (payload?: { force?: boolean }, callback?: (res: { success: boolean; error?: string }) => void) => {
      const force = Boolean(payload?.force)
      if (!force && liveState.phaseFlow.stage !== 'suspense') {
        callback?.({ success: false, error: 'A fase seguinte só pode avançar quando está em suspense.' })
        return
      }

      const questionTime = await getQuestionTimeSeconds()
      const totalPhases = await getTotalPhases()

      if (liveState.phase < totalPhases) liveState.phase += 1
      liveState.phaseRankings = []
      liveState.usedQuestionIds = []
      liveState.eliminatedTeamIds = []
      liveState.phaseRankingReveal = { visible: false }
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.presentationPhaseScores = []
      resetPresentationFlow()
      liveState.bracketVisible = true
      resetMatch(questionTime, false)
      await refreshExpectedJurorCount()
      broadcast()
      callback?.({ success: true })
    })

    socket.on('moderator:confirmQuizIntro', async () => {
      if (liveState.phaseFlow.stage !== 'quizIntro' && liveState.phaseFlow.stage !== 'presentationRanking')
        return
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.bracketVisible = true
      await refreshExpectedJurorCount()
      broadcast()
    })

    socket.on('moderator:confirmPresentationRanking', async () => {
      if (!liveState.presentationRoundReady) return
      liveState.presentationRoundReady = false
      await startPostRoundSequence()
      await refreshExpectedJurorCount()
      broadcast()
    })

    socket.on('moderator:advancePhase', async (payload?: { force?: boolean }, callback?: (res: { success: boolean; error?: string }) => void) => {
      const force = Boolean(payload?.force)
      const questionTime = await getQuestionTimeSeconds()
      const totalPhases = await getTotalPhases()
      if (!force && liveState.phase >= totalPhases) {
        callback?.({ success: false, error: 'Já está na última fase do campeonato.' })
        return
      }
      if (liveState.phase < totalPhases) liveState.phase += 1
      liveState.phaseRankings = []
      liveState.usedQuestionIds = []
      liveState.eliminatedTeamIds = []
      liveState.phaseRankingReveal = { visible: false }
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.phaseTransition = { stage: 'idle' }
      liveState.presentationPhaseScores = []
      resetPresentationFlow()
      liveState.bracketVisible = true
      resetMatch(questionTime, false)
      await refreshExpectedJurorCount()
      broadcast()
      callback?.({ success: true })
    })

    socket.on('moderator:resetChampionship', async () => {
      const questionTime = await getQuestionTimeSeconds()
      const championship = liveState.championship

      if (championship) {
        await prisma.bracketMatch.updateMany({
          where: { championship, round: { gt: 1 } },
          data: { teamAId: null, teamBId: null, winnerId: null }
        })
        await prisma.bracketMatch.updateMany({
          where: { championship, round: 1 },
          data: { winnerId: null }
        })

        const phases = await prisma.phase.findMany({ where: { championship } })
        const phaseIds = phases.map((p) => p.id)
        if (phaseIds.length) {
          const criteriaIds = (
            await prisma.presentationCriteria.findMany({
              where: { phaseId: { in: phaseIds } },
              select: { id: true }
            })
          ).map((c) => c.id)
          if (criteriaIds.length) {
            await prisma.presentationScore.deleteMany({
              where: { criteriaId: { in: criteriaIds } }
            })
          }
          await prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } })
        }
        await syncPresentationDuplasForRound(championship, 1)
      }

      liveState.phase = 1
      liveState.phaseRankings = []
      liveState.championshipRankings = []
      liveState.championshipStartedAt = liveState.championship ? Date.now() : null
      liveState.eliminatedTeamIds = []
      liveState.phaseRankingReveal = { visible: false }
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.championReveal = { active: false, teamName: null, logoUrl: null }
      liveState.presentationPhaseScores = []
      liveState.carriedPresentationScores = []
      resetPresentationFlow()
      liveState.bracketVisible = !!liveState.championship
      liveState.podium.active = false
      liveState.podiumReveal = {
        stage: 'idle',
        countdownValue: 0,
        suspensePhrase: null,
        finalRankingVisible: false
      }
      liveState.phaseTransition = { stage: 'idle' }
      liveState.expectedJurorCount = 0
      resetMatch(questionTime)
      await refreshExpectedJurorCount()
      broadcast()
    })

    socket.on('moderator:abandonChampionship', async () => {
      liveState.championship = null
      liveState.editionName = null
      liveState.phase = 1
      liveState.teamA = null
      liveState.teamB = null
      liveState.phaseRankings = []
      liveState.championshipRankings = []
      liveState.championshipStartedAt = null
      liveState.eliminatedTeamIds = []
      liveState.phaseRankingReveal = { visible: false }
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      liveState.presentationPhaseScores = []
      liveState.carriedPresentationScores = []
      resetPresentationFlow()
      liveState.bracketVisible = false
      liveState.podium.active = false
      liveState.podiumReveal = {
        stage: 'idle',
        countdownValue: 0,
        suspensePhrase: null,
        finalRankingVisible: false
      }
      liveState.phaseTransition = { stage: 'idle' }
      liveState.expectedJurorCount = 0
      const questionTime = await getQuestionTimeSeconds()
      resetMatch(questionTime)
      broadcast()
    })

    socket.on('moderator:showPhaseRanking', () => {
      liveState.phaseRankingReveal.visible = true
      broadcast()
    })

    socket.on('moderator:hidePhaseRanking', () => {
      liveState.phaseRankingReveal.visible = false
      broadcast()
    })

    socket.on(
      'moderator:showPodium',
      (payload: {
        phaseNumber: number
        phaseLabel: string
        entries: PodiumEntry[]
        isGrandFinal: boolean
      }) => {
        liveState.podium.active = true
        liveState.podium.phaseNumber = payload.phaseNumber
        liveState.podium.phaseLabel = payload.phaseLabel
        liveState.podium.entries = payload.entries
        liveState.podium.isGrandFinal = payload.isGrandFinal
        broadcast()
      }
    )

    socket.on('moderator:hidePodium', () => {
      liveState.podium.active = false
      broadcast()
    })

    socket.on('moderator:startFinalPodiumSequence', async () => {
      // const totalPhases = await getTotalPhases()
      // if (liveState.phase !== totalPhases) return
      await triggerFinalPodiumSequence(broadcast)
    })

    socket.on('moderator:showFinalRanking', () => {
      liveState.podiumReveal.finalRankingVisible = true
      broadcast()
    })

    socket.on('moderator:hideFinalRanking', () => {
      liveState.podiumReveal.finalRankingVisible = false
      broadcast()
    })

    socket.on(
      'moderator:finalizeChampionship',
      async (
        payload?: { force?: boolean },
        callback?: (res: { success: boolean; error?: string }) => void
      ) => {
        const force = Boolean(payload?.force)
        const isMediumSchool = liveState.championship === 'ensino_medio'
        if (!liveState.championship) {
          callback?.({ success: false, error: 'Nenhum campeonato ativo para finalizar.' })
          return
        }
        const totalPhases = await getTotalPhases()
        const isLastPhase = liveState.phase >= totalPhases
        const canFinalizeByState =
          force || isMediumSchool || isLastPhase || liveState.podiumReveal.finalRankingVisible

        if (!canFinalizeByState) {
          callback?.({ success: false, error: 'O ranking final ainda não está visível.' })
          return
        }

        if (!force && !isMediumSchool && !isLastPhase) {
          callback?.({ success: false, error: 'Só é possível finalizar na última fase.' })
          return
        }

        const matches = await prisma.matchHistory.findMany({
          where: { championship: liveState.championship, editionName: liveState.editionName }
        })

        const championEntry = liveState.podium.entries[0] ?? null
        let championLogoUrl: string | null = null
        if (championEntry) {
          const team = await prisma.team.findUnique({ where: { id: championEntry.id } })
          championLogoUrl = team?.logoUrl ?? null
        }

        await prisma.championshipHistory.create({
          data: {
            championship: liveState.championship,
            editionName: liveState.editionName ?? 'Sem nome',
            championTeamId: championEntry?.id ?? null,
            championTeamName: championEntry?.name ?? null,
            finalRankingJson: JSON.stringify(liveState.championshipRankings),
            matchesJson: JSON.stringify(matches),
            totalMatches: matches.length,
            startedAt: new Date(liveState.championshipStartedAt ?? Date.now()),
            endedAt: new Date()
          }
        })

        // Limpar chaveamento para o próximo evento (ronda 1 sem vencedores)
        const champ = liveState.championship
        await prisma.bracketMatch.updateMany({
          where: { championship: champ, round: { gt: 1 } },
          data: { teamAId: null, teamBId: null, winnerId: null }
        })
        await prisma.bracketMatch.updateMany({
          where: { championship: champ, round: 1 },
          data: { winnerId: null }
        })

        liveState.championReveal = {
          active: true,
          teamName: championEntry?.name ?? null,
          logoUrl: championLogoUrl
        }

        clearActiveChampionshipState()
        const questionTime = await getQuestionTimeSeconds()
        resetMatch(questionTime)

        broadcast()
        callback?.({ success: true })
      }
    )

    socket.on('moderator:showPhaseTransition', async () => {
      liveState.phaseTransition.stage = 'carousel'
      broadcast()
      // CORRIGIDO - usava 8000ms fixo, independente da duracao configurada
      // no Admin (partnersDurationSeconds) e do tempo real que o carrossel
      // de parceiros (PartnerCarousel.vue, animacao CSS de 16s por volta)
      // precisa para dar pelo menos uma volta completa. Isso cortava a
      // sequencia a meio sempre que a volta demorava mais de 8s.
      //
      // CORRIGIDO #2 - mesmo respeitando partnersDurationSeconds, ainda
      // cortava os ultimos parceiros: o PartnerCarousel.vue so comeca a
      // animar depois de fetchPartners() (chamada de rede) resolver, mas
      // este setTimeout comeca a contar antes disso. Impomos um minimo
      // absoluto que cobre uma volta completa da animacao (16s) mais uma
      // margem para o carregamento dos dados/imagens, mesmo que o valor
      // configurado no Admin seja menor.
      const ANIMATION_LOOP_SECONDS = 16
      const LOAD_MARGIN_SECONDS = 5
      const configuredSeconds = await getPartnersDurationSeconds()
      const seconds = Math.max(configuredSeconds, ANIMATION_LOOP_SECONDS + LOAD_MARGIN_SECONDS)
      setTimeout(() => {
        liveState.phaseTransition.stage = 'webtec'
        broadcast()
      }, seconds * 1000)
    })

    socket.on('moderator:hidePhaseTransition', () => {
      liveState.phaseTransition.stage = 'idle'
      broadcast()
    })

    socket.on(
      'moderator:startPresentation',
      async (payload: { duplaId: string; teamId: string; useDocument?: boolean }) => {
        try {
          const phaseConfig = await getCurrentPhaseConfig()

          if (
            !phaseConfig ||
            (phaseConfig.type !== 'apresentacao' &&
              phaseConfig.type !== 'apresentacao_quiz')
          ) {
            return
          }

          if (liveState.presentationFlow.stage !== 'idle') return

          if (
            liveState.presentationFlow.presentedTeamIds.includes(
              payload.teamId
            )
          ) {
            return
          }

          liveState.bracketVisible = false

          const dupla = await prisma.presentationDupla.findUnique({
            where: {
              id: payload.duplaId
            }
          })

          if (
            !dupla ||
            (dupla.teamAId !== payload.teamId &&
              dupla.teamBId !== payload.teamId)
          ) {
            return
          }

          const team = await prisma.team.findUnique({
            where: {
              id: payload.teamId
            }
          })

          if (!team) return


          let presentationMode: 'standard' | 'document' = 'standard'

          if (payload.useDocument) {
            const doc = await prisma.presentationDocument.findUnique({
              where: {
                duplaId_teamId: {
                  duplaId: payload.duplaId,
                  teamId: payload.teamId
                }
              }
            })

            if (doc && !doc.deletedAt) {
              presentationMode = 'document'
            }
          }

          const minutes = phaseConfig.presentationMinutes ?? 10

          const presentedTeamIds =
            liveState.presentationFlow.presentedTeamIds

          liveState.presentationFlow = {
            stage: 'countdown',

            duplaId: payload.duplaId,

            teamId: team.id,

            teamName: team.name,

            theme:
              payload.teamId === dupla.teamAId
                ? dupla.themeA
                : dupla.themeB ?? dupla.themeA,

            timeLeft: minutes * 60,

            presentedTeamIds,

            criteriaScores: [],

            jurorsSubmitted: [],

            allJurorsSubmitted: false,

            presentationMode,

            currentPage: 1,

            totalPages: 1
          }

          await refreshExpectedJurorCount()

          broadcast()

          startCountdown(10, async () => {
            if (liveState.presentationFlow.teamId !== team.id) {
              return
            }

            liveState.presentationFlow.stage = 'presenting'

            broadcast()
          })
        } catch (error) {
          console.error(
            '[moderator:startPresentation] Erro ao iniciar apresentação:',
            error
          )
        }
      }
    )

    socket.on('moderator:finishPresentation', async () => {
      if (liveState.presentationFlow.stage !== 'presenting') {
        return
      }

      if (liveState.presentationFlow.timeLeft > 0) {
        return
      }

      liveState.presentationFlow.stage = 'concluded'

      const teamId = liveState.presentationFlow.teamId

      if (
        teamId &&
        !liveState.presentationFlow.presentedTeamIds.includes(teamId)
      ) {
        liveState.presentationFlow.presentedTeamIds.push(teamId)
      }

      await checkAllJurorsSubmitted(broadcast)

      broadcast()
    })


    socket.on('moderator:presentationNextPage', () => {
      const flow = liveState.presentationFlow
      if (flow.stage !== 'presenting' || flow.presentationMode !== 'document') return
      if (flow.totalPages > 0 && flow.currentPage >= flow.totalPages) return
      flow.currentPage += 1
      broadcast()
    })

    socket.on('presentation:setSlideCount', (payload: { count: number }) => {
      const n = Math.floor(Number(payload?.count) || 0)
      if (n <= 0) return
      const flow = liveState.presentationFlow
      if (flow.stage !== 'presenting' && flow.stage !== 'countdown') return
      if (flow.totalPages > 1 && n < flow.totalPages) return
      flow.totalPages = n
      if (flow.currentPage > n) flow.currentPage = n
      console.log('[setSlideCount] totalPages =', n)
      broadcast()
    })

    socket.on('moderator:presentationPrevPage', () => {
      const flow = liveState.presentationFlow

      if (
        flow.stage !== 'presenting' ||
        flow.presentationMode !== 'document'
      ) {
        return
      }

      flow.currentPage = Math.max(1, flow.currentPage - 1)

      broadcast()
    })

    // NOVO - paginacao de enunciados analiticos longos (resposta aberta ou
    // multipla escolha com texto extenso). Segue o mesmo padrao de
    // presentationNextPage/PrevPage, mas calcula o total de paginas na hora
    // porque o texto vive na BD (EvaluationItem.text), nao no liveState.
    socket.on('moderator:analyticNextPage', async () => {
      if (liveState.currentItemSource !== 'analytic' || !liveState.currentAnalyticItemId) return
      const item = await prisma.evaluationItem.findUnique({
        where: { id: liveState.currentAnalyticItemId }
      })
      if (!item) return
      const totalPages = paginateText(item.text, ANALYTIC_PAGE_MAX_CHARS).length
      if (liveState.analyticQuestionPage >= totalPages) return
      liveState.analyticQuestionPage += 1
      broadcast()
    })

    socket.on('moderator:analyticPrevPage', () => {
      if (liveState.currentItemSource !== 'analytic' || !liveState.currentAnalyticItemId) return
      liveState.analyticQuestionPage = Math.max(1, liveState.analyticQuestionPage - 1)
      broadcast()
    })

    socket.on(
      'juror:setPresentationScore',
      (payload: { jurorId: string; criteriaId: string; score: number }) => {
        if (liveState.presentationFlow.stage === 'idle') return
        if (liveState.presentationFlow.jurorsSubmitted.includes(payload.jurorId)) return
        if (!payload.criteriaId) return
        const existing = liveState.presentationFlow.criteriaScores.find(
          (e) => e.jurorId === payload.jurorId && e.criteriaId === payload.criteriaId
        )
        if (existing) {
          existing.score = payload.score
        } else {
          liveState.presentationFlow.criteriaScores.push({ ...payload })
        }
        broadcast()
      }
    )

    socket.on(
      'juror:setAnalyticCriteriaScore',
      (payload: { jurorId: string; criteriaId: string; team: 'A' | 'B'; score: number }) => {
        if (liveState.currentItemSource !== 'analytic') {
          return
        }
        if (!liveState.analyticEvaluation || liveState.analyticEvaluation.itemId !== liveState.currentAnalyticItemId) {
          return
        }
        if (!payload.criteriaId) return
        const existing = liveState.analyticEvaluation.criteriaScores.find(
          (e) => e.jurorId === payload.jurorId && e.criteriaId === payload.criteriaId && e.team === payload.team
        )
        if (existing) {
          existing.score = payload.score
        } else {
          liveState.analyticEvaluation.criteriaScores.push({ ...payload })
        }
        broadcast()
      }
    )

    socket.on('juror:submitAnalyticEvaluation', async (payload: { jurorId: string; itemId: string }) => {
      if (!liveState.analyticEvaluation || liveState.analyticEvaluation.itemId !== payload.itemId) {
        return
      }
      if (liveState.analyticEvaluation.jurorsSubmitted.includes(payload.jurorId)) {
        return
      }
      if (!liveState.jurors.some((j) => j.id === payload.jurorId)) {
        return
      }

      liveState.analyticEvaluation.jurorsSubmitted.push(payload.jurorId)
      broadcast()

      // Verifica se todos os jurados esperados submeteram
      const connectedCount = liveState.jurors.length
      const target =
        liveState.expectedJurorCount > 0 ? liveState.expectedJurorCount : connectedCount

      if (target <= 0) {
        return
      }
      if (liveState.analyticEvaluation.jurorsSubmitted.length < target) {
        return
      }

      // Persistir cada critério por jurado e equipa
      const valid = liveState.analyticEvaluation.criteriaScores
      const totalsByJurorA = new Map<string, number>()
      const totalsByJurorB = new Map<string, number>()

      for (const entry of valid) {
        try {
          await prisma.evaluationCriteriaScore.upsert({
            where: { criteriaId_jurorId_team: { criteriaId: entry.criteriaId, jurorId: entry.jurorId, team: entry.team } },
            update: { score: entry.score },
            create: { criteriaId: entry.criteriaId, jurorId: entry.jurorId, team: entry.team, score: entry.score }
          })
        } catch (err) {
          console.error('[juror:submitAnalyticEvaluation] Falha ao gravar evaluationCriteriaScore:', err)
        }

        if (entry.team === 'A') {
          totalsByJurorA.set(entry.jurorId, (totalsByJurorA.get(entry.jurorId) ?? 0) + entry.score)
        } else {
          totalsByJurorB.set(entry.jurorId, (totalsByJurorB.get(entry.jurorId) ?? 0) + entry.score)
        }
      }

      const totalsA = Array.from(totalsByJurorA.values())
      const totalsB = Array.from(totalsByJurorB.values())
      const avgA = totalsA.length ? totalsA.reduce((a, b) => a + b, 0) / totalsA.length : 0
      const avgB = totalsB.length ? totalsB.reduce((a, b) => a + b, 0) / totalsB.length : 0

      // Aplica as pontuações ao placar e marca item como confirmado
      liveState.teamAScore += Math.round(avgA)
      liveState.teamBScore += Math.round(avgB)
      liveState.jurorSubmittedItemIds.push(payload.itemId)

      liveState.teamAAnsweredCount += 1
      liveState.teamBAnsweredCount += 1

      // Limpa o estado atual do item analítico
      if (liveState.currentItemSource === 'analytic' && liveState.currentAnalyticItemId === payload.itemId) {
        liveState.awaitingJuryEvaluation = false
        liveState.currentItemSource = null
        liveState.currentAnalyticItemId = null
        liveState.currentItemMode = null
      }

      // Reset local analyticEvaluation
      liveState.analyticEvaluation = { itemId: null, criteriaScores: [], jurorsSubmitted: [], expectedJurorCount: 0 }
      if (await roundQuestionsComplete()) {
        liveState.currentQuestionId = null
      } else {
        const nextTeam = liveState.activeTeam === 'A' ? 'B' : 'A'
        await drawNextItem(nextTeam)
      }
      broadcast()
    })

    socket.on('juror:submitPresentationEvaluation', async (payload: { jurorId: string }) => {
      const flow = liveState.presentationFlow
      if (flow.stage === 'idle' || !flow.teamId) return
      if (flow.jurorsSubmitted.includes(payload.jurorId)) return
      if (!liveState.jurors.some((j) => j.id === payload.jurorId)) return

      flow.jurorsSubmitted.push(payload.jurorId)
      broadcast()

      await checkAllJurorsSubmitted(broadcast)
      broadcast()
    })

    socket.on('moderator:advanceToNextPresentation', () => {
      if (
        liveState.presentationFlow.stage !== 'concluded' ||
        !liveState.presentationFlow.allJurorsSubmitted
      ) {
        return
      }

      const presentedTeamIds =
        liveState.presentationFlow.presentedTeamIds

      liveState.presentationFlow = {
        stage: 'idle',

        duplaId: null,

        teamId: null,

        teamName: null,

        theme: null,

        timeLeft: 0,

        presentedTeamIds,

        criteriaScores: [],

        jurorsSubmitted: [],

        allJurorsSubmitted: false,

        presentationMode: 'standard',

        currentPage: 1,

        totalPages: 1
      }

      liveState.bracketVisible = true

      broadcast()
    })

    socket.on(
      'juror:register',
      async (payload: { code: string }, callback?: (res: unknown) => void) => {
        const code = (payload.code || '').trim().toUpperCase()
        const juror = await prisma.juror.findUnique({ where: { code } })
        if (!juror || juror.deletedAt) {
          callback?.({ success: false, error: 'Código de jurado inválido.' })
          return
        }

        const phaseConfig = await getCurrentPhaseConfig()
        if (phaseConfig) {
          const authRows = await prisma.phaseJurorAuthorization.findMany({
            where: { phaseId: phaseConfig.id, deletedAt: null }
          })
          if (authRows.length > 0 && !authRows.some((a) => a.jurorId === juror.id)) {
            callback?.({
              success: false,
              error: 'Este jurado não está autorizado a avaliar esta fase.'
            })
            return
          }
        }

        if (liveState.jurors.some((j) => j.id === juror.id)) {
          callback?.({ success: false, error: 'Este jurado já está ligado a esta partida.' })
          return
        }

        const maxJurors = await getMaxJurors()
        if (liveState.jurors.length >= maxJurors) {
          callback?.({
            success: false,
            error: 'Número máximo de jurados já atingido para esta partida.'
          })
          return
        }

        // CORRIGIDO - reconexao (mesmo jurorId a re-registar-se) ja
        // nao duplica a entrada em liveState.jurors nem apaga as notas
        // que ja tinha submetido; so re-associa o socket.id novo.
        const pendingRemoval = jurorDisconnectTimers.get(juror.id)
        if (pendingRemoval) {
          clearTimeout(pendingRemoval)
          jurorDisconnectTimers.delete(juror.id)
          console.log('[juror:register] reconexao dentro do grace period, notas preservadas:', juror.id)
        }
        const alreadyPresent = liveState.jurors.some((j) => j.id === juror.id)
        if (!alreadyPresent) {
          liveState.jurors.push({ id: juror.id, name: juror.name })
        }
        socket.data.jurorId = juror.id
        await refreshExpectedJurorCount()
        broadcast()
        callback?.({ success: true, jurorId: juror.id })
      }
    )

    socket.on(
      'moderator:registerJurorLocally',
      async (payload: { jurorId: string }, callback?: (res: unknown) => void) => {
        const juror = await prisma.juror.findUnique({ where: { id: payload.jurorId } })
        if (!juror || juror.deletedAt) {
          callback?.({ success: false, error: 'Jurado não encontrado.' })
          return
        }

        const phaseConfig = await getCurrentPhaseConfig()
        if (phaseConfig) {
          const authRows = await prisma.phaseJurorAuthorization.findMany({
            where: { phaseId: phaseConfig.id, deletedAt: null }
          })
          if (authRows.length > 0 && !authRows.some((a) => a.jurorId === juror.id)) {
            callback?.({
              success: false,
              error: 'Este jurado não está autorizado a avaliar esta fase.'
            })
            return
          }
        }

        if (liveState.jurors.some((j) => j.id === juror.id)) {
          callback?.({ success: true, jurorId: juror.id })
          return
        }

        const maxJurors = await getMaxJurors()
        if (liveState.jurors.length >= maxJurors) {
          callback?.({
            success: false,
            error: 'Número máximo de jurados já atingido para esta partida.'
          })
          return
        }

        liveState.jurors.push({ id: juror.id, name: juror.name })
        socket.data.locallyRegisteredJurorIds = socket.data.locallyRegisteredJurorIds || []
        socket.data.locallyRegisteredJurorIds.push(juror.id)
        await refreshExpectedJurorCount()
        broadcast()
        callback?.({ success: true, jurorId: juror.id })
      }
    )

    socket.on('moderator:removeJuror', async (payload: { jurorId: string }) => {
      liveState.jurors = liveState.jurors.filter((j) => j.id !== payload.jurorId)
      liveState.jurorEntries = liveState.jurorEntries.filter((e) => e.jurorId !== payload.jurorId)
      await checkAllJurorsSubmitted(broadcast)
      broadcast()
    })

    socket.on(
      'juror:setScore',
      async (payload: { jurorId: string; itemId: string; scoreA: number; scoreB: number }) => {
        const existing = liveState.jurorEntries.find(
          (e) => e.jurorId === payload.jurorId && e.itemId === payload.itemId
        )
        if (existing) {
          existing.scoreA = payload.scoreA
          existing.scoreB = payload.scoreB
        } else {
          liveState.jurorEntries.push({ ...payload })
        }
        broadcast()
        await checkAutoConfirmOpenItem(broadcast)
      }
    )

    socket.on('moderator:confirmEvaluation', async (payload: { itemId: string }) => {
      await applyEvaluationConfirmation(payload.itemId)
      broadcast()
    })

    socket.on(
      'juror:setInitialScore',
      (payload: { jurorId: string; scoreA: number; scoreB: number }) => {
        if (liveState.initialScoresConfirmed) return
        const existing = liveState.initialScoreEntries.find((e) => e.jurorId === payload.jurorId)
        if (existing) {
          existing.scoreA = payload.scoreA
          existing.scoreB = payload.scoreB
        } else {
          liveState.initialScoreEntries.push({ ...payload })
        }
        broadcast()
      }
    )

    socket.on('moderator:confirmInitialScores', () => {
      if (liveState.initialScoresConfirmed) return
      const totalA = liveState.initialScoreEntries.reduce((sum, e) => sum + e.scoreA, 0)
      const totalB = liveState.initialScoreEntries.reduce((sum, e) => sum + e.scoreB, 0)
      liveState.teamAScore += totalA
      liveState.teamBScore += totalB
      liveState.initialScoresConfirmed = true
      broadcast()
    })

    socket.on(
      'player:joinWithCode',
      (payload: { code: string; playerName?: string }, callback?: (res: unknown) => void) => {
        const code = (payload.code || '').trim().toUpperCase()
        let team: 'A' | 'B' | null = null
        if (liveState.matchCodes.teamACode === code) team = 'A'
        else if (liveState.matchCodes.teamBCode === code) team = 'B'
        if (!team) {
          callback?.({ success: false, error: 'Código inválido ou a partida ainda não começou.' })
          return
        }
        if (team === 'A') {
          liveState.matchCodes.teamAConnected = true
          liveState.matchCodes.teamAPlayerName = payload.playerName || null
        } else {
          liveState.matchCodes.teamBConnected = true
          liveState.matchCodes.teamBPlayerName = payload.playerName || null
        }
        broadcast()
        callback?.({
          success: true,
          team,
          teamName: team === 'A' ? liveState.teamA?.name : liveState.teamB?.name,
          opponentName: team === 'A' ? liveState.teamB?.name : liveState.teamA?.name
        })
      }
    )

    socket.on('disconnect', async () => {
      console.log('Cliente desligado:', socket.id)
      if (socket.id === moderatorSocketId && liveState.moderatorAdjusting) {
        liveState.moderatorAdjusting = false
        moderatorSocketId = null
        broadcast()
      }
      const jurorId = socket.data?.jurorId as string | undefined
      if (jurorId) {
        // CORRIGIDO - antes removia o jurado do liveState de imediato.
        // Agora da-lhe JUROR_DISCONNECT_GRACE_MS para reconectar (o
        // socket.io do cliente ja tenta sozinho); so se o tempo passar
        // sem um novo 'juror:register' com o mesmo jurorId e que o
        // expulsamos de facto.
        const existingTimer = jurorDisconnectTimers.get(jurorId)
        if (existingTimer) clearTimeout(existingTimer)
        jurorDisconnectTimers.set(
          jurorId,
          setTimeout(async () => {
            jurorDisconnectTimers.delete(jurorId)
            liveState.jurors = liveState.jurors.filter((j) => j.id !== jurorId)
            liveState.jurorEntries = liveState.jurorEntries.filter((e) => e.jurorId !== jurorId)
            await checkAllJurorsSubmitted(broadcast)
            broadcast()
            console.log('[disconnect] grace period esgotado, jurado removido:', jurorId)
          }, JUROR_DISCONNECT_GRACE_MS)
        )
      }
      const localJurorIds: string[] = socket.data?.locallyRegisteredJurorIds || []
      if (localJurorIds.length) {
        liveState.jurors = liveState.jurors.filter((j) => !localJurorIds.includes(j.id))
        liveState.jurorEntries = liveState.jurorEntries.filter(
          (e) => !localJurorIds.includes(e.jurorId)
        )
        await checkAllJurorsSubmitted(broadcast)
        broadcast()
      }
      const moderatorId = socket.data?.moderatorId as string | undefined
      if (moderatorId) {
        liveState.activeModerators = liveState.activeModerators.filter((m) => m.id !== moderatorId)
        broadcast()
      }
    })
  })
}
