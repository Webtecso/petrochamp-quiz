import { defineStore } from 'pinia'
import { getSocket } from '../services/socket'
import type { PodiumEntry } from '../data/podiumResults'

export type ChampionshipType = 'universitario' | 'ensino_medio' | 'exibicao'

export interface Team {
  id: string
  name: string
  institution: string
  category: ChampionshipType
  logoUrl?: string | null
}

export interface RankingEntry {
  teamId: string
  name: string
  institution: string
  score: number
}

interface MatchCodes {
  teamACode: string | null
  teamBCode: string | null
  teamAConnected: boolean
  teamBConnected: boolean
  teamAPlayerName: string | null
  teamBPlayerName: string | null
}

interface TiebreakState {
  active: boolean
  pending: boolean
  matchId: number | null
  currentQuestionId: number | null
  usedQuestionIds: number[]
}

interface PodiumRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'revealed'
  countdownValue: number
  suspensePhrase: string | null
  finalRankingVisible: boolean
}

interface PhaseTransitionState {
  stage: 'idle' | 'carousel' | 'webtec'
}

interface PhaseFlowState {
  stage:
    | 'idle'
    | 'battleEnded'
    | 'repescagem'
    | 'ranking'
    | 'presentationRanking'
    | 'partnersPending'
    | 'partners'
    | 'webtec'
    | 'organizer'
    | 'suspense'
    | 'quizIntro'
  suspensePhrase: string | null
}

interface ChampionRevealState {
  active: boolean
  teamName: string | null
  logoUrl: string | null
}

interface RepescagemRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'voting' | 'results'
  countdownValue: number
  configId: number | null
  repescadaNames: string[]
}

interface InitialScoreEntry {
  jurorId: string
  scoreA: number
  scoreB: number
}

export interface PresentationCriteriaScoreEntry {
  jurorId: string
  criteriaId: number
  score: number
}

export interface PresentationFlowState {
  stage: 'idle' | 'countdown' | 'presenting' | 'concluded'
  duplaId: number | null
  teamId: string | null
  teamName: string | null
  theme: string | null
  timeLeft: number
  presentedTeamIds: string[]
  criteriaScores: PresentationCriteriaScoreEntry[]
  jurorsSubmitted: string[]
  allJurorsSubmitted: boolean
  presentationMode: 'standard' | 'document'
  currentPage: number
  totalPages: number
}

export interface AnalyticCriteriaScoreEntry {
  jurorId: string
  criteriaId: string
  team: 'A' | 'B'
  score: number
}

export interface AnalyticEvaluationState {
  itemId: string | null
  criteriaScores: AnalyticCriteriaScoreEntry[]
  jurorsSubmitted: string[]
  expectedJurorCount: number
}

interface LiveState {
  championship: ChampionshipType | null
  editionName: string | null
  teamA: Team | null
  teamB: Team | null
  teamAScore: number
  teamBScore: number
  phase: number
  currentQuestionId: number | null
  currentQuestionIndex: number
  activeTeam: 'A' | 'B'
  usedQuestionIds: number[]
  teamAAnsweredCount: number
  teamBAnsweredCount: number
  timeLeft: number
  isRunning: boolean
  matchCodes: MatchCodes
  matchStartedAt: number | null
  phaseRankings: RankingEntry[]
  championshipRankings: RankingEntry[]
  championshipStartedAt: number | null
  eliminatedTeamIds: string[]
  phaseRankingReveal: { visible: boolean }
  teamAAnswer: string | null
  teamBAnswer: string | null
  teamACorrect: boolean | null
  teamBCorrect: boolean | null
  countdown: { active: boolean; value: number }
  tiebreak: TiebreakState
  podiumReveal: PodiumRevealState
  phaseTransition: PhaseTransitionState
  phaseFlow: PhaseFlowState
  championReveal: ChampionRevealState
  bracketVisible: boolean
  expectedJurorCount: number
  initialScoreEntries: InitialScoreEntry[]
  initialScoresConfirmed: boolean
  presentationFlow: PresentationFlowState
  // NOVO - notas de apresentação da fase 'apresentacao_quiz' (uma
  // entrada por equipa, só a média das notas dos jurados, sem pesos
  // aplicados ainda). O backend já enviava isto no state:sync; faltava
  // na tipagem do store, por isso nunca era usado no frontend.
  presentationPhaseScores: RankingEntry[]
  presentationRoundReady: boolean
  analyticEvaluation: AnalyticEvaluationState
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  awaitingJuryEvaluation: boolean
  moderatorAdjusting: boolean
  podium: {
    active: boolean
    phaseNumber: number
    phaseLabel: string
    isGrandFinal: boolean
    entries: PodiumEntry[]
  }
  publicVotingUrl: string | null
  publicVotingStatus: 'idle' | 'starting' | 'online' | 'failed'
  adminAccessedRemotely: boolean
  repescagemReveal: RepescagemRevealState
}

function defaultPresentationFlow(): PresentationFlowState {
  return {
    stage: 'idle',
    duplaId: null,
    teamId: null,
    teamName: null,
    theme: null,
    timeLeft: 0,
    presentedTeamIds: [],
    criteriaScores: [],
    jurorsSubmitted: [],
    allJurorsSubmitted: false,
    presentationMode: 'standard',
    currentPage: 1,
    totalPages: 0 
  }
}

function defaultAnalyticEvaluation(): AnalyticEvaluationState {
  return {
    itemId: null,
    criteriaScores: [],
    jurorsSubmitted: [],
    expectedJurorCount: 0
  }
}

const presentationScoreDebounce: Record<string, ReturnType<typeof setTimeout>> = {}
const analyticScoreDebounce: Record<string, ReturnType<typeof setTimeout>> = {}
const PRESENTATION_SCORE_DEBOUNCE_MS = 400
const ANALYTIC_SCORE_DEBOUNCE_MS = 400

export const useCampeonatoStore = defineStore('campeonato', {
  state: (): LiveState => ({
    championship: null,
    editionName: null,
    teamA: null,
    teamB: null,
    teamAScore: 0,
    teamBScore: 0,
    phase: 1,
    currentQuestionId: null,
    currentQuestionIndex: 0,
    activeTeam: 'A',
    usedQuestionIds: [],
    teamAAnsweredCount: 0,
    teamBAnsweredCount: 0,
    timeLeft: 30,
    isRunning: false,
    matchCodes: {
      teamACode: null,
      teamBCode: null,
      teamAConnected: false,
      teamBConnected: false,
      teamAPlayerName: null,
      teamBPlayerName: null
    },
    matchStartedAt: null,
    phaseRankings: [],
    championshipRankings: [],
    championshipStartedAt: null,
    eliminatedTeamIds: [],
    phaseRankingReveal: { visible: false },
    teamAAnswer: null,
    teamBAnswer: null,
    teamACorrect: null,
    teamBCorrect: null,
    countdown: { active: false, value: 0 },
    tiebreak: { active: false, pending: false, matchId: null, currentQuestionId: null, usedQuestionIds: [] },
    podiumReveal: { stage: 'idle', countdownValue: 0, suspensePhrase: null, finalRankingVisible: false },
    phaseTransition: { stage: 'idle' },
    phaseFlow: { stage: 'idle', suspensePhrase: null },
    championReveal: { active: false, teamName: null, logoUrl: null },
    bracketVisible: false,
    expectedJurorCount: 0,
    initialScoreEntries: [],
    initialScoresConfirmed: false,
    presentationFlow: defaultPresentationFlow(),
    presentationPhaseScores: [],
    presentationRoundReady: false,
    analyticEvaluation: defaultAnalyticEvaluation(),
    currentItemSource: null,
    currentAnalyticItemId: null,
    currentItemMode: null,
    awaitingJuryEvaluation: false,
    moderatorAdjusting: false,
    podium: {
      active: false,
      phaseNumber: 1,
      phaseLabel: '',
      isGrandFinal: false,
      entries: []
    },
    publicVotingUrl: null,
    publicVotingStatus: 'idle',
    adminAccessedRemotely: false,
    repescagemReveal: { stage: 'idle', countdownValue: 0, configId: null, repescadaNames: [] }
  }),
  actions: {
    enterAdmin() {
      this.adminAccessedRemotely = true
    },
    exitAdmin() {
      this.adminAccessedRemotely = false
    },
    listenToServer() {
      getSocket().on('state:sync', (incoming: LiveState) => {
        this.$patch((state) => {
          Object.assign(state, incoming)
          if (incoming.presentationFlow) {
            state.presentationFlow = { ...incoming.presentationFlow }
          }
        })
      })
    },
    selectChampionship(type: ChampionshipType, editionName?: string): Promise<void> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:selectChampionship', { championship: type, editionName }, () => resolve())
      })
    },
    selectTeams(a: Team, b: Team): Promise<boolean> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:selectTeams', { teamAId: a.id, teamBId: b.id }, (ok: boolean) => resolve(ok))
      })
    },
    addScoreToTeam(team: 'A' | 'B', amount: number) {
      getSocket().emit('moderator:addScore', { team, amount })
    },
    startTimer() {
      getSocket().emit('moderator:startTimer')
    },
    pauseTimer() {
      getSocket().emit('moderator:pauseTimer')
    },
    confirmQuizIntro() {
      getSocket().emit('moderator:confirmQuizIntro')
    },
    nextQuestion() {
      getSocket().emit('moderator:nextQuestion')
    },
    forceQuestion(questionId: number) {
      getSocket().emit('moderator:forceQuestion', { questionId })
    },
    endOpenQuestion() {
      getSocket().emit('moderator:endOpenQuestion')
    },
    submitPlayerAnswer(team: 'A' | 'B', optionLabel: string) {
      getSocket().emit('player:submitAnswer', { team, optionLabel })
    },
    startTiebreak() {
      getSocket().emit('moderator:startTiebreak')
    },
    submitTiebreakAnswer(team: 'A' | 'B', optionLabel: string) {
      getSocket().emit('tiebreak:submitAnswer', { team, optionLabel })
    },
    finishMatch() {
      getSocket().emit('moderator:finishMatch')
    },
    continueAfterBattleEnded() {
      getSocket().emit('moderator:continueAfterBattleEnded')
    },
    continueAfterRepescagem() {
      getSocket().emit('moderator:continueAfterRepescagem')
    },
    advancePhase(force = false): Promise<{ success: boolean; error?: string } | void> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:advancePhase', { force }, (res?: { success?: boolean; error?: string }) => {
          const safeRes: { success: boolean; error?: string } =
            res && typeof res.success === 'boolean'
              ? { success: res.success, error: res.error }
              : { success: true }
          resolve(safeRes)
        })
      })
    },
    showPartners() {
      getSocket().emit('moderator:showPartners')
    },
    skipInstitutionalSequence() {
      getSocket().emit('moderator:skipInstitutionalSequence')
    },
    startNextPhase(force = false): Promise<{ success: boolean; error?: string } | void> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:startNextPhase', { force }, (res?: { success?: boolean; error?: string }) => {
          const safeRes: { success: boolean; error?: string } =
            res && typeof res.success === 'boolean'
              ? { success: res.success, error: res.error }
              : { success: true }
          resolve(safeRes)
        })
      })
    },
    startQuizPhase(force = false): Promise<{ success: boolean; error?: string } | void> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:startQuizPhase', { force }, (res?: { success?: boolean; error?: string }) => {
          const safeRes: { success: boolean; error?: string } =
            res && typeof res.success === 'boolean'
              ? { success: res.success, error: res.error }
              : { success: true }
          resolve(safeRes)
        })
      })
    },
    finalizeChampionship(force = false): Promise<{ success: boolean; error?: string } | void> {
      return new Promise((resolve) => {
        getSocket().emit('moderator:finalizeChampionship', { force }, (res?: { success?: boolean; error?: string }) => {
          const safeRes: { success: boolean; error?: string } =
            res && typeof res.success === 'boolean'
              ? { success: res.success, error: res.error }
              : { success: true }
          resolve(safeRes)
        })
      })
    },
    resetChampionship() {
      getSocket().emit('moderator:resetChampionship')
    },
    abandonChampionship() {
      getSocket().emit('moderator:abandonChampionship')
    },
    showPhaseRanking() {
      getSocket().emit('moderator:showPhaseRanking')
    },
    hidePhaseRanking() {
      getSocket().emit('moderator:hidePhaseRanking')
    },
    showPodium(phaseNumber: number, phaseLabel: string, entries: PodiumEntry[], isGrandFinal = false) {
      getSocket().emit('moderator:showPodium', { phaseNumber, phaseLabel, entries, isGrandFinal })
    },
    hidePodium() {
      getSocket().emit('moderator:hidePodium')
    },
    startFinalPodiumSequence() {
      getSocket().emit('moderator:startFinalPodiumSequence')
    },
    showFinalRanking() {
      getSocket().emit('moderator:showFinalRanking')
    },
    hideFinalRanking() {
      getSocket().emit('moderator:hideFinalRanking')
    },
    showPhaseTransition() {
      getSocket().emit('moderator:showPhaseTransition')
    },
    hidePhaseTransition() {
      getSocket().emit('moderator:hidePhaseTransition')
    },
    openRepescagemVoting(configId: number) {
      getSocket().emit('moderator:openRepescagemVoting', { configId })
    },
    closeRepescagemVoting(configId: number) {
      getSocket().emit('moderator:closeRepescagemVoting', { configId })
    },
    setInitialScore(jurorId: string, scoreA: number, scoreB: number) {
      getSocket().emit('juror:setInitialScore', { jurorId, scoreA, scoreB })
    },
    confirmInitialScores() {
      getSocket().emit('moderator:confirmInitialScores')
    },
    startPresentation(duplaId: number, teamId: string, useDocument = false) {
      getSocket().emit('moderator:startPresentation', { duplaId, teamId, useDocument })
    },
    finishPresentation() {
      getSocket().emit('moderator:finishPresentation')
    },
    setPresentationScore(jurorId: string, criteriaId: number, score: number) {
      const existing = this.presentationFlow.criteriaScores.find(
        (e) => e.jurorId === jurorId && e.criteriaId === criteriaId
      )
      if (existing) {
        existing.score = score
      } else {
        this.presentationFlow.criteriaScores.push({ jurorId, criteriaId, score })
      }

      const key = `${jurorId}::${criteriaId}`
      if (presentationScoreDebounce[key]) clearTimeout(presentationScoreDebounce[key])
      presentationScoreDebounce[key] = setTimeout(() => {
        getSocket().emit('juror:setPresentationScore', { jurorId, criteriaId, score })
        delete presentationScoreDebounce[key]
      }, PRESENTATION_SCORE_DEBOUNCE_MS)
    },
    submitPresentationEvaluation(jurorId: string) {
      getSocket().emit('juror:submitPresentationEvaluation', { jurorId })
    },
    confirmPresentationRanking() {
      getSocket().emit('moderator:confirmPresentationRanking')
    },
    advanceToNextPresentation() {
      getSocket().emit('moderator:advanceToNextPresentation')
    },
    nextPresentationPage() {
      getSocket().emit('moderator:presentationNextPage')
    },
    prevPresentationPage() {
      getSocket().emit('moderator:presentationPrevPage')
    },
    setAnalyticCriteriaScore(jurorId: string, criteriaId: string, team: 'A' | 'B', score: number) {
      const existing = this.analyticEvaluation.criteriaScores.find(
        (e) => e.jurorId === jurorId && e.criteriaId === criteriaId && e.team === team
      )
      if (existing) {
        existing.score = score
      } else {
        this.analyticEvaluation.criteriaScores.push({ jurorId, criteriaId, team, score })
      }

      const key = `${jurorId}::${criteriaId}::${team}`
      if (analyticScoreDebounce[key]) clearTimeout(analyticScoreDebounce[key])
      analyticScoreDebounce[key] = setTimeout(() => {
        getSocket().emit('juror:setAnalyticCriteriaScore', { jurorId, criteriaId, team, score })
        delete analyticScoreDebounce[key]
      }, ANALYTIC_SCORE_DEBOUNCE_MS)
    },
    submitAnalyticEvaluation(jurorId: string, itemId: string) {
      getSocket().emit('juror:submitAnalyticEvaluation', { jurorId, itemId })
    }
  }
})
