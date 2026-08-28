"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadPersistedState = exports.persistLiveState = exports.addToChampionshipRanking = exports.addToPhaseRanking = exports.resetPresentationFlow = exports.resetMatch = exports.resetAnswerState = exports.liveState = exports.generateModeratorCode = exports.generateJurorCode = exports.generateJoinCode = void 0;
const db_1 = require("../db");
const DEFAULT_QUESTION_TIME = 30;
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function generateJoinCode(length = 6) {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}
exports.generateJoinCode = generateJoinCode;
function generateJurorCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
}
exports.generateJurorCode = generateJurorCode;
function generateModeratorCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
}
exports.generateModeratorCode = generateModeratorCode;
function defaultPresentationFlow() {
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
    };
}
exports.liveState = {
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
    tiebreak: {
        active: false,
        pending: false,
        matchId: null,
        currentQuestionId: null,
        usedQuestionIds: []
    },
    podiumReveal: {
        stage: 'idle',
        countdownValue: 0,
        suspensePhrase: null,
        finalRankingVisible: false
    },
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
};
function resetAnswerState() {
    exports.liveState.teamAAnswer = null;
    exports.liveState.teamBAnswer = null;
    exports.liveState.teamACorrect = null;
    exports.liveState.teamBCorrect = null;
}
exports.resetAnswerState = resetAnswerState;
function resetMatch(questionTimeSeconds) {
    exports.liveState.teamA = null;
    exports.liveState.teamB = null;
    exports.liveState.teamAScore = 0;
    exports.liveState.teamBScore = 0;
    exports.liveState.currentQuestionId = null;
    exports.liveState.currentQuestionIndex = 0;
    exports.liveState.activeTeam = 'A';
    exports.liveState.teamAAnsweredCount = 0;
    exports.liveState.teamBAnsweredCount = 0;
    exports.liveState.timeLeft = questionTimeSeconds;
    exports.liveState.isRunning = false;
    exports.liveState.countdown = { active: false, value: 0 };
    exports.liveState.tiebreak = {
        active: false,
        pending: false,
        matchId: null,
        currentQuestionId: null,
        usedQuestionIds: []
    };
    exports.liveState.matchStartedAt = null;
    exports.liveState.matchCodes = {
        teamACode: null,
        teamBCode: null,
        teamAConnected: false,
        teamBConnected: false,
        teamAPlayerName: null,
        teamBPlayerName: null
    };
    exports.liveState.jurors = [];
    exports.liveState.jurorEntries = [];
    exports.liveState.jurorSubmittedItemIds = [];
    exports.liveState.initialScoreEntries = [];
    exports.liveState.initialScoresConfirmed = false;
    exports.liveState.currentItemSource = null;
    exports.liveState.currentAnalyticItemId = null;
    exports.liveState.usedAnalyticItemIds = [];
    exports.liveState.currentItemMode = null;
    exports.liveState.awaitingJuryEvaluation = false;
    exports.liveState.moderatorAdjusting = false;
    resetAnswerState();
}
exports.resetMatch = resetMatch;
function resetPresentationFlow() {
    exports.liveState.presentationFlow = defaultPresentationFlow();
}
exports.resetPresentationFlow = resetPresentationFlow;
function addToPhaseRanking(team, score) {
    if (!team)
        return;
    const existing = exports.liveState.phaseRankings.find((r) => r.teamId === team.id);
    if (existing) {
        existing.score += score;
    }
    else {
        exports.liveState.phaseRankings.push({
            teamId: team.id,
            name: team.name,
            institution: team.institution,
            score
        });
    }
}
exports.addToPhaseRanking = addToPhaseRanking;
function addToChampionshipRanking(team, score) {
    if (!team)
        return;
    const existing = exports.liveState.championshipRankings.find((r) => r.teamId === team.id);
    if (existing) {
        existing.score += score;
    }
    else {
        exports.liveState.championshipRankings.push({
            teamId: team.id,
            name: team.name,
            institution: team.institution,
            score
        });
    }
}
exports.addToChampionshipRanking = addToChampionshipRanking;
async function persistLiveState() {
    try {
        await db_1.prisma.liveSession.upsert({
            where: { id: 'singleton' },
            update: { data: JSON.stringify(exports.liveState) },
            create: { id: 'singleton', data: JSON.stringify(exports.liveState) }
        });
    }
    catch (error) {
        console.error('Falha ao gravar estado da partida', error);
    }
}
exports.persistLiveState = persistLiveState;
async function loadPersistedState() {
    try {
        const row = await db_1.prisma.liveSession.findUnique({ where: { id: 'singleton' } });
        if (row) {
            const parsed = JSON.parse(row.data);
            Object.assign(exports.liveState, parsed);
            exports.liveState.presentationFlow = {
                ...defaultPresentationFlow(),
                ...exports.liveState.presentationFlow,
                slides: Array.isArray(exports.liveState.presentationFlow?.slides)
                    ? exports.liveState.presentationFlow.slides
                    : []
            };
            if (!Array.isArray(exports.liveState.carriedPresentationScores)) {
                exports.liveState.carriedPresentationScores = [];
            }
            exports.liveState.publicVotingUrl = null;
            exports.liveState.publicVotingStatus = 'idle';
            exports.liveState.adminAccessedRemotely = false;
            console.log('Estado da partida recuperado do último encerramento.');
        }
    }
    catch (error) {
        console.error('Falha ao recuperar estado da partida (a começar do zero)', error);
    }
}
exports.loadPersistedState = loadPersistedState;
//# sourceMappingURL=liveState.js.map