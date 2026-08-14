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
  stage: 'idle' | 'repescagem' | 'ranking' | 'partnersPending' | 'partners' | 'webtec' | 'organizer' | 'suspense'
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

export interface PresentationSlideInfo {
  order: number
  imageUrl: string
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
  slides: PresentationSlideInfo[]
  currentPage: number
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
  initialScoreEntries: InitialScoreEntry[]
  initialScoresConfirmed: boolean
  presentationFlow: PresentationFlowState
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
    initialScoreEntries: [],
    initialScoresConfirmed: false,
    presentationFlow: defaultPresentationFlow(),
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
    repescagemReveal: { stage: 'idle', countdownValue: 0, configId: null, repescadaNames: [] }
  }),
  actions: {
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
      getSocket().emit('juror:setPresentationScore', { jurorId, criteriaId, score })
    },
    submitPresentationEvaluation(jurorId: string) {
      getSocket().emit('juror:submitPresentationEvaluation', { jurorId })
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
    enterAdmin() {
      getSocket().emit('moderator:enterAdmin')
    },
    exitAdmin() {
      getSocket().emit('moderator:exitAdmin')
    }
  }
})
