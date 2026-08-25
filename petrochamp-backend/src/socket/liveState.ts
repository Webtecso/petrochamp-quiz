import { prisma } from '../db'

export interface LiveTeam {
  id: string
  name: string
  institution: string
  category: string
  logoUrl?: string | null
}

export interface PodiumEntry {
  id: string
  name: string
  institution: string
  score: number
}

export interface RankingEntry {
  teamId: string
  name: string
  institution: string
  score: number
}

export interface MatchCodes {
  teamACode: string | null
  teamBCode: string | null
  teamAConnected: boolean
  teamBConnected: boolean
  teamAPlayerName: string | null
  teamBPlayerName: string | null
}

export interface TiebreakState {
  active: boolean
  pending: boolean
  matchId: string | null
  currentQuestionId: string | null
  usedQuestionIds: string[]
}

export interface PodiumRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'revealed'
  countdownValue: number
  suspensePhrase: string | null
  finalRankingVisible: boolean
}

export interface RepescagemRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'voting' | 'results'
  countdownValue: number
  configId: string | null
  repescadaNames: string[]
}

export interface PhaseTransitionState {
  stage: 'idle' | 'carousel' | 'webtec'
}

export interface PhaseFlowState {
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

export interface ChampionRevealState {
  active: boolean
  teamName: string | null
  logoUrl: string | null
}

export interface JurorInfo {
  id: string
  name: string
}

export interface JurorScoreEntry {
  jurorId: string
  itemId: string
  scoreA: number
  scoreB: number
}

export interface InitialScoreEntry {
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

export interface ModeratorInfo {
  id: string
  name: string
  role: 'principal' | 'secundario'
}

// NOVO — nota de uma fase de Apresentação SEM ELIMINAÇÃO, guardada para
// ser combinada com o Quiz da fase seguinte. Ao contrário de
// presentationPhaseScores (que só existe dentro da mesma fase, para o tipo
// 'apresentacao_quiz'), esta lista TEM de sobreviver à transição de fase
// — por isso não é limpa em startNextPhase/advancePhase, só quando
// consumida (um confronto do Quiz seguinte usa a nota da equipa) ou
// quando o campeonato é reiniciado/abandonado/selecionado de novo.
export interface CarriedPresentationEntry {
  teamId: string
  name: string
  institution: string
  score: number
  presentationWeight: number
  quizWeight: number
}

export type PublicVotingStatus = 'idle' | 'starting' | 'online' | 'failed'

export interface LiveState {
  championship: string | null
  editionName: string | null
  teamA: LiveTeam | null
  teamB: LiveTeam | null
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
  repescagemReveal: RepescagemRevealState
  phaseTransition: PhaseTransitionState
  phaseFlow: PhaseFlowState
  championReveal: ChampionRevealState
  bracketVisible: boolean
  jurors: JurorInfo[]
  expectedJurorCount: number
  jurorEntries: JurorScoreEntry[]
  jurorSubmittedItemIds: string[]
  initialScoreEntries: InitialScoreEntry[]
  initialScoresConfirmed: boolean
  presentationFlow: PresentationFlowState
  presentationPhaseScores: RankingEntry[]
  presentationRoundReady: boolean
  carriedPresentationScores: CarriedPresentationEntry[]
  publicVotingUrl: string | null
  publicVotingStatus: PublicVotingStatus
  adminAccessedRemotely: boolean
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  usedAnalyticItemIds: string[]
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  awaitingJuryEvaluation: boolean
  moderatorAdjusting: boolean
  activeModerators: ModeratorInfo[]
  podium: {
    active: boolean
    phaseNumber: number
    phaseLabel: string
    isGrandFinal: boolean
    entries: PodiumEntry[]
  }
}

const DEFAULT_QUESTION_TIME = 30
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function generateJoinCode(length = 6): string {
  let code = ''
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]
  }
  return code
}

export function generateJurorCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function generateModeratorCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
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

export const liveState: LiveState = {
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
  timeLeft: DEFAULT_QUESTION_TIME,
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
  repescagemReveal: { stage: 'idle', countdownValue: 0, configId: null, repescadaNames: [] },
  phaseTransition: { stage: 'idle' },
  phaseFlow: { stage: 'idle', suspensePhrase: null },
  championReveal: { active: false, teamName: null, logoUrl: null },
  bracketVisible: false,
  jurors: [],
  expectedJurorCount: 0,
  jurorEntries: [],
  jurorSubmittedItemIds: [],
  initialScoreEntries: [],
  initialScoresConfirmed: false,
  presentationFlow: defaultPresentationFlow(),
  presentationPhaseScores: [],
  presentationRoundReady: false,
  carriedPresentationScores: [],
  publicVotingUrl: null,
  publicVotingStatus: 'idle',
  adminAccessedRemotely: false,
  currentItemSource: null,
  currentAnalyticItemId: null,
  usedAnalyticItemIds: [],
  currentItemMode: null,
  awaitingJuryEvaluation: false,
  moderatorAdjusting: false,
  activeModerators: [],
  podium: {
    active: false,
    phaseNumber: 1,
    phaseLabel: '',
    isGrandFinal: false,
    entries: []
  }
}

export function resetAnswerState(): void {
  liveState.teamAAnswer = null
  liveState.teamBAnswer = null
  liveState.teamACorrect = null
  liveState.teamBCorrect = null
}

export function resetMatch(questionTimeSeconds: number): void {
  liveState.teamA = null
  liveState.teamB = null
  liveState.teamAScore = 0
  liveState.teamBScore = 0
  liveState.currentQuestionId = null
  liveState.currentQuestionIndex = 0
  liveState.activeTeam = 'A'
  liveState.teamAAnsweredCount = 0
  liveState.teamBAnsweredCount = 0
  liveState.timeLeft = questionTimeSeconds
  liveState.isRunning = false
  liveState.countdown = { active: false, value: 0 }
  liveState.tiebreak = { active: false, pending: false, matchId: null, currentQuestionId: null, usedQuestionIds: [] }
  liveState.matchStartedAt = null
  liveState.matchCodes = {
    teamACode: null,
    teamBCode: null,
    teamAConnected: false,
    teamBConnected: false,
    teamAPlayerName: null,
    teamBPlayerName: null
  }
  liveState.jurors = []
  liveState.jurorEntries = []
  liveState.jurorSubmittedItemIds = []
  liveState.initialScoreEntries = []
  liveState.initialScoresConfirmed = false
  liveState.currentItemSource = null
  liveState.currentAnalyticItemId = null
  liveState.usedAnalyticItemIds = []
  liveState.currentItemMode = null
  liveState.awaitingJuryEvaluation = false
  liveState.moderatorAdjusting = false
  resetAnswerState()
}

export function resetPresentationFlow(): void {
  liveState.presentationFlow = defaultPresentationFlow()
}

export function addToPhaseRanking(team: LiveTeam | null, score: number): void {
  if (!team) return
  const existing = liveState.phaseRankings.find((r) => r.teamId === team.id)
  if (existing) {
    existing.score += score
  } else {
    liveState.phaseRankings.push({ teamId: team.id, name: team.name, institution: team.institution, score })
  }
}

export function addToChampionshipRanking(team: LiveTeam | null, score: number): void {
  if (!team) return
  const existing = liveState.championshipRankings.find((r) => r.teamId === team.id)
  if (existing) {
    existing.score += score
  } else {
    liveState.championshipRankings.push({ teamId: team.id, name: team.name, institution: team.institution, score })
  }
}

export async function persistLiveState(): Promise<void> {
  try {
    await prisma.liveSession.upsert({
      where: { id: 'singleton' },
      update: { data: JSON.stringify(liveState) },
      create: { id: 'singleton', data: JSON.stringify(liveState) }
    })
  } catch (error) {
    console.error('Falha ao gravar estado da partida', error)
  }
}

export async function loadPersistedState(): Promise<void> {
  try {
    const row = await prisma.liveSession.findUnique({ where: { id: 'singleton' } })
    if (row) {
      const parsed = JSON.parse(row.data) as Partial<LiveState>
      Object.assign(liveState, parsed)
      liveState.presentationFlow = {
        ...defaultPresentationFlow(),
        ...liveState.presentationFlow,
        slides: Array.isArray(liveState.presentationFlow?.slides) ? liveState.presentationFlow.slides : []
      }
      if (!Array.isArray(liveState.carriedPresentationScores)) {
        liveState.carriedPresentationScores = []
      }
      liveState.publicVotingUrl = null
      liveState.publicVotingStatus = 'idle'
      liveState.adminAccessedRemotely = false
      console.log('Estado da partida recuperado do último encerramento.')
    }
  } catch (error) {
    console.error('Falha ao recuperar estado da partida (a começar do zero)', error)
  }
}
