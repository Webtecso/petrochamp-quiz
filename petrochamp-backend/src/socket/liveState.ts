import { prisma } from '../db'

export type ChampionshipType = 'universitario' | 'ensino_medio' | 'exibicao'

export interface Team {
  id: string
  name: string
  institution: string
  category: string
  logoUrl: string | null
  group: string | null
  bracketPosition: number | null
}

export interface RankingEntry {
  teamId: string
  name: string
  institution: string
  score: number
}

export interface PodiumEntry {
  id: string
  name: string
  institution: string
  score: number
}

export interface ModeratorInfo {
  id: string
  name: string
  role: 'principal' | 'secundario'
}

export interface ScoreEntry {
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

// criteriaId é um cuid (String) no schema.prisma, não number.
export interface CriteriaScoreEntry {
  jurorId: string
  criteriaId: string
  score: number
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

// duplaId é um cuid (String) no schema.prisma, não number.
export interface PresentationFlowState {
  stage: 'idle' | 'countdown' | 'presenting' | 'concluded'
  duplaId: string | null
  teamId: string | null
  teamName: string | null
  theme: string | null
  timeLeft: number
  presentedTeamIds: string[]
  criteriaScores: CriteriaScoreEntry[]
  jurorsSubmitted: string[]
  allJurorsSubmitted: boolean

  // Agora a apresentação usa o PPTX original.
  // O backend apenas informa se existe um documento.
  // O viewer é responsável por renderizar o PPTX.
  presentationMode: 'standard' | 'document'

  // Página atualmente sincronizada entre moderador e projeção.
  currentPage: number,
  totalPages: number
}

// Pontuação de apresentação "transportada" para a ronda de Quiz seguinte,
// usada na fase 'apresentacao' com noElimination ativo.
export interface CarriedPresentationScoreEntry {
  teamId: string
  name: string
  institution: string
  score: number
  presentationWeight: number
  quizWeight: number
}

export interface TiebreakState {
  active: boolean
  pending: boolean
  matchId: string | null
  currentQuestionId: string | null
  usedQuestionIds: string[]
}

export interface RepescagemRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'voting' | 'results'
  countdownValue: number
  configId: string | null
  repescadaNames: string[]
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
    | 'battleEnded'
    | 'presentationRanking'
  suspensePhrase: string | null
}

export interface PodiumState {
  active: boolean
  phaseNumber: number
  phaseLabel: string
  isGrandFinal: boolean
  entries: PodiumEntry[]
}

export interface PodiumRevealState {
  stage: 'idle' | 'suspense' | 'countdown' | 'revealed'
  countdownValue: number
  suspensePhrase: string | null
  finalRankingVisible: boolean
}

export interface PhaseTransitionState {
  stage: 'idle' | 'carousel' | 'webtec'
}

export interface MatchCodesState {
  teamACode: string
  teamBCode: string
  teamAConnected: boolean
  teamBConnected: boolean
  teamAPlayerName: string | null
  teamBPlayerName: string | null
}

export interface CountdownState {
  active: boolean
  value: number
}

export interface ChampionReveal {
  active: boolean
  teamName: string | null
  logoUrl: string | null
}

export interface PhaseRankingReveal {
  visible: boolean
}

export type PublicVotingStatus = 'idle' | 'starting' | 'online' | 'failed'

export interface LiveState {
  championship: string | null
  editionName: string | null
  phase: number
  championshipStartedAt: number | null
  matchStartedAt: number | null

  teamA: Team | null
  teamB: Team | null
  teamAScore: number
  teamBScore: number
  teamAAnsweredCount: number
  teamBAnsweredCount: number
  currentQuestionIndex: number

  currentQuestionId: string | null
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  activeTeam: 'A' | 'B'
  timeLeft: number
  isRunning: boolean
  usedQuestionIds: string[]
  usedAnalyticItemIds: string[]

  teamAAnswer: string | null
  teamBAnswer: string | null
  teamACorrect: boolean | null
  teamBCorrect: boolean | null

  awaitingJuryEvaluation: boolean
  analyticEvaluation: AnalyticEvaluationState

  countdown: CountdownState
  matchCodes: MatchCodesState

  tiebreak: TiebreakState

  jurors: { id: string; name: string }[]
  jurorEntries: ScoreEntry[]
  jurorSubmittedItemIds: string[]
  initialScoreEntries: InitialScoreEntry[]
  initialScoresConfirmed: boolean

  activeModerators: ModeratorInfo[]
  moderatorAdjusting: boolean

  presentationFlow: PresentationFlowState
  presentationPhaseScores: RankingEntry[]
  carriedPresentationScores: CarriedPresentationScoreEntry[]

  phaseRankings: RankingEntry[]
  championshipRankings: RankingEntry[]
  eliminatedTeamIds: string[]
  phaseRankingReveal: PhaseRankingReveal

  phaseFlow: PhaseFlowState
  presentationRoundReady: boolean
  expectedJurorCount: number

  repescagemReveal: RepescagemRevealState

  bracketVisible: boolean

  podium: PodiumState
  podiumReveal: PodiumRevealState
  championReveal: ChampionReveal
  phaseTransition: PhaseTransitionState

  publicVotingUrl: string | null
  publicVotingStatus: PublicVotingStatus
}

export const liveState: LiveState = {
  championship: null,
  editionName: null,
  phase: 1,
  championshipStartedAt: null,
  matchStartedAt: null,

  teamA: null,
  teamB: null,
  teamAScore: 0,
  teamBScore: 0,
  teamAAnsweredCount: 0,
  teamBAnsweredCount: 0,
  currentQuestionIndex: 0,

  currentQuestionId: null,
  currentItemSource: null,
  currentAnalyticItemId: null,
  currentItemMode: null,
  activeTeam: 'A',
  timeLeft: 30,
  isRunning: false,
  usedQuestionIds: [],
  usedAnalyticItemIds: [],

  teamAAnswer: null,
  teamBAnswer: null,
  teamACorrect: null,
  teamBCorrect: null,

  awaitingJuryEvaluation: false,

  analyticEvaluation: {
    itemId: null,
    criteriaScores: [],
    jurorsSubmitted: [],
    expectedJurorCount: 0
  },

  countdown: {
    active: false,
    value: 0
  },

  matchCodes: {
    teamACode: '',
    teamBCode: '',
    teamAConnected: false,
    teamBConnected: false,
    teamAPlayerName: null,
    teamBPlayerName: null
  },

  tiebreak: {
    active: false,
    pending: false,
    matchId: null,
    currentQuestionId: null,
    usedQuestionIds: []
  },

  jurors: [],
  jurorEntries: [],
  jurorSubmittedItemIds: [],
  initialScoreEntries: [],
  initialScoresConfirmed: false,

  activeModerators: [],
  moderatorAdjusting: false,

  presentationFlow: {
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

    // Sem slides.
    presentationMode: 'standard',

    // Página atual do PPTX.
    currentPage: 1,
    totalPages: 0
  },

  presentationPhaseScores: [],
  carriedPresentationScores: [],

  phaseRankings: [],
  championshipRankings: [],
  eliminatedTeamIds: [],

  phaseRankingReveal: {
    visible: false
  },

  phaseFlow: {
    stage: 'idle',
    suspensePhrase: null
  },

  presentationRoundReady: false,
  expectedJurorCount: 0,

  repescagemReveal: {
    stage: 'idle',
    countdownValue: 0,
    configId: null,
    repescadaNames: []
  },

  bracketVisible: false,

  podium: {
    active: false,
    phaseNumber: 1,
    phaseLabel: '',
    isGrandFinal: false,
    entries: []
  },

  podiumReveal: {
    stage: 'idle',
    countdownValue: 0,
    suspensePhrase: null,
    finalRankingVisible: false
  },

  championReveal: {
    active: false,
    teamName: null,
    logoUrl: null
  },

  phaseTransition: {
    stage: 'idle'
  },

  publicVotingUrl: null,
  publicVotingStatus: 'idle'
}

export function generateJoinCode(length = 6): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

  let code = ''

  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }

  return code
}

export function generateJurorCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function generateModeratorCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function resetAnswerState(): void {
  liveState.teamAAnswer = null
  liveState.teamBAnswer = null
  liveState.teamACorrect = null
  liveState.teamBCorrect = null
}

export function resetPresentationFlow(): void {
  liveState.presentationFlow = {
    stage: 'idle',
    duplaId: null,
    teamId: null,
    teamName: null,
    theme: null,
    timeLeft: 0,
    presentedTeamIds: [], // limpa sempre
    criteriaScores: [],
    jurorsSubmitted: [],
    allJurorsSubmitted: false,
    presentationMode: 'standard',
    currentPage: 1,
    totalPages: 0
  }
  liveState.presentationRoundReady = false
}

export function resetMatch(questionTimeSeconds: number, resetPhase = true): void {
  liveState.teamA = null
  liveState.teamB = null
  liveState.teamAScore = 0
  liveState.teamBScore = 0
  liveState.teamAAnsweredCount = 0
  liveState.teamBAnsweredCount = 0
  liveState.currentQuestionIndex = 0

  liveState.presentationPhaseScores = []
  liveState.carriedPresentationScores = []
  liveState.presentationRoundReady = false
  liveState.usedQuestionIds = []
  liveState.usedAnalyticItemIds = []
  liveState.phaseFlow = { stage: 'idle', suspensePhrase: null }

  if (resetPhase) {
    liveState.phase = 1
  }

  liveState.currentQuestionId = null
  liveState.currentItemSource = null
  liveState.currentAnalyticItemId = null
  liveState.currentItemMode = null

  liveState.activeTeam = 'A'
  liveState.timeLeft = questionTimeSeconds
  liveState.isRunning = false

  liveState.usedQuestionIds = []
  liveState.usedAnalyticItemIds = []

  liveState.awaitingJuryEvaluation = false

  liveState.analyticEvaluation = {
    itemId: null,
    criteriaScores: [],
    jurorsSubmitted: [],
    expectedJurorCount: 0
  }

  resetAnswerState()

  liveState.matchStartedAt = null

  liveState.jurors = []
  liveState.jurorEntries = []
  liveState.jurorSubmittedItemIds = []
  liveState.initialScoreEntries = []
  liveState.initialScoresConfirmed = false

  liveState.tiebreak = {
    active: false,
    pending: false,
    matchId: null,
    currentQuestionId: null,
    usedQuestionIds: []
  }

  liveState.matchCodes = {
    teamACode: '',
    teamBCode: '',
    teamAConnected: false,
    teamBConnected: false,
    teamAPlayerName: null,
    teamBPlayerName: null
  }
}

export function addToPhaseRanking(team: Team | null, score: number): void {
  if (!team) return

  const existing = liveState.phaseRankings.find(
    (r) => r.teamId === team.id
  )

  if (existing) {
    existing.score += score
  } else {
    liveState.phaseRankings.push({
      teamId: team.id,
      name: team.name,
      institution: team.institution,
      score
    })
  }
}

export function addToChampionshipRanking(
  team: Team | null,
  score: number
): void {
  if (!team) return

  const existing = liveState.championshipRankings.find(
    (r) => r.teamId === team.id
  )

  if (existing) {
    existing.score += score
  } else {
    liveState.championshipRankings.push({
      teamId: team.id,
      name: team.name,
      institution: team.institution,
      score
    })
  }
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null

export function persistLiveState(): void {
  if (saveTimeout) {
    clearTimeout(saveTimeout)
  }

  saveTimeout = setTimeout(async () => {
    try {
      await prisma.setting.upsert({
        where: {
          key: 'liveStateSnapshot'
        },
        update: {
          value: JSON.stringify(liveState)
        },
        create: {
          key: 'liveStateSnapshot',
          value: JSON.stringify(liveState)
        }
      })
    } catch (err) {
      console.error(
        'Falha ao persistir o estado da partida:',
        err
      )
    }
  }, 1500)
}

export async function loadPersistedState(): Promise<void> {
  try {
    const row = await prisma.setting.findUnique({
      where: {
        key: 'liveStateSnapshot'
      }
    })

    if (!row) return

    const parsed = JSON.parse(row.value) as Partial<LiveState>

    Object.assign(liveState, parsed)

    // Compatibilidade com snapshots antigos.
    if (!liveState.analyticEvaluation) {
      liveState.analyticEvaluation = {
        itemId: null,
        criteriaScores: [],
        jurorsSubmitted: [],
        expectedJurorCount: 0
      }
    }

    // Compatibilidade com snapshots antigos que ainda possuíam slides.
    // O novo sistema trabalha exclusivamente com PPTX original.
    if (!liveState.presentationFlow) {
      resetPresentationFlow()
    } else {
      delete (liveState.presentationFlow as any).slides

      if (
        typeof liveState.presentationFlow.currentPage !== 'number' ||
        liveState.presentationFlow.currentPage < 1
      ) {
        liveState.presentationFlow.currentPage = 1
      }

      if (!liveState.presentationFlow.presentationMode) {
        liveState.presentationFlow.presentationMode = 'standard'
      }
    }

    console.log(
      'Estado da partida recuperado do último encerramento.'
    )
  } catch (err) {
    console.error(
      'Falha ao recuperar o estado da partida:',
      err
    )
  }
}