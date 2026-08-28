export interface LiveTeam {
    id: string;
    name: string;
    institution: string;
    category: string;
    logoUrl?: string | null;
}
export interface PodiumEntry {
    id: string;
    name: string;
    institution: string;
    score: number;
}
export interface RankingEntry {
    teamId: string;
    name: string;
    institution: string;
    score: number;
}
export interface MatchCodes {
    teamACode: string | null;
    teamBCode: string | null;
    teamAConnected: boolean;
    teamBConnected: boolean;
    teamAPlayerName: string | null;
    teamBPlayerName: string | null;
}
export interface TiebreakState {
    active: boolean;
    pending: boolean;
    matchId: string | null;
    currentQuestionId: string | null;
    usedQuestionIds: string[];
}
export interface PodiumRevealState {
    stage: 'idle' | 'suspense' | 'countdown' | 'revealed';
    countdownValue: number;
    suspensePhrase: string | null;
    finalRankingVisible: boolean;
}
export interface RepescagemRevealState {
    stage: 'idle' | 'suspense' | 'countdown' | 'voting' | 'results';
    countdownValue: number;
    configId: string | null;
    repescadaNames: string[];
}
export interface PhaseTransitionState {
    stage: 'idle' | 'carousel' | 'webtec';
}
export interface PhaseFlowState {
    stage: 'idle' | 'repescagem' | 'ranking' | 'partnersPending' | 'partners' | 'webtec' | 'organizer' | 'suspense' | 'quizIntro';
    suspensePhrase: string | null;
}
export interface ChampionRevealState {
    active: boolean;
    teamName: string | null;
    logoUrl: string | null;
}
export interface JurorInfo {
    id: string;
    name: string;
}
export interface JurorScoreEntry {
    jurorId: string;
    itemId: string;
    scoreA: number;
    scoreB: number;
}
export interface InitialScoreEntry {
    jurorId: string;
    scoreA: number;
    scoreB: number;
}
export interface PresentationCriteriaScoreEntry {
    jurorId: string;
    criteriaId: string;
    score: number;
}
export interface PresentationSlideInfo {
    order: number;
    imageUrl: string;
}
export interface PresentationFlowState {
    stage: 'idle' | 'countdown' | 'presenting' | 'concluded';
    duplaId: string | null;
    teamId: string | null;
    teamName: string | null;
    theme: string | null;
    timeLeft: number;
    presentedTeamIds: string[];
    criteriaScores: PresentationCriteriaScoreEntry[];
    jurorsSubmitted: string[];
    allJurorsSubmitted: boolean;
    presentationMode: 'standard' | 'document';
    slides: PresentationSlideInfo[];
    currentPage: number;
}
export interface ModeratorInfo {
    id: string;
    name: string;
    role: 'principal' | 'secundario';
}
export interface CarriedPresentationEntry {
    teamId: string;
    name: string;
    institution: string;
    score: number;
    presentationWeight: number;
    quizWeight: number;
}
export type PublicVotingStatus = 'idle' | 'starting' | 'online' | 'failed';
export interface LiveState {
    championship: string | null;
    editionName: string | null;
    teamA: LiveTeam | null;
    teamB: LiveTeam | null;
    teamAScore: number;
    teamBScore: number;
    phase: number;
    currentQuestionId: string | null;
    currentQuestionIndex: number;
    activeTeam: 'A' | 'B';
    usedQuestionIds: string[];
    teamAAnsweredCount: number;
    teamBAnsweredCount: number;
    timeLeft: number;
    isRunning: boolean;
    matchCodes: MatchCodes;
    matchStartedAt: number | null;
    phaseRankings: RankingEntry[];
    championshipRankings: RankingEntry[];
    championshipStartedAt: number | null;
    eliminatedTeamIds: string[];
    phaseRankingReveal: {
        visible: boolean;
    };
    teamAAnswer: string | null;
    teamBAnswer: string | null;
    teamACorrect: boolean | null;
    teamBCorrect: boolean | null;
    countdown: {
        active: boolean;
        value: number;
    };
    tiebreak: TiebreakState;
    podiumReveal: PodiumRevealState;
    repescagemReveal: RepescagemRevealState;
    phaseTransition: PhaseTransitionState;
    phaseFlow: PhaseFlowState;
    championReveal: ChampionRevealState;
    bracketVisible: boolean;
    jurors: JurorInfo[];
    expectedJurorCount: number;
    jurorEntries: JurorScoreEntry[];
    jurorSubmittedItemIds: string[];
    initialScoreEntries: InitialScoreEntry[];
    initialScoresConfirmed: boolean;
    presentationFlow: PresentationFlowState;
    presentationPhaseScores: RankingEntry[];
    presentationRoundReady: boolean;
    carriedPresentationScores: CarriedPresentationEntry[];
    publicVotingUrl: string | null;
    publicVotingStatus: PublicVotingStatus;
    adminAccessedRemotely: boolean;
    currentItemSource: 'question' | 'analytic' | null;
    currentAnalyticItemId: string | null;
    usedAnalyticItemIds: string[];
    currentItemMode: 'multipla_escolha' | 'aberta' | null;
    awaitingJuryEvaluation: boolean;
    moderatorAdjusting: boolean;
    activeModerators: ModeratorInfo[];
    podium: {
        active: boolean;
        phaseNumber: number;
        phaseLabel: string;
        isGrandFinal: boolean;
        entries: PodiumEntry[];
    };
}
export declare function generateJoinCode(length?: number): string;
export declare function generateJurorCode(): string;
export declare function generateModeratorCode(): string;
export declare const liveState: LiveState;
export declare function resetAnswerState(): void;
export declare function resetMatch(questionTimeSeconds: number): void;
export declare function resetPresentationFlow(): void;
export declare function addToPhaseRanking(team: LiveTeam | null, score: number): void;
export declare function addToChampionshipRanking(team: LiveTeam | null, score: number): void;
export declare function persistLiveState(): Promise<void>;
export declare function loadPersistedState(): Promise<void>;
//# sourceMappingURL=liveState.d.ts.map
