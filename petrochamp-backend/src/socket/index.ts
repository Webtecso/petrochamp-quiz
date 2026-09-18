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
  'moderator:startTiebreak': 'quiz',
  'moderator:finishMatch': 'quiz',
  'moderator:confirmQuizIntro': 'quiz',
  'moderator:continueAfterRepescagem': 'quiz',
  'moderator:showPartners': 'quiz',
  'moderator:startNextPhase': 'quiz',
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

async function getCurrentPhaseConfig() {
  return prisma.phase.findFirst({
    where: { order: liveState.phase, championship: liveState.championship ?? undefined }
  })
}

async function getTotalPhases(): Promise<number> {
  const count = await prisma.phase.count({
    where: { championship: liveState.championship ?? undefined }
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
  const duplas = await prisma.presentationDupla.findMany({ where: { phaseId } })
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
      where: { phase: liveState.phase, championship: liveState.championship ?? undefined }
    }),
    prisma.evaluationItem.findMany({
      where: {
        phase: liveState.phase,
        championship: liveState.championship ?? undefined,
        type: 'analitica'
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

async function drawNextItem(team: 'A' | 'B'): Promise<void> {
  const phaseConfig = await getCurrentPhaseConfig()
  const avoidRepeat = phaseConfig?.avoidRepeatQuestions ?? true

  let pool = await buildPool()
  if (avoidRepeat && pool.length === 0) {
    liveState.usedQuestionIds = []
    liveState.usedAnalyticItemIds = []
    pool = await buildPool()
  } else if (!avoidRepeat) {
    const [questions, analyticItems, defaultTime] = await Promise.all([
      prisma.question.findMany({
        where: { phase: liveState.phase, championship: liveState.championship ?? undefined }
      }),
      prisma.evaluationItem.findMany({
        where: {
          phase: liveState.phase,
          championship: liveState.championship ?? undefined,
          type: 'analitica'
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
    where: { phase: liveState.phase, championship: liveState.championship ?? undefined }
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

async function pickSuspensePhrase(): Promise<string> {
  const phrases = await prisma.suspensePhrase.findMany()
  return phrases.length
    ? phrases[Math.floor(Math.random() * phrases.length)].text
    : 'Preparem-se - a próxima fase está prestes a começar...'
}

async function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {
  const flow = liveState.presentationFlow
  if (flow.stage !== 'concluded' || !flow.teamId) return
  if (flow.allJurorsSubmitted) return

  const connectedCount = liveState.jurors.length
  const target =
    connectedCount > 0
      ? Math.min(liveState.expectedJurorCount || connectedCount, connectedCount)
      : liveState.expectedJurorCount

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
    // Apresentação isolada (com ou sem eliminação por ranking):
    // só notas — NÃO fecha BracketMatch do quiz
    addToPhaseRanking(team, average)
    addToChampionshipRanking(team, average)
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
    connectedCount > 0
      ? Math.min(liveState.expectedJurorCount || connectedCount, connectedCount)
      : liveState.expectedJurorCount

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

      // CORRIGIDO - quando o tempo acaba e awaitingJuryEvaluation passa a
      // true aqui em cima, é possível que os jurados já tenham enviado a
      // nota ANTES do fim do tempo (juror:setScore chama
      // checkAutoConfirmOpenItem, mas nessa altura awaitingJuryEvaluation
      // ainda era false, então a checagem saía sem confirmar nada). Sem
      // este chamada extra, essa nota ficava presa em jurorEntries para
      // sempre - nunca era promovida a jurorSubmittedItemIds, e o jurado
      // via o botão "Confirmar Pontuação" a dizer "enviado" sem nada
      // realmente avançar. Ao chamar checkAutoConfirmOpenItem aqui, assim
      // que awaitingJuryEvaluation se torna true, o sistema volta a
      // verificar se todos os jurados esperados já responderam e, se sim,
      // confirma imediatamente - sem esperar por um novo juror:setScore
      // que pode nunca vir (o jurado já enviou a nota dele).
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
      // CORRIGIDO - mesmo raciocínio do timer principal: se os jurados já
      // tinham enviado a nota antes do moderador clicar em "Encerrar
      // Pergunta Aberta", essa nota ficava presa em jurorEntries e nunca
      // era promovida a jurorSubmittedItemIds, porque a única chamada a
      // checkAutoConfirmOpenItem acontecia dentro do handler
      // juror:setScore - e nessa altura awaitingJuryEvaluation ainda
      // era false. Agora, assim que awaitingJuryEvaluation passa a true
      // aqui, verificamos imediatamente se a avaliação já pode ser
      // confirmada.
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

      resetMatch(questionTime)

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

      partnersTimerHandle = setTimeout(() => {
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

        partnersTimerHandle = setTimeout(() => {
          if (liveState.phaseFlow.stage !== 'webtec') return

          liveState.phaseFlow = { stage: 'organizer', suspensePhrase: null }
          broadcast()

          if (isLastPhase) return

          partnersTimerHandle = setTimeout(async () => {
            if (liveState.phaseFlow.stage !== 'organizer') return

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
      resetMatch(questionTime)
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
      resetMatch(questionTime)
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
      const totalPhases = await getTotalPhases()
      if (liveState.phase !== totalPhases) return
      const phrase = await pickSuspensePhrase()
      liveState.podiumReveal.stage = 'suspense'
      liveState.podiumReveal.suspensePhrase = phrase
      liveState.podiumReveal.finalRankingVisible = false
      liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }
      broadcast()
      setTimeout(() => {
        liveState.podiumReveal.stage = 'countdown'
        liveState.podiumReveal.countdownValue = 10
        broadcast()
        const interval = setInterval(() => {
          liveState.podiumReveal.countdownValue -= 1
          if (liveState.podiumReveal.countdownValue <= 0) {
            clearInterval(interval)
            const top3 = [...liveState.championshipRankings]
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map((r) => ({
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
    })

    socket.on('moderator:showFinalRanking', () => {
      liveState.podiumReveal.finalRankingVisible = true
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

    socket.on('moderator:showPhaseTransition', () => {
      liveState.phaseTransition.stage = 'carousel'
      broadcast()
      setTimeout(() => {
        liveState.phaseTransition.stage = 'webtec'
        broadcast()
      }, 8000)
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
        if (liveState.currentItemSource !== 'analytic') return
        if (!liveState.analyticEvaluation || liveState.analyticEvaluation.itemId !== liveState.currentAnalyticItemId) return
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
      if (!liveState.analyticEvaluation || liveState.analyticEvaluation.itemId !== payload.itemId) return
      if (liveState.analyticEvaluation.jurorsSubmitted.includes(payload.jurorId)) return
      if (!liveState.jurors.some((j) => j.id === payload.jurorId)) return

      liveState.analyticEvaluation.jurorsSubmitted.push(payload.jurorId)
      broadcast()

      // Verifica se todos os jurados esperados submeteram
      const connectedCount = liveState.jurors.length
      const target =
        connectedCount > 0
          ? Math.min(liveState.expectedJurorCount || connectedCount, connectedCount)
          : liveState.expectedJurorCount

      if (target <= 0) return
      if (liveState.analyticEvaluation.jurorsSubmitted.length < target) return

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

        liveState.jurors.push({ id: juror.id, name: juror.name })
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
        liveState.jurors = liveState.jurors.filter((j) => j.id !== jurorId)
        liveState.jurorEntries = liveState.jurorEntries.filter((e) => e.jurorId !== jurorId)
        await checkAllJurorsSubmitted(broadcast)
        broadcast()
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
