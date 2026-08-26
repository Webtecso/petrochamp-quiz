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
  matchId: string | null
  currentQuestionId: string | null
  usedQuestionIds: string[]
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
    | 'repescagem'
    | 'ranking'
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
  configId: string | null
  repescadaNames: string[]
}

interface InitialScoreEntry {
  jurorId: string
  scoreA: number
  scoreB: number
}

export interface PresentationCriteriaScoreEntry {
  jurorId: string
  criteriaId: string
  score: number
}

export interface PresentationSlideInfo {
  order: number
  imageUrl: string
}

export interface PresentationFlowState {
  stage: 'idle' | 'countdown' | 'presenting' | 'concluded'
  duplaId: string | null
  teamId: string | null
  teamName: string | null
  theme: string | null
  timeLeft: number
  presentedTeamIds: string[]
  criteriaScores: PresentationCriteriaScoreEntry[]
  jurorsSubmitted: string[]
  allJurorsSubmitted: boolean
  presentationMode: 'standard' | 'document'
  slides: PresentationSlideInfo[]
  currentPage: number
}

// NOVO — espelha AnalyticCriteriaScoreEntry do backend (liveState.ts).
export interface AnalyticCriteriaScoreEntry {
  jurorId: string
  criteriaId: string
  team: 'A' | 'B'
  score: number
}

// NOVO — espelha AnalyticEvaluationState do backend.
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
  currentQuestionId: string | null
  currentQuestionIndex: number
  activeTeam: 'A' | 'B'
  usedQuestionIds: string[]
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
    slides: [],
    currentPage: 1
  }
}

// NOVO — valor inicial local do painel de avaliação analítica.
function defaultAnalyticEvaluation(): AnalyticEvaluationState {
  return {
    itemId: null,
    criteriaScores: [],
    jurorsSubmitted: [],
    expectedJurorCount: 0
  }
}

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
    forceQuestion(questionId: string) {
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
    continueAfterRepescagem() {
      getSocket().emit('moderator:continueAfterRepescagem')
    },
    advancePhase() {
      getSocket().emit('moderator:advancePhase')
    },
    showPartners() {
      getSocket().emit('moderator:showPartners')
    },
    startNextPhase() {
      getSocket().emit('moderator:startNextPhase')
    },
    finalizeChampionship() {
      getSocket().emit('moderator:finalizeChampionship')
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
    showPhaseTransition() {
      getSocket().emit('moderator:showPhaseTransition')
    },
    hidePhaseTransition() {
      getSocket().emit('moderator:hidePhaseTransition')
    },
    openRepescagemVoting(configId: string) {
      getSocket().emit('moderator:openRepescagemVoting', { configId })
    },
    closeRepescagemVoting(configId: string) {
      getSocket().emit('moderator:closeRepescagemVoting', { configId })
    },
    setInitialScore(jurorId: string, scoreA: number, scoreB: number) {
      getSocket().emit('juror:setInitialScore', { jurorId, scoreA, scoreB })
    },
    confirmInitialScores() {
      getSocket().emit('moderator:confirmInitialScores')
    },
    startPresentation(duplaId: string, teamId: string, useDocument = false) {
      getSocket().emit('moderator:startPresentation', { duplaId, teamId, useDocument })
    },
    finishPresentation() {
      getSocket().emit('moderator:finishPresentation')
    },
    setPresentationScore(jurorId: string, criteriaId: string, score: number) {
      getSocket().emit('juror:setPresentationScore', { jurorId, criteriaId, score })
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
      getSocket().emit('juror:setAnalyticCriteriaScore', { jurorId, criteriaId, team, score })
    },
    submitAnalyticEvaluation(jurorId: string, itemId: string) {
      getSocket().emit('juror:submitAnalyticEvaluation', { jurorId, itemId })
    }
  }
})
