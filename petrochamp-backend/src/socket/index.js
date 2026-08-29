"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSocketHandlers = void 0;
const crypto_1 = require("crypto");
const db_1 = require("../db");
const repescagem_1 = require("../routes/repescagem");
const bracketLive_1 = require("../routes/bracketLive");
const liveState_1 = require("./liveState");
let timerHandle = null;
let countdownHandle = null;
let partnersTimerHandle = null;
let moderatorSocketId = null;
let moderatorRegisteredEver = false;
const RESTRICTED_TO_PRINCIPAL = new Set([
    'moderator:selectChampionship',
    'moderator:finalizeChampionship',
    'moderator:openRepescagemVoting',
    'moderator:showPodium',
    'moderator:hidePodium',
    'moderator:startFinalPodiumSequence'
]);
const RESTRICTED_TO_AREA = {
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
};
function hasRegisteredModerators() {
    return liveState_1.liveState.activeModerators.length > 0 || moderatorRegisteredEver;
}
async function getQuestionTimeSeconds() {
    const row = await db_1.prisma.setting.findUnique({ where: { key: 'questionTimeSeconds' } });
    return row ? Number(row.value) : 30;
}
async function getMaxJurors() {
    const row = await db_1.prisma.setting.findUnique({ where: { key: 'maxJurors' } });
    return row ? Number(row.value) : 5;
}
async function getPartnersDurationSeconds() {
    const row = await db_1.prisma.setting.findUnique({ where: { key: 'partnersDurationSeconds' } });
    return row ? Number(row.value) : 20;
}
async function getCurrentPhaseConfig() {
    return db_1.prisma.phase.findFirst({
        where: { order: liveState_1.liveState.phase, championship: liveState_1.liveState.championship ?? undefined }
    });
}
async function getTotalPhases() {
    const count = await db_1.prisma.phase.count({
        where: { championship: liveState_1.liveState.championship ?? undefined }
    });
    return count > 0 ? count : 1;
}
function labelToIndex(label) {
    if (!label)
        return -1;
    return ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].indexOf(label);
}
function parseCorrectIndexes(raw) {
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(Number) : [];
    }
    catch {
        return [];
    }
}
async function isRoundComplete(championship, round) {
    const pending = await db_1.prisma.bracketMatch.count({
        where: { championship, round, winnerId: null, teamAId: { not: null }, teamBId: { not: null } }
    });
    return pending === 0;
}
async function getPresentationTeamIds(phaseId) {
    const duplas = await db_1.prisma.presentationDupla.findMany({ where: { phaseId } });
    const ids = new Set();
    for (const d of duplas) {
        ids.add(d.teamAId);
        if (d.teamBId)
            ids.add(d.teamBId);
    }
    return Array.from(ids);
}
async function getExpectedJurorCount(phaseId) {
    const authCount = await db_1.prisma.phaseJurorAuthorization.count({ where: { phaseId } });
    if (authCount > 0)
        return authCount;
    return db_1.prisma.juror.count();
}
async function refreshExpectedJurorCount() {
    const phaseConfig = await getCurrentPhaseConfig();
    liveState_1.liveState.expectedJurorCount = phaseConfig ? await getExpectedJurorCount(phaseConfig.id) : 0;
}
async function startPostRoundSequence() {
    if (!liveState_1.liveState.championship)
        return;
    const totalPhases = await getTotalPhases();
    const isLastPhase = liveState_1.liveState.phase >= totalPhases;
    const pendingRepescagem = await db_1.prisma.repescagemConfig.findFirst({
        where: { championship: liveState_1.liveState.championship, phase: liveState_1.liveState.phase, started: false }
    });
    liveState_1.liveState.phaseFlow = {
        stage: pendingRepescagem ? 'repescagem' : isLastPhase ? 'partnersPending' : 'ranking',
        suspensePhrase: null
    };
    liveState_1.liveState.bracketVisible = false;
}
function applyPresentationWeighting(phaseConfig) {
    const presentationWeight = phaseConfig.presentationWeight ?? 50;
    const quizWeight = phaseConfig.quizWeight ?? 50;
    const totalWeight = presentationWeight + quizWeight || 1;
    for (const presEntry of liveState_1.liveState.presentationPhaseScores) {
        const phaseEntry = liveState_1.liveState.phaseRankings.find((r) => r.teamId === presEntry.teamId);
        const champEntry = liveState_1.liveState.championshipRankings.find((r) => r.teamId === presEntry.teamId);
        const quizScore = phaseEntry?.score ?? 0;
        const weighted = (quizScore * quizWeight + presEntry.score * presentationWeight) / totalWeight;
        const delta = weighted - quizScore;
        if (phaseEntry)
            phaseEntry.score += delta;
        if (champEntry)
            champEntry.score += delta;
    }
}
async function buildPool() {
    const [questions, analyticItems, defaultTime] = await Promise.all([
        db_1.prisma.question.findMany({
            where: { phase: liveState_1.liveState.phase, championship: liveState_1.liveState.championship ?? undefined }
        }),
        // CORRIGIDO - faltava filtrar type: 'analitica'. Sem isto, itens do
        // tipo 'apresentacao' (usados só no fluxo de avaliação de
        // apresentações, sem ligação nenhuma ao sorteio de perguntas do
        // quiz) entravam também neste pool e podiam ser sorteados como se
        // fossem uma pergunta analítica normal - explicando o texto errado
        // ("outra pergunta") a aparecer na Projeção/Moderador quando calhava
        // um item analítico.
        db_1.prisma.evaluationItem.findMany({
            where: {
                phase: liveState_1.liveState.phase,
                championship: liveState_1.liveState.championship ?? undefined,
                type: 'analitica'
            }
        }),
        getQuestionTimeSeconds()
    ]);
    const pool = questions
        .filter((q) => !liveState_1.liveState.usedQuestionIds.includes(q.id))
        .map((q) => ({ source: 'question', id: q.id, timeSeconds: defaultTime, scope: 'single' }));
    for (const item of analyticItems) {
        if (liveState_1.liveState.usedAnalyticItemIds.includes(item.id))
            continue;
        pool.push({
            source: 'analytic',
            id: item.id,
            timeSeconds: item.timeSeconds ?? defaultTime,
            scope: item.scope === 'all' ? 'all' : 'single',
            mode: item.mode === 'multipla_escolha' ? 'multipla_escolha' : 'aberta'
        });
    }
    return pool;
}
async function drawNextItem(team) {
    const phaseConfig = await getCurrentPhaseConfig();
    const avoidRepeat = phaseConfig?.avoidRepeatQuestions ?? true;
    let pool = await buildPool();
    if (avoidRepeat && pool.length === 0) {
        liveState_1.liveState.usedQuestionIds = [];
        liveState_1.liveState.usedAnalyticItemIds = [];
        pool = await buildPool();
    }
    else if (!avoidRepeat) {
        const [questions, analyticItems, defaultTime] = await Promise.all([
            db_1.prisma.question.findMany({
                where: { phase: liveState_1.liveState.phase, championship: liveState_1.liveState.championship ?? undefined }
            }),
            // CORRIGIDO - mesmo filtro em falta que em buildPool() acima,
            // aplicado aqui também (este bloco monta o pool "sem evitar
            // repetição" de forma independente, por isso precisa da mesma
            // correção em separado).
            db_1.prisma.evaluationItem.findMany({
                where: {
                    phase: liveState_1.liveState.phase,
                    championship: liveState_1.liveState.championship ?? undefined,
                    type: 'analitica'
                }
            }),
            getQuestionTimeSeconds()
        ]);
        pool = [
            ...questions.map((q) => ({
                source: 'question',
                id: q.id,
                timeSeconds: defaultTime,
                scope: 'single'
            })),
            ...analyticItems.map((it) => ({
                source: 'analytic',
                id: it.id,
                timeSeconds: it.timeSeconds ?? defaultTime,
                scope: (it.scope === 'all' ? 'all' : 'single'),
                mode: (it.mode === 'multipla_escolha' ? 'multipla_escolha' : 'aberta')
            }))
        ];
    }
    if (pool.length === 0) {
        liveState_1.liveState.currentQuestionId = null;
        liveState_1.liveState.currentItemSource = null;
        liveState_1.liveState.currentAnalyticItemId = null;
        liveState_1.liveState.currentItemMode = null;
        return;
    }
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    liveState_1.liveState.currentQuestionIndex += 1;
    liveState_1.liveState.isRunning = false;
    liveState_1.liveState.awaitingJuryEvaluation = false;
    (0, liveState_1.resetAnswerState)();
    if (chosen.source === 'question') {
        liveState_1.liveState.currentItemSource = 'question';
        liveState_1.liveState.currentItemMode = null;
        liveState_1.liveState.currentQuestionId = chosen.id;
        liveState_1.liveState.currentAnalyticItemId = null;
        liveState_1.liveState.usedQuestionIds.push(chosen.id);
        liveState_1.liveState.activeTeam = team;
    }
    else {
        liveState_1.liveState.currentItemSource = 'analytic';
        liveState_1.liveState.currentItemMode = chosen.mode;
        liveState_1.liveState.currentAnalyticItemId = chosen.id;
        liveState_1.liveState.currentQuestionId = null;
        liveState_1.liveState.usedAnalyticItemIds.push(chosen.id);
        liveState_1.liveState.activeTeam = team;
    }
    liveState_1.liveState.timeLeft = chosen.timeSeconds;
}
async function roundQuestionsComplete() {
    const phaseConfig = await getCurrentPhaseConfig();
    if (!phaseConfig?.questionsPerTeam)
        return false;
    return (liveState_1.liveState.teamAAnsweredCount >= phaseConfig.questionsPerTeam &&
        liveState_1.liveState.teamBAnsweredCount >= phaseConfig.questionsPerTeam);
}
async function recordBracketResult(championship, teamAId, teamBId, winnerId) {
    const match = await db_1.prisma.bracketMatch.findFirst({
        where: {
            championship,
            winnerId: null,
            OR: teamAId === teamBId
                ? [
                    { teamAId, teamBId: null },
                    { teamAId: null, teamBId: teamAId }
                ]
                : [
                    { teamAId, teamBId },
                    { teamAId: teamBId, teamBId: teamAId }
                ]
        }
    });
    if (!match)
        return;
    await db_1.prisma.bracketMatch.update({ where: { id: match.id }, data: { winnerId } });
    const nextSlot = Math.floor(match.slot / 2);
    const nextMatch = await db_1.prisma.bracketMatch.findFirst({
        where: { championship, round: match.round + 1, slot: nextSlot }
    });
    if (nextMatch) {
        const isFirstChild = match.slot % 2 === 0;
        await db_1.prisma.bracketMatch.update({
            where: { id: nextMatch.id },
            data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
        });
        await (0, bracketLive_1.syncPresentationDuplasForRound)(championship, nextMatch.round);
    }
}
async function recordRepescagemResult(teamAId, teamBId, winnerId) {
    const match = await db_1.prisma.bracketMatch.findFirst({
        where: {
            championship: { contains: '__repescagem__' },
            winnerId: null,
            OR: [
                { teamAId, teamBId },
                { teamAId: teamBId, teamBId: teamAId }
            ]
        }
    });
    if (!match)
        return;
    await db_1.prisma.bracketMatch.update({ where: { id: match.id }, data: { winnerId } });
    const nextSlot = Math.floor(match.slot / 2);
    const nextMatch = await db_1.prisma.bracketMatch.findFirst({
        where: { championship: match.championship, round: match.round + 1, slot: nextSlot }
    });
    if (nextMatch) {
        const isFirstChild = match.slot % 2 === 0;
        await db_1.prisma.bracketMatch.update({
            where: { id: nextMatch.id },
            data: isFirstChild ? { teamAId: winnerId } : { teamBId: winnerId }
        });
    }
}
async function drawTiebreakQuestion() {
    const pool = await db_1.prisma.tiebreakQuestion.findMany({
        where: { phase: liveState_1.liveState.phase, championship: liveState_1.liveState.championship ?? undefined }
    });
    const available = pool.filter((q) => !liveState_1.liveState.tiebreak.usedQuestionIds.includes(q.id));
    const finalPool = available.length > 0 ? available : pool;
    if (finalPool.length === 0) {
        liveState_1.liveState.tiebreak.currentQuestionId = null;
        return;
    }
    const chosen = finalPool[Math.floor(Math.random() * finalPool.length)];
    liveState_1.liveState.tiebreak.currentQuestionId = chosen.id;
    liveState_1.liveState.tiebreak.usedQuestionIds.push(chosen.id);
}
async function pickSuspensePhrase() {
    const phrases = await db_1.prisma.suspensePhrase.findMany();
    return phrases.length
        ? phrases[Math.floor(Math.random() * phrases.length)].text
        : 'Preparem-se - a próxima fase está prestes a começar...';
}
async function checkAllJurorsSubmitted(broadcast) {
    const flow = liveState_1.liveState.presentationFlow;
    if (flow.stage !== 'concluded' || !flow.teamId)
        return;
    if (flow.allJurorsSubmitted)
        return;
    const connectedCount = liveState_1.liveState.jurors.length;
    const target = connectedCount > 0
        ? Math.min(liveState_1.liveState.expectedJurorCount || connectedCount, connectedCount)
        : liveState_1.liveState.expectedJurorCount;
    if (target <= 0)
        return;
    if (flow.jurorsSubmitted.length < target)
        return;
    flow.allJurorsSubmitted = true;
    broadcast();
    const validCriteriaScores = flow.criteriaScores.filter((e) => !!e.criteriaId);
    const totalsByJuror = new Map();
    for (const entry of validCriteriaScores) {
        totalsByJuror.set(entry.jurorId, (totalsByJuror.get(entry.jurorId) ?? 0) + entry.score);
    }
    const totals = Array.from(totalsByJuror.values());
    const average = totals.length ? totals.reduce((a, b) => a + b, 0) / totals.length : 0;
    await Promise.all(validCriteriaScores.map((entry) => db_1.prisma.presentationScore
        .upsert({
        where: {
            criteriaId_jurorId_teamId: {
                criteriaId: entry.criteriaId,
                jurorId: entry.jurorId,
                teamId: flow.teamId
            }
        },
        update: { score: entry.score },
        create: {
            criteriaId: entry.criteriaId,
            jurorId: entry.jurorId,
            teamId: flow.teamId,
            score: entry.score
        }
    })
        .catch((err) => console.error('[checkAllJurorsSubmitted] Falha ao gravar nota (ignorada, a continuar):', err))));
    const team = await db_1.prisma.team.findUnique({ where: { id: flow.teamId } });
    const phaseConfig = await getCurrentPhaseConfig();
    if (phaseConfig?.type === 'apresentacao_quiz') {
        const existingPresScore = liveState_1.liveState.presentationPhaseScores.find((r) => r.teamId === flow.teamId);
        if (existingPresScore) {
            existingPresScore.score = average;
        }
        else if (team) {
            liveState_1.liveState.presentationPhaseScores.push({
                teamId: team.id,
                name: team.name,
                institution: team.institution,
                score: average
            });
        }
    }
    else if (phaseConfig?.type === 'apresentacao' && phaseConfig.noElimination) {
        (0, liveState_1.addToPhaseRanking)(team, average);
        if (team) {
            const existingCarried = liveState_1.liveState.carriedPresentationScores.find((r) => r.teamId === team.id);
            const presentationWeight = phaseConfig.presentationWeight ?? 50;
            const quizWeight = phaseConfig.quizWeight ?? 50;
            if (existingCarried) {
                existingCarried.score = average;
                existingCarried.presentationWeight = presentationWeight;
                existingCarried.quizWeight = quizWeight;
            }
            else {
                liveState_1.liveState.carriedPresentationScores.push({
                    teamId: team.id,
                    name: team.name,
                    institution: team.institution,
                    score: average,
                    presentationWeight,
                    quizWeight
                });
            }
        }
    }
    else {
        (0, liveState_1.addToPhaseRanking)(team, average);
        (0, liveState_1.addToChampionshipRanking)(team, average);
        const dupla = await db_1.prisma.presentationDupla.findFirst({
            where: {
                phaseId: phaseConfig?.id,
                OR: [{ teamAId: flow.teamId }, { teamBId: flow.teamId }]
            }
        });
        if (liveState_1.liveState.championship && phaseConfig && dupla?.teamAId) {
            if (!dupla.teamBId) {
                await recordBracketResult(liveState_1.liveState.championship, dupla.teamAId, dupla.teamAId, dupla.teamAId);
            }
            else {
                const rankA = liveState_1.liveState.phaseRankings.find((r) => r.teamId === dupla.teamAId);
                const rankB = liveState_1.liveState.phaseRankings.find((r) => r.teamId === dupla.teamBId);
                if (rankA && rankB) {
                    const dWinnerId = rankA.score >= rankB.score ? dupla.teamAId : dupla.teamBId;
                    const dLoserId = dWinnerId === dupla.teamAId ? dupla.teamBId : dupla.teamAId;
                    await recordBracketResult(liveState_1.liveState.championship, dupla.teamAId, dupla.teamBId, dWinnerId);
                    if (!liveState_1.liveState.eliminatedTeamIds.includes(dLoserId)) {
                        liveState_1.liveState.eliminatedTeamIds.push(dLoserId);
                    }
                }
            }
        }
    }
    if (phaseConfig) {
        const allTeamIds = await getPresentationTeamIds(phaseConfig.id);
        const recordedTeamIds = phaseConfig.type === 'apresentacao_quiz'
            ? liveState_1.liveState.presentationPhaseScores.map((r) => r.teamId)
            : liveState_1.liveState.phaseRankings.map((r) => r.teamId);
        const allPresentedAndEvaluated = allTeamIds.length > 0 && allTeamIds.every((id) => recordedTeamIds.includes(id));
        if (allPresentedAndEvaluated) {
            if (phaseConfig.type === 'apresentacao') {
                liveState_1.liveState.presentationRoundReady = true;
            }
            else if (phaseConfig.type === 'apresentacao_quiz') {
                liveState_1.liveState.phaseFlow = { stage: 'quizIntro', suspensePhrase: null };
            }
        }
    }
}
function registerSocketHandlers(io) {
    function broadcast() {
        io.emit('state:sync', liveState_1.liveState);
        (0, liveState_1.persistLiveState)();
    }
    if (!timerHandle) {
        timerHandle = setInterval(() => {
            let changed = false;
            if (liveState_1.liveState.isRunning) {
                if (liveState_1.liveState.timeLeft > 0) {
                    liveState_1.liveState.timeLeft -= 1;
                }
                else {
                    liveState_1.liveState.isRunning = false;
                    if (liveState_1.liveState.currentItemSource === 'analytic' &&
                        liveState_1.liveState.currentItemMode === 'aberta') {
                        liveState_1.liveState.awaitingJuryEvaluation = true;
                    }
                }
                changed = true;
            }
            if (liveState_1.liveState.presentationFlow.stage === 'presenting' &&
                liveState_1.liveState.presentationFlow.timeLeft > 0) {
                liveState_1.liveState.presentationFlow.timeLeft -= 1;
                changed = true;
            }
            if (changed)
                broadcast();
        }, 1000);
    }
    function startCountdown(seconds, onComplete) {
        if (countdownHandle)
            clearInterval(countdownHandle);
        liveState_1.liveState.countdown = { active: true, value: seconds };
        broadcast();
        countdownHandle = setInterval(() => {
            liveState_1.liveState.countdown.value -= 1;
            if (liveState_1.liveState.countdown.value <= 0) {
                if (countdownHandle)
                    clearInterval(countdownHandle);
                countdownHandle = null;
                liveState_1.liveState.countdown.active = false;
                onComplete().then(broadcast);
            }
            else {
                broadcast();
            }
        }, 1000);
    }
    io.on('connection', (socket) => {
        console.log('Cliente ligado:', socket.id);
        socket.emit('state:sync', liveState_1.liveState);
        socket.on('moderator:register', async (payload, callback) => {
            const code = (payload.code || '').trim();
            const moderator = await db_1.prisma.moderator.findUnique({
                where: { code },
                include: { areas: true }
            });
            if (!moderator) {
                callback?.({ success: false, error: 'Código de moderador inválido.' });
                return;
            }
            socket.data.moderatorId = moderator.id;
            socket.data.moderatorRole = moderator.role;
            socket.data.moderatorAreas = moderator.areas.map((a) => a.area);
            moderatorRegisteredEver = true;
            if (!liveState_1.liveState.activeModerators.some((m) => m.id === moderator.id)) {
                liveState_1.liveState.activeModerators.push({
                    id: moderator.id,
                    name: moderator.name,
                    role: moderator.role === 'principal' ? 'principal' : 'secundario'
                });
            }
            broadcast();
            callback?.({
                success: true,
                moderatorId: moderator.id,
                role: moderator.role,
                name: moderator.name,
                areas: moderator.areas.map((a) => a.area)
            });
        });
        socket.use(([eventName, ...args], next) => {
            const maybeCallback = args[args.length - 1];
            const respondBlocked = (message) => {
                if (typeof maybeCallback === 'function') {
                    maybeCallback({ success: false, error: message });
                }
            };
            if (RESTRICTED_TO_PRINCIPAL.has(eventName)) {
                if (!hasRegisteredModerators()) {
                    next();
                    return;
                }
                if (socket.data.moderatorRole === 'principal') {
                    next();
                    return;
                }
                console.log(`Ação restrita a Principal bloqueada: ${eventName} (socket ${socket.id} não é Principal)`);
                respondBlocked('Esta ação só pode ser feita pelo Moderador Principal.');
                return;
            }
            const requiredArea = RESTRICTED_TO_AREA[eventName];
            if (requiredArea) {
                if (!hasRegisteredModerators()) {
                    next();
                    return;
                }
                if (socket.data.moderatorRole === 'principal') {
                    next();
                    return;
                }
                const areas = socket.data.moderatorAreas || [];
                if (areas.includes(requiredArea)) {
                    next();
                    return;
                }
                console.log(`Ação sem área "${requiredArea}" bloqueada: ${eventName} (socket ${socket.id})`);
                respondBlocked(`Este moderador não tem a área "${requiredArea}" atribuída. Vai a Admin → Moderadores para autorizar.`);
                return;
            }
            next();
        });
        socket.on('moderator:enterAdmin', () => {
            moderatorSocketId = socket.id;
            const hasActivity = (!!liveState_1.liveState.teamA && !!liveState_1.liveState.teamB) || liveState_1.liveState.presentationFlow.stage !== 'idle';
            if (hasActivity && !liveState_1.liveState.moderatorAdjusting) {
                liveState_1.liveState.moderatorAdjusting = true;
                broadcast();
            }
        });
        socket.on('moderator:exitAdmin', () => {
            if (liveState_1.liveState.moderatorAdjusting) {
                liveState_1.liveState.moderatorAdjusting = false;
                broadcast();
            }
        });
        socket.on('moderator:selectChampionship', async (payload, callback) => {
            liveState_1.liveState.championship = payload.championship;
            liveState_1.liveState.editionName = payload.editionName || null;
            liveState_1.liveState.phase = 1;
            liveState_1.liveState.teamA = null;
            liveState_1.liveState.teamB = null;
            liveState_1.liveState.teamAScore = 0;
            liveState_1.liveState.teamBScore = 0;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.championshipRankings = [];
            liveState_1.liveState.championshipStartedAt = Date.now();
            liveState_1.liveState.usedQuestionIds = [];
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.championReveal = { active: false, teamName: null, logoUrl: null };
            liveState_1.liveState.presentationPhaseScores = [];
            liveState_1.liveState.carriedPresentationScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = true;
            await refreshExpectedJurorCount();
            broadcast();
            callback?.(true);
        });
        socket.on('moderator:selectTeams', async (payload, callback) => {
            const [teamA, teamB] = await Promise.all([
                db_1.prisma.team.findUnique({ where: { id: payload.teamAId } }),
                db_1.prisma.team.findUnique({ where: { id: payload.teamBId } })
            ]);
            if (!teamA || !teamB) {
                callback?.(false);
                return;
            }
            liveState_1.liveState.teamA = teamA;
            liveState_1.liveState.teamB = teamB;
            liveState_1.liveState.teamAScore = 0;
            liveState_1.liveState.teamBScore = 0;
            liveState_1.liveState.teamAAnsweredCount = 0;
            liveState_1.liveState.teamBAnsweredCount = 0;
            liveState_1.liveState.currentQuestionIndex = 0;
            liveState_1.liveState.matchStartedAt = Date.now();
            liveState_1.liveState.bracketVisible = false;
            liveState_1.liveState.matchCodes = {
                teamACode: (0, liveState_1.generateJoinCode)(),
                teamBCode: (0, liveState_1.generateJoinCode)(),
                teamAConnected: false,
                teamBConnected: false,
                teamAPlayerName: null,
                teamBPlayerName: null
            };
            broadcast();
            callback?.(true);
            startCountdown(10, async () => {
                await drawNextItem('A');
            });
        });
        socket.on('moderator:startTimer', () => {
            liveState_1.liveState.isRunning = true;
            broadcast();
        });
        socket.on('moderator:pauseTimer', () => {
            liveState_1.liveState.isRunning = false;
            broadcast();
        });
        socket.on('moderator:nextQuestion', async () => {
            const otherTeam = liveState_1.liveState.activeTeam === 'A' ? 'B' : 'A';
            await drawNextItem(otherTeam);
            broadcast();
        });
        socket.on('moderator:forceQuestion', async (payload) => {
            const question = await db_1.prisma.question.findUnique({ where: { id: payload.questionId } });
            if (!question || question.phase !== liveState_1.liveState.phase)
                return;
            liveState_1.liveState.currentItemSource = 'question';
            liveState_1.liveState.currentAnalyticItemId = null;
            liveState_1.liveState.currentQuestionId = payload.questionId;
            if (!liveState_1.liveState.usedQuestionIds.includes(payload.questionId)) {
                liveState_1.liveState.usedQuestionIds.push(payload.questionId);
            }
            liveState_1.liveState.timeLeft = await getQuestionTimeSeconds();
            liveState_1.liveState.isRunning = false;
            (0, liveState_1.resetAnswerState)();
            broadcast();
        });
        socket.on('moderator:addScore', (payload) => {
            if (payload.team === 'A') {
                liveState_1.liveState.teamAScore = Math.max(0, liveState_1.liveState.teamAScore + payload.amount);
            }
            else {
                liveState_1.liveState.teamBScore = Math.max(0, liveState_1.liveState.teamBScore + payload.amount);
            }
            broadcast();
        });
        socket.on('player:submitAnswer', async (payload) => {
            if (liveState_1.liveState.tiebreak.active)
                return;
            if (liveState_1.liveState.currentItemSource === 'analytic') {
                if (liveState_1.liveState.currentItemMode === 'aberta')
                    return;
                if (!liveState_1.liveState.currentAnalyticItemId)
                    return;
                if (payload.team === 'A' && liveState_1.liveState.teamAAnswer)
                    return;
                if (payload.team === 'B' && liveState_1.liveState.teamBAnswer)
                    return;
                const item = await db_1.prisma.evaluationItem.findUnique({
                    where: { id: liveState_1.liveState.currentAnalyticItemId }
                });
                if (!item)
                    return;
                if (item.scope !== 'all' && payload.team !== liveState_1.liveState.activeTeam)
                    return;
                if (payload.team === 'A')
                    liveState_1.liveState.teamAAnswer = payload.optionLabel;
                else
                    liveState_1.liveState.teamBAnswer = payload.optionLabel;
                const correctIdxs = parseCorrectIndexes(item.correctIndexes);
                const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel));
                if (payload.team === 'A') {
                    liveState_1.liveState.teamACorrect = isCorrect;
                    liveState_1.liveState.teamAAnsweredCount += 1;
                    if (isCorrect)
                        liveState_1.liveState.teamAScore += item.maxPoints;
                }
                else {
                    liveState_1.liveState.teamBCorrect = isCorrect;
                    liveState_1.liveState.teamBAnsweredCount += 1;
                    if (isCorrect)
                        liveState_1.liveState.teamBScore += item.maxPoints;
                }
                liveState_1.liveState.isRunning = false;
                broadcast();
                const readyToAdvance = item.scope === 'all' ? liveState_1.liveState.teamAAnswer && liveState_1.liveState.teamBAnswer : true;
                if (readyToAdvance) {
                    setTimeout(async () => {
                        if (await roundQuestionsComplete()) {
                            liveState_1.liveState.currentQuestionId = null;
                            liveState_1.liveState.currentItemSource = null;
                            liveState_1.liveState.currentAnalyticItemId = null;
                            broadcast();
                            return;
                        }
                        const nextTeam = liveState_1.liveState.activeTeam === 'A' ? 'B' : 'A';
                        await drawNextItem(nextTeam);
                        broadcast();
                    }, 2500);
                }
                return;
            }
            if (payload.team !== liveState_1.liveState.activeTeam)
                return;
            if (liveState_1.liveState.currentQuestionId === null)
                return;
            if (payload.team === 'A' && liveState_1.liveState.teamAAnswer)
                return;
            if (payload.team === 'B' && liveState_1.liveState.teamBAnswer)
                return;
            if (payload.team === 'A')
                liveState_1.liveState.teamAAnswer = payload.optionLabel;
            else
                liveState_1.liveState.teamBAnswer = payload.optionLabel;
            const question = await db_1.prisma.question.findUnique({
                where: { id: liveState_1.liveState.currentQuestionId }
            });
            if (!question) {
                if (payload.team === 'A')
                    liveState_1.liveState.teamAAnswer = null;
                else
                    liveState_1.liveState.teamBAnswer = null;
                return;
            }
            const correctIdxs = parseCorrectIndexes(question.correctIndexes);
            const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel));
            if (payload.team === 'A') {
                liveState_1.liveState.teamACorrect = isCorrect;
                liveState_1.liveState.teamAAnsweredCount += 1;
                if (isCorrect)
                    liveState_1.liveState.teamAScore += question.points;
            }
            else {
                liveState_1.liveState.teamBCorrect = isCorrect;
                liveState_1.liveState.teamBAnsweredCount += 1;
                if (isCorrect)
                    liveState_1.liveState.teamBScore += question.points;
            }
            liveState_1.liveState.isRunning = false;
            broadcast();
            setTimeout(async () => {
                if (await roundQuestionsComplete()) {
                    liveState_1.liveState.currentQuestionId = null;
                    broadcast();
                    return;
                }
                const nextTeam = liveState_1.liveState.activeTeam === 'A' ? 'B' : 'A';
                await drawNextItem(nextTeam);
                broadcast();
            }, 2500);
        });
        socket.on('moderator:endOpenQuestion', () => {
            if (liveState_1.liveState.currentItemSource !== 'analytic' || liveState_1.liveState.currentItemMode !== 'aberta')
                return;
            liveState_1.liveState.isRunning = false;
            liveState_1.liveState.awaitingJuryEvaluation = true;
            broadcast();
        });
        socket.on('moderator:startTiebreak', async () => {
            if (!liveState_1.liveState.teamA || !liveState_1.liveState.teamB || !liveState_1.liveState.championship)
                return;
            if (liveState_1.liveState.tiebreak.pending || liveState_1.liveState.tiebreak.active)
                return;
            liveState_1.liveState.tiebreak.pending = true;
            broadcast();
            startCountdown(5, async () => {
                if (!liveState_1.liveState.teamA || !liveState_1.liveState.teamB || !liveState_1.liveState.championship)
                    return;
                const match = await db_1.prisma.tiebreakMatch.create({
                    data: {
                        championship: liveState_1.liveState.championship,
                        phase: liveState_1.liveState.phase,
                        teamAId: liveState_1.liveState.teamA.id,
                        teamBId: liveState_1.liveState.teamB.id
                    }
                });
                liveState_1.liveState.tiebreak = {
                    active: true,
                    pending: false,
                    matchId: match.id,
                    currentQuestionId: null,
                    usedQuestionIds: []
                };
                await drawTiebreakQuestion();
                liveState_1.liveState.timeLeft = await getQuestionTimeSeconds();
                (0, liveState_1.resetAnswerState)();
            });
        });
        socket.on('tiebreak:submitAnswer', async (payload) => {
            if (!liveState_1.liveState.tiebreak.active || liveState_1.liveState.tiebreak.currentQuestionId === null)
                return;
            if (payload.team === 'A' && liveState_1.liveState.teamAAnswer)
                return;
            if (payload.team === 'B' && liveState_1.liveState.teamBAnswer)
                return;
            if (payload.team === 'A') {
                liveState_1.liveState.teamAAnswer = payload.optionLabel;
            }
            else {
                liveState_1.liveState.teamBAnswer = payload.optionLabel;
            }
            const question = await db_1.prisma.tiebreakQuestion.findUnique({
                where: { id: liveState_1.liveState.tiebreak.currentQuestionId }
            });
            if (!question) {
                if (payload.team === 'A')
                    liveState_1.liveState.teamAAnswer = null;
                else
                    liveState_1.liveState.teamBAnswer = null;
                return;
            }
            const correctIdxs = parseCorrectIndexes(question.correctIndexes);
            const isCorrect = correctIdxs.includes(labelToIndex(payload.optionLabel));
            if (payload.team === 'A') {
                liveState_1.liveState.teamACorrect = isCorrect;
            }
            else {
                liveState_1.liveState.teamBCorrect = isCorrect;
            }
            broadcast();
            if (liveState_1.liveState.teamAAnswer && liveState_1.liveState.teamBAnswer) {
                setTimeout(async () => {
                    const aCorrect = liveState_1.liveState.teamACorrect;
                    const bCorrect = liveState_1.liveState.teamBCorrect;
                    let winner = null;
                    if (aCorrect && !bCorrect)
                        winner = 'A';
                    else if (bCorrect && !aCorrect)
                        winner = 'B';
                    if (winner && liveState_1.liveState.tiebreak.matchId && liveState_1.liveState.teamA && liveState_1.liveState.teamB) {
                        const winnerId = winner === 'A' ? liveState_1.liveState.teamA.id : liveState_1.liveState.teamB.id;
                        await db_1.prisma.tiebreakMatch.update({
                            where: { id: liveState_1.liveState.tiebreak.matchId },
                            data: { winnerId, resolved: true }
                        });
                        liveState_1.liveState.tiebreak.active = false;
                        (0, liveState_1.resetAnswerState)();
                        broadcast();
                    }
                    else {
                        (0, liveState_1.resetAnswerState)();
                        await drawTiebreakQuestion();
                        broadcast();
                    }
                }, 2500);
            }
        });
        socket.on('moderator:finishMatch', async () => {
            const questionTime = await getQuestionTimeSeconds();
            let shouldStartSequence = false;
            if (liveState_1.liveState.teamA && liveState_1.liveState.teamB && liveState_1.liveState.championship) {
                const phaseConfig = await getCurrentPhaseConfig();
                let compareAScore = liveState_1.liveState.teamAScore;
                let compareBScore = liveState_1.liveState.teamBScore;
                if (phaseConfig?.type === 'apresentacao_quiz') {
                    const presA = liveState_1.liveState.presentationPhaseScores.find((p) => p.teamId === liveState_1.liveState.teamA.id)
                        ?.score ?? 0;
                    const presB = liveState_1.liveState.presentationPhaseScores.find((p) => p.teamId === liveState_1.liveState.teamB.id)
                        ?.score ?? 0;
                    const quizWeight = phaseConfig.quizWeight ?? 50;
                    const presWeight = phaseConfig.presentationWeight ?? 50;
                    const totalWeight = quizWeight + presWeight || 1;
                    compareAScore = (liveState_1.liveState.teamAScore * quizWeight + presA * presWeight) / totalWeight;
                    compareBScore = (liveState_1.liveState.teamBScore * quizWeight + presB * presWeight) / totalWeight;
                }
                else {
                    const carriedA = liveState_1.liveState.carriedPresentationScores.find((p) => p.teamId === liveState_1.liveState.teamA.id);
                    const carriedB = liveState_1.liveState.carriedPresentationScores.find((p) => p.teamId === liveState_1.liveState.teamB.id);
                    if (carriedA) {
                        const totalWeight = carriedA.presentationWeight + carriedA.quizWeight || 1;
                        compareAScore =
                            (liveState_1.liveState.teamAScore * carriedA.quizWeight +
                                carriedA.score * carriedA.presentationWeight) /
                                totalWeight;
                    }
                    if (carriedB) {
                        const totalWeight = carriedB.presentationWeight + carriedB.quizWeight || 1;
                        compareBScore =
                            (liveState_1.liveState.teamBScore * carriedB.quizWeight +
                                carriedB.score * carriedB.presentationWeight) /
                                totalWeight;
                    }
                }
                let winnerId;
                if (compareAScore === compareBScore) {
                    const resolvedTiebreak = liveState_1.liveState.tiebreak.matchId
                        ? await db_1.prisma.tiebreakMatch.findUnique({ where: { id: liveState_1.liveState.tiebreak.matchId } })
                        : null;
                    winnerId = resolvedTiebreak?.winnerId ?? undefined;
                }
                else {
                    winnerId = compareAScore > compareBScore ? liveState_1.liveState.teamA.id : liveState_1.liveState.teamB.id;
                }
                const winnerName = winnerId === liveState_1.liveState.teamA.id
                    ? liveState_1.liveState.teamA.name
                    : winnerId === liveState_1.liveState.teamB.id
                        ? liveState_1.liveState.teamB.name
                        : null;
                await db_1.prisma.matchHistory.create({
                    data: {
                        championship: liveState_1.liveState.championship,
                        editionName: liveState_1.liveState.editionName,
                        phase: liveState_1.liveState.phase,
                        phaseLabel: phaseConfig?.label ?? `Fase ${liveState_1.liveState.phase}`,
                        teamAId: liveState_1.liveState.teamA.id,
                        teamAName: liveState_1.liveState.teamA.name,
                        teamBId: liveState_1.liveState.teamB.id,
                        teamBName: liveState_1.liveState.teamB.name,
                        teamAScore: liveState_1.liveState.teamAScore,
                        teamBScore: liveState_1.liveState.teamBScore,
                        winnerId: winnerId ?? null,
                        winnerName,
                        wasTiebreak: !!liveState_1.liveState.tiebreak.matchId,
                        deviceMode: null,
                        startedAt: new Date(liveState_1.liveState.matchStartedAt ?? Date.now()),
                        endedAt: new Date(),
                        durationSeconds: liveState_1.liveState.matchStartedAt
                            ? Math.round((Date.now() - liveState_1.liveState.matchStartedAt) / 1000)
                            : 0
                    }
                });
                if (winnerId) {
                    await recordBracketResult(liveState_1.liveState.championship, liveState_1.liveState.teamA.id, liveState_1.liveState.teamB.id, winnerId);
                    await recordRepescagemResult(liveState_1.liveState.teamA.id, liveState_1.liveState.teamB.id, winnerId);
                    const loserId = winnerId === liveState_1.liveState.teamA.id ? liveState_1.liveState.teamB.id : liveState_1.liveState.teamA.id;
                    if (!liveState_1.liveState.eliminatedTeamIds.includes(loserId)) {
                        liveState_1.liveState.eliminatedTeamIds.push(loserId);
                    }
                    shouldStartSequence = await isRoundComplete(liveState_1.liveState.championship, liveState_1.liveState.phase);
                }
            }
            (0, liveState_1.addToPhaseRanking)(liveState_1.liveState.teamA, liveState_1.liveState.teamAScore);
            (0, liveState_1.addToPhaseRanking)(liveState_1.liveState.teamB, liveState_1.liveState.teamBScore);
            (0, liveState_1.addToChampionshipRanking)(liveState_1.liveState.teamA, liveState_1.liveState.teamAScore);
            (0, liveState_1.addToChampionshipRanking)(liveState_1.liveState.teamB, liveState_1.liveState.teamBScore);
            for (const team of [liveState_1.liveState.teamA, liveState_1.liveState.teamB]) {
                if (!team)
                    continue;
                const idx = liveState_1.liveState.carriedPresentationScores.findIndex((p) => p.teamId === team.id);
                if (idx === -1)
                    continue;
                const carried = liveState_1.liveState.carriedPresentationScores[idx];
                const rawScore = team.id === liveState_1.liveState.teamA?.id ? liveState_1.liveState.teamAScore : liveState_1.liveState.teamBScore;
                const totalWeight = carried.presentationWeight + carried.quizWeight || 1;
                const weighted = (rawScore * carried.quizWeight + carried.score * carried.presentationWeight) / totalWeight;
                const delta = weighted - rawScore;
                const phaseEntry = liveState_1.liveState.phaseRankings.find((r) => r.teamId === team.id);
                const champEntry = liveState_1.liveState.championshipRankings.find((r) => r.teamId === team.id);
                if (phaseEntry)
                    phaseEntry.score += delta;
                if (champEntry)
                    champEntry.score += delta;
                liveState_1.liveState.carriedPresentationScores.splice(idx, 1);
            }
            if (shouldStartSequence) {
                const phaseConfigForWeighting = await getCurrentPhaseConfig();
                if (phaseConfigForWeighting?.type === 'apresentacao_quiz') {
                    applyPresentationWeighting(phaseConfigForWeighting);
                }
            }
            (0, liveState_1.resetMatch)(questionTime);
            if (shouldStartSequence) {
                await startPostRoundSequence();
            }
            broadcast();
        });
        socket.on('moderator:continueAfterRepescagem', async () => {
            if (liveState_1.liveState.phaseFlow.stage !== 'repescagem')
                return;
            const totalPhases = await getTotalPhases();
            const isLastPhase = liveState_1.liveState.phase >= totalPhases;
            liveState_1.liveState.phaseFlow = {
                stage: isLastPhase ? 'partnersPending' : 'ranking',
                suspensePhrase: null
            };
            broadcast();
        });
        socket.on('moderator:openRepescagemVoting', async (payload) => {
            const config = await db_1.prisma.repescagemConfig.findUnique({ where: { id: payload.configId } });
            if (!config || config.started)
                return;
            await db_1.prisma.repescagemConfig.update({
                where: { id: config.id },
                data: { started: true, votingOpen: true, startedAt: new Date() }
            });
            liveState_1.liveState.repescagemReveal = {
                stage: 'suspense',
                countdownValue: 10,
                configId: config.id,
                repescadaNames: []
            };
            broadcast();
            setTimeout(() => {
                if (liveState_1.liveState.repescagemReveal.configId !== config.id)
                    return;
                liveState_1.liveState.repescagemReveal.stage = 'countdown';
                broadcast();
                const interval = setInterval(() => {
                    if (liveState_1.liveState.repescagemReveal.configId !== config.id) {
                        clearInterval(interval);
                        return;
                    }
                    liveState_1.liveState.repescagemReveal.countdownValue -= 1;
                    if (liveState_1.liveState.repescagemReveal.countdownValue <= 0) {
                        clearInterval(interval);
                        liveState_1.liveState.repescagemReveal.stage = 'voting';
                        broadcast();
                    }
                    else {
                        broadcast();
                    }
                }, 1000);
            }, 3000);
        });
        socket.on('moderator:closeRepescagemVoting', async (payload) => {
            const config = await db_1.prisma.repescagemConfig.findUnique({ where: { id: payload.configId } });
            if (!config || !config.votingOpen)
                return;
            await db_1.prisma.repescagemConfig.update({
                where: { id: config.id },
                data: { votingOpen: false, closedAt: new Date() }
            });
            const eligibleTeams = await (0, repescagem_1.getEligibleTeams)(config.championship, config.phase);
            const votes = await db_1.prisma.repescagemVote.findMany({ where: { configId: config.id } });
            const ranked = eligibleTeams
                .map((t) => ({ team: t, votes: votes.filter((v) => v.teamId === t.id).length }))
                .sort((a, b) => b.votes - a.votes);
            const repescadaNames = ranked.slice(0, config.maxRepescados).map((r) => r.team.name);
            liveState_1.liveState.repescagemReveal = {
                stage: 'results',
                countdownValue: 0,
                configId: config.id,
                repescadaNames
            };
            broadcast();
            setTimeout(() => {
                if (liveState_1.liveState.repescagemReveal.configId !== config.id)
                    return;
                liveState_1.liveState.repescagemReveal = {
                    stage: 'idle',
                    countdownValue: 0,
                    configId: null,
                    repescadaNames: []
                };
                broadcast();
            }, 8000);
        });
        socket.on('moderator:showPartners', async () => {
            if (liveState_1.liveState.phaseFlow.stage !== 'ranking' &&
                liveState_1.liveState.phaseFlow.stage !== 'partnersPending')
                return;
            const isLastPhase = liveState_1.liveState.phaseFlow.stage === 'partnersPending';
            const seconds = await getPartnersDurationSeconds();
            liveState_1.liveState.phaseFlow = { stage: 'partners', suspensePhrase: null };
            broadcast();
            if (partnersTimerHandle)
                clearTimeout(partnersTimerHandle);
            partnersTimerHandle = setTimeout(() => {
                if (liveState_1.liveState.phaseFlow.stage !== 'partners')
                    return;
                liveState_1.liveState.phaseFlow = { stage: 'webtec', suspensePhrase: null };
                broadcast();
                partnersTimerHandle = setTimeout(() => {
                    if (liveState_1.liveState.phaseFlow.stage !== 'webtec')
                        return;
                    liveState_1.liveState.phaseFlow = { stage: 'organizer', suspensePhrase: null };
                    broadcast();
                    if (isLastPhase)
                        return;
                    partnersTimerHandle = setTimeout(async () => {
                        if (liveState_1.liveState.phaseFlow.stage !== 'organizer')
                            return;
                        const phrase = await pickSuspensePhrase();
                        liveState_1.liveState.phaseFlow = { stage: 'suspense', suspensePhrase: phrase };
                        broadcast();
                    }, seconds * 1000);
                }, seconds * 1000);
            }, seconds * 1000);
        });
        socket.on('moderator:startNextPhase', async () => {
            if (liveState_1.liveState.phaseFlow.stage !== 'suspense')
                return;
            const questionTime = await getQuestionTimeSeconds();
            const totalPhases = await getTotalPhases();
            if (liveState_1.liveState.phase < totalPhases)
                liveState_1.liveState.phase += 1;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.usedQuestionIds = [];
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.presentationPhaseScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = true;
            (0, liveState_1.resetMatch)(questionTime);
            await refreshExpectedJurorCount();
            broadcast();
        });
        socket.on('moderator:confirmQuizIntro', async () => {
            if (liveState_1.liveState.phaseFlow.stage !== 'quizIntro')
                return;
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.bracketVisible = true;
            await refreshExpectedJurorCount();
            broadcast();
        });
        socket.on('moderator:confirmPresentationRanking', async () => {
            if (!liveState_1.liveState.presentationRoundReady)
                return;
            liveState_1.liveState.presentationRoundReady = false;
            await startPostRoundSequence();
            await refreshExpectedJurorCount();
            broadcast();
        });
        socket.on('moderator:advancePhase', async () => {
            const questionTime = await getQuestionTimeSeconds();
            const totalPhases = await getTotalPhases();
            if (liveState_1.liveState.phase < totalPhases)
                liveState_1.liveState.phase += 1;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.usedQuestionIds = [];
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.phaseTransition = { stage: 'idle' };
            liveState_1.liveState.presentationPhaseScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = true;
            (0, liveState_1.resetMatch)(questionTime);
            await refreshExpectedJurorCount();
            broadcast();
        });
        socket.on('moderator:resetChampionship', async () => {
            const questionTime = await getQuestionTimeSeconds();
            if (liveState_1.liveState.championship) {
                await db_1.prisma.bracketMatch.updateMany({
                    where: { championship: liveState_1.liveState.championship, round: { gt: 1 } },
                    data: { teamAId: null, teamBId: null, winnerId: null }
                });
                await db_1.prisma.bracketMatch.updateMany({
                    where: { championship: liveState_1.liveState.championship, round: 1 },
                    data: { winnerId: null }
                });
                const phases = await db_1.prisma.phase.findMany({
                    where: { championship: liveState_1.liveState.championship }
                });
                const phaseIds = phases.map((p) => p.id);
                if (phaseIds.length) {
                    const criteriaIds = (await db_1.prisma.presentationCriteria.findMany({
                        where: { phaseId: { in: phaseIds } },
                        select: { id: true }
                    })).map((c) => c.id);
                    if (criteriaIds.length) {
                        await db_1.prisma.presentationScore.deleteMany({
                            where: { criteriaId: { in: criteriaIds } }
                        });
                    }
                    await db_1.prisma.presentationDupla.deleteMany({ where: { phaseId: { in: phaseIds } } });
                }
                await (0, bracketLive_1.syncPresentationDuplasForRound)(liveState_1.liveState.championship, 1);
            }
            liveState_1.liveState.phase = 1;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.championshipRankings = [];
            liveState_1.liveState.championshipStartedAt = liveState_1.liveState.championship ? Date.now() : null;
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.championReveal = { active: false, teamName: null, logoUrl: null };
            liveState_1.liveState.presentationPhaseScores = [];
            liveState_1.liveState.carriedPresentationScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = !!liveState_1.liveState.championship;
            liveState_1.liveState.podium.active = false;
            liveState_1.liveState.podiumReveal = {
                stage: 'idle',
                countdownValue: 0,
                suspensePhrase: null,
                finalRankingVisible: false
            };
            liveState_1.liveState.phaseTransition = { stage: 'idle' };
            liveState_1.liveState.expectedJurorCount = 0;
            (0, liveState_1.resetMatch)(questionTime);
            await refreshExpectedJurorCount();
            broadcast();
        });
        socket.on('moderator:abandonChampionship', async () => {
            liveState_1.liveState.championship = null;
            liveState_1.liveState.editionName = null;
            liveState_1.liveState.phase = 1;
            liveState_1.liveState.teamA = null;
            liveState_1.liveState.teamB = null;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.championshipRankings = [];
            liveState_1.liveState.championshipStartedAt = null;
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.presentationPhaseScores = [];
            liveState_1.liveState.carriedPresentationScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = false;
            liveState_1.liveState.podium.active = false;
            liveState_1.liveState.podiumReveal = {
                stage: 'idle',
                countdownValue: 0,
                suspensePhrase: null,
                finalRankingVisible: false
            };
            liveState_1.liveState.phaseTransition = { stage: 'idle' };
            liveState_1.liveState.expectedJurorCount = 0;
            const questionTime = await getQuestionTimeSeconds();
            (0, liveState_1.resetMatch)(questionTime);
            broadcast();
        });
        socket.on('moderator:showPhaseRanking', () => {
            liveState_1.liveState.phaseRankingReveal.visible = true;
            broadcast();
        });
        socket.on('moderator:hidePhaseRanking', () => {
            liveState_1.liveState.phaseRankingReveal.visible = false;
            broadcast();
        });
        socket.on('moderator:showPodium', (payload) => {
            liveState_1.liveState.podium.active = true;
            liveState_1.liveState.podium.phaseNumber = payload.phaseNumber;
            liveState_1.liveState.podium.phaseLabel = payload.phaseLabel;
            liveState_1.liveState.podium.entries = payload.entries;
            liveState_1.liveState.podium.isGrandFinal = payload.isGrandFinal;
            broadcast();
        });
        socket.on('moderator:hidePodium', () => {
            liveState_1.liveState.podium.active = false;
            broadcast();
        });
        socket.on('moderator:startFinalPodiumSequence', async () => {
            const totalPhases = await getTotalPhases();
            if (liveState_1.liveState.phase !== totalPhases)
                return;
            const phrase = await pickSuspensePhrase();
            liveState_1.liveState.podiumReveal.stage = 'suspense';
            liveState_1.liveState.podiumReveal.suspensePhrase = phrase;
            liveState_1.liveState.podiumReveal.finalRankingVisible = false;
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            broadcast();
            setTimeout(() => {
                liveState_1.liveState.podiumReveal.stage = 'countdown';
                liveState_1.liveState.podiumReveal.countdownValue = 10;
                broadcast();
                const interval = setInterval(() => {
                    liveState_1.liveState.podiumReveal.countdownValue -= 1;
                    if (liveState_1.liveState.podiumReveal.countdownValue <= 0) {
                        clearInterval(interval);
                        const top3 = [...liveState_1.liveState.championshipRankings]
                            .sort((a, b) => b.score - a.score)
                            .slice(0, 3)
                            .map((r) => ({
                            id: r.teamId,
                            name: r.name,
                            institution: r.institution,
                            score: r.score
                        }));
                        liveState_1.liveState.podium.active = true;
                        liveState_1.liveState.podium.phaseNumber = liveState_1.liveState.phase;
                        liveState_1.liveState.podium.phaseLabel = 'Grande Final';
                        liveState_1.liveState.podium.entries = top3;
                        liveState_1.liveState.podium.isGrandFinal = true;
                        liveState_1.liveState.podiumReveal.stage = 'revealed';
                        broadcast();
                    }
                    else {
                        broadcast();
                    }
                }, 1000);
            }, 4000);
        });
        socket.on('moderator:showFinalRanking', () => {
            liveState_1.liveState.podiumReveal.finalRankingVisible = true;
            broadcast();
        });
        socket.on('moderator:finalizeChampionship', async () => {
            if (!liveState_1.liveState.championship)
                return;
            const totalPhases = await getTotalPhases();
            if (liveState_1.liveState.phase !== totalPhases)
                return;
            if (!liveState_1.liveState.podiumReveal.finalRankingVisible)
                return;
            const matches = await db_1.prisma.matchHistory.findMany({
                where: { championship: liveState_1.liveState.championship, editionName: liveState_1.liveState.editionName }
            });
            const championEntry = liveState_1.liveState.podium.entries[0] ?? null;
            let championLogoUrl = null;
            if (championEntry) {
                const team = await db_1.prisma.team.findUnique({ where: { id: championEntry.id } });
                championLogoUrl = team?.logoUrl ?? null;
            }
            await db_1.prisma.championshipHistory.create({
                data: {
                    championship: liveState_1.liveState.championship,
                    editionName: liveState_1.liveState.editionName ?? 'Sem nome',
                    championTeamId: championEntry?.id ?? null,
                    championTeamName: championEntry?.name ?? null,
                    finalRankingJson: JSON.stringify(liveState_1.liveState.championshipRankings),
                    matchesJson: JSON.stringify(matches),
                    totalMatches: matches.length,
                    startedAt: new Date(liveState_1.liveState.championshipStartedAt ?? Date.now()),
                    endedAt: new Date()
                }
            });
            liveState_1.liveState.championReveal = {
                active: true,
                teamName: championEntry?.name ?? null,
                logoUrl: championLogoUrl
            };
            liveState_1.liveState.championship = null;
            liveState_1.liveState.editionName = null;
            liveState_1.liveState.phase = 1;
            liveState_1.liveState.phaseRankings = [];
            liveState_1.liveState.championshipRankings = [];
            liveState_1.liveState.championshipStartedAt = null;
            liveState_1.liveState.eliminatedTeamIds = [];
            liveState_1.liveState.phaseRankingReveal = { visible: false };
            liveState_1.liveState.phaseFlow = { stage: 'idle', suspensePhrase: null };
            liveState_1.liveState.presentationPhaseScores = [];
            liveState_1.liveState.carriedPresentationScores = [];
            (0, liveState_1.resetPresentationFlow)();
            liveState_1.liveState.bracketVisible = false;
            liveState_1.liveState.podium.active = false;
            liveState_1.liveState.podiumReveal = {
                stage: 'idle',
                countdownValue: 0,
                suspensePhrase: null,
                finalRankingVisible: false
            };
            liveState_1.liveState.phaseTransition = { stage: 'idle' };
            liveState_1.liveState.expectedJurorCount = 0;
            const questionTime = await getQuestionTimeSeconds();
            (0, liveState_1.resetMatch)(questionTime);
            broadcast();
        });
        socket.on('moderator:showPhaseTransition', () => {
            liveState_1.liveState.phaseTransition.stage = 'carousel';
            broadcast();
            setTimeout(() => {
                liveState_1.liveState.phaseTransition.stage = 'webtec';
                broadcast();
            }, 8000);
        });
        socket.on('moderator:hidePhaseTransition', () => {
            liveState_1.liveState.phaseTransition.stage = 'idle';
            broadcast();
        });
        socket.on('moderator:startPresentation', async (payload) => {
            const phaseConfig = await getCurrentPhaseConfig();
            if (!phaseConfig ||
                (phaseConfig.type !== 'apresentacao' && phaseConfig.type !== 'apresentacao_quiz'))
                return;
            if (liveState_1.liveState.presentationFlow.stage !== 'idle')
                return;
            if (liveState_1.liveState.presentationFlow.presentedTeamIds.includes(payload.teamId))
                return;
            liveState_1.liveState.bracketVisible = false;
            const dupla = await db_1.prisma.presentationDupla.findUnique({ where: { id: payload.duplaId } });
            if (!dupla || (dupla.teamAId !== payload.teamId && dupla.teamBId !== payload.teamId))
                return;
            const team = await db_1.prisma.team.findUnique({ where: { id: payload.teamId } });
            if (!team)
                return;
            let presentationMode = 'standard';
            let slides = [];
            if (payload.useDocument) {
                const doc = await db_1.prisma.presentationDocument.findUnique({
                    where: { duplaId_teamId: { duplaId: payload.duplaId, teamId: payload.teamId } },
                    include: { slides: { orderBy: { order: 'asc' } } }
                });
                if (doc && doc.slides.length > 0) {
                    presentationMode = 'document';
                    slides = doc.slides.map((s) => ({ order: s.order, imageUrl: s.imageUrl }));
                }
            }
            const minutes = phaseConfig.presentationMinutes ?? 10;
            const presentedTeamIds = liveState_1.liveState.presentationFlow.presentedTeamIds;
            liveState_1.liveState.presentationFlow = {
                stage: 'countdown',
                duplaId: payload.duplaId,
                teamId: team.id,
                teamName: team.name,
                theme: payload.teamId === dupla.teamAId ? dupla.themeA : (dupla.themeB ?? dupla.themeA),
                timeLeft: minutes * 60,
                presentedTeamIds,
                criteriaScores: [],
                jurorsSubmitted: [],
                allJurorsSubmitted: false,
                presentationMode,
                slides,
                currentPage: 1
            };
            await refreshExpectedJurorCount();
            broadcast();
            startCountdown(10, async () => {
                if (liveState_1.liveState.presentationFlow.teamId !== team.id)
                    return;
                liveState_1.liveState.presentationFlow.stage = 'presenting';
            });
        });
        socket.on('moderator:finishPresentation', async () => {
            if (liveState_1.liveState.presentationFlow.stage !== 'presenting')
                return;
            if (liveState_1.liveState.presentationFlow.timeLeft > 0)
                return;
            liveState_1.liveState.presentationFlow.stage = 'concluded';
            const teamId = liveState_1.liveState.presentationFlow.teamId;
            if (teamId && !liveState_1.liveState.presentationFlow.presentedTeamIds.includes(teamId)) {
                liveState_1.liveState.presentationFlow.presentedTeamIds.push(teamId);
            }
            await checkAllJurorsSubmitted(broadcast);
            broadcast();
        });
        socket.on('moderator:presentationNextPage', () => {
            const flow = liveState_1.liveState.presentationFlow;
            if (flow.stage !== 'presenting' || flow.presentationMode !== 'document')
                return;
            flow.currentPage = Math.min(flow.currentPage + 1, flow.slides.length || flow.currentPage);
            broadcast();
        });
        socket.on('moderator:presentationPrevPage', () => {
            const flow = liveState_1.liveState.presentationFlow;
            if (flow.stage !== 'presenting' || flow.presentationMode !== 'document')
                return;
            flow.currentPage = Math.max(1, flow.currentPage - 1);
            broadcast();
        });
        socket.on('juror:setPresentationScore', (payload) => {
            if (liveState_1.liveState.presentationFlow.stage === 'idle')
                return;
            if (liveState_1.liveState.presentationFlow.jurorsSubmitted.includes(payload.jurorId))
                return;
            if (!payload.criteriaId)
                return;
            const existing = liveState_1.liveState.presentationFlow.criteriaScores.find((e) => e.jurorId === payload.jurorId && e.criteriaId === payload.criteriaId);
            if (existing) {
                existing.score = payload.score;
            }
            else {
                liveState_1.liveState.presentationFlow.criteriaScores.push({ ...payload });
            }
            broadcast();
        });
        socket.on('juror:submitPresentationEvaluation', async (payload) => {
            const flow = liveState_1.liveState.presentationFlow;
            if (flow.stage === 'idle' || !flow.teamId)
                return;
            if (flow.jurorsSubmitted.includes(payload.jurorId))
                return;
            if (!liveState_1.liveState.jurors.some((j) => j.id === payload.jurorId))
                return;
            flow.jurorsSubmitted.push(payload.jurorId);
            broadcast();
            await checkAllJurorsSubmitted(broadcast);
            broadcast();
        });
        socket.on('moderator:advanceToNextPresentation', () => {
            if (liveState_1.liveState.presentationFlow.stage !== 'concluded' ||
                !liveState_1.liveState.presentationFlow.allJurorsSubmitted)
                return;
            liveState_1.liveState.presentationFlow = {
                stage: 'idle',
                duplaId: null,
                teamId: null,
                teamName: null,
                theme: null,
                timeLeft: 0,
                presentedTeamIds: liveState_1.liveState.presentationFlow.presentedTeamIds,
                criteriaScores: [],
                jurorsSubmitted: [],
                allJurorsSubmitted: false,
                presentationMode: 'standard',
                slides: [],
                currentPage: 1
            };
            broadcast();
        });
        socket.on('juror:register', async (payload, callback) => {
            const code = (payload.code || '').trim().toUpperCase();
            const juror = await db_1.prisma.juror.findUnique({ where: { code } });
            if (!juror) {
                callback?.({ success: false, error: 'Código de jurado inválido.' });
                return;
            }
            const phaseConfig = await getCurrentPhaseConfig();
            if (phaseConfig) {
                const authRows = await db_1.prisma.phaseJurorAuthorization.findMany({
                    where: { phaseId: phaseConfig.id }
                });
                if (authRows.length > 0 && !authRows.some((a) => a.jurorId === juror.id)) {
                    callback?.({
                        success: false,
                        error: 'Este jurado não está autorizado a avaliar esta fase.'
                    });
                    return;
                }
            }
            if (liveState_1.liveState.jurors.some((j) => j.id === juror.id)) {
                callback?.({ success: false, error: 'Este jurado já está ligado a esta partida.' });
                return;
            }
            const maxJurors = await getMaxJurors();
            if (liveState_1.liveState.jurors.length >= maxJurors) {
                callback?.({
                    success: false,
                    error: 'Número máximo de jurados já atingido para esta partida.'
                });
                return;
            }
            liveState_1.liveState.jurors.push({ id: juror.id, name: juror.name });
            socket.data.jurorId = juror.id;
            await refreshExpectedJurorCount();
            broadcast();
            callback?.({ success: true, jurorId: juror.id });
        });
        socket.on('moderator:registerJurorLocally', async (payload, callback) => {
            const juror = await db_1.prisma.juror.findUnique({ where: { id: payload.jurorId } });
            if (!juror) {
                callback?.({ success: false, error: 'Jurado não encontrado.' });
                return;
            }
            const phaseConfig = await getCurrentPhaseConfig();
            if (phaseConfig) {
                const authRows = await db_1.prisma.phaseJurorAuthorization.findMany({
                    where: { phaseId: phaseConfig.id }
                });
                if (authRows.length > 0 && !authRows.some((a) => a.jurorId === juror.id)) {
                    callback?.({
                        success: false,
                        error: 'Este jurado não está autorizado a avaliar esta fase.'
                    });
                    return;
                }
            }
            if (liveState_1.liveState.jurors.some((j) => j.id === juror.id)) {
                callback?.({ success: true, jurorId: juror.id });
                return;
            }
            const maxJurors = await getMaxJurors();
            if (liveState_1.liveState.jurors.length >= maxJurors) {
                callback?.({
                    success: false,
                    error: 'Número máximo de jurados já atingido para esta partida.'
                });
                return;
            }
            liveState_1.liveState.jurors.push({ id: juror.id, name: juror.name });
            socket.data.locallyRegisteredJurorIds = socket.data.locallyRegisteredJurorIds || [];
            socket.data.locallyRegisteredJurorIds.push(juror.id);
            await refreshExpectedJurorCount();
            broadcast();
            callback?.({ success: true, jurorId: juror.id });
        });
        socket.on('moderator:removeJuror', async (payload) => {
            liveState_1.liveState.jurors = liveState_1.liveState.jurors.filter((j) => j.id !== payload.jurorId);
            liveState_1.liveState.jurorEntries = liveState_1.liveState.jurorEntries.filter((e) => e.jurorId !== payload.jurorId);
            await checkAllJurorsSubmitted(broadcast);
            broadcast();
        });
        socket.on('juror:setScore', (payload) => {
            const existing = liveState_1.liveState.jurorEntries.find((e) => e.jurorId === payload.jurorId && e.itemId === payload.itemId);
            if (existing) {
                existing.scoreA = payload.scoreA;
                existing.scoreB = payload.scoreB;
            }
            else {
                liveState_1.liveState.jurorEntries.push({ ...payload });
            }
            broadcast();
        });
        socket.on('moderator:confirmEvaluation', async (payload) => {
            if (liveState_1.liveState.jurorSubmittedItemIds.includes(payload.itemId))
                return;
            if (liveState_1.liveState.expectedJurorCount > 0) {
                if (liveState_1.liveState.jurors.length < liveState_1.liveState.expectedJurorCount)
                    return;
                const missing = liveState_1.liveState.jurors.some((j) => !liveState_1.liveState.jurorEntries.some((e) => e.jurorId === j.id && e.itemId === payload.itemId));
                if (missing)
                    return;
            }
            const relevant = liveState_1.liveState.jurorEntries.filter((e) => e.itemId === payload.itemId);
            const totalA = relevant.reduce((sum, e) => sum + e.scoreA, 0);
            const totalB = relevant.reduce((sum, e) => sum + e.scoreB, 0);
            liveState_1.liveState.teamAScore += totalA;
            liveState_1.liveState.teamBScore += totalB;
            liveState_1.liveState.jurorSubmittedItemIds.push(payload.itemId);
            const wasActiveDraw = liveState_1.liveState.currentItemSource === 'analytic' &&
                liveState_1.liveState.currentAnalyticItemId === payload.itemId &&
                liveState_1.liveState.awaitingJuryEvaluation;
            if (wasActiveDraw) {
                liveState_1.liveState.teamAAnsweredCount += 1;
                liveState_1.liveState.teamBAnsweredCount += 1;
                liveState_1.liveState.awaitingJuryEvaluation = false;
                liveState_1.liveState.currentItemSource = null;
                liveState_1.liveState.currentAnalyticItemId = null;
                liveState_1.liveState.currentItemMode = null;
                if (await roundQuestionsComplete()) {
                    liveState_1.liveState.currentQuestionId = null;
                }
                else {
                    const nextTeam = liveState_1.liveState.activeTeam === 'A' ? 'B' : 'A';
                    await drawNextItem(nextTeam);
                }
            }
            broadcast();
        });
        socket.on('juror:setInitialScore', (payload) => {
            if (liveState_1.liveState.initialScoresConfirmed)
                return;
            const existing = liveState_1.liveState.initialScoreEntries.find((e) => e.jurorId === payload.jurorId);
            if (existing) {
                existing.scoreA = payload.scoreA;
                existing.scoreB = payload.scoreB;
            }
            else {
                liveState_1.liveState.initialScoreEntries.push({ ...payload });
            }
            broadcast();
        });
        socket.on('moderator:confirmInitialScores', () => {
            if (liveState_1.liveState.initialScoresConfirmed)
                return;
            const totalA = liveState_1.liveState.initialScoreEntries.reduce((sum, e) => sum + e.scoreA, 0);
            const totalB = liveState_1.liveState.initialScoreEntries.reduce((sum, e) => sum + e.scoreB, 0);
            liveState_1.liveState.teamAScore += totalA;
            liveState_1.liveState.teamBScore += totalB;
            liveState_1.liveState.initialScoresConfirmed = true;
            broadcast();
        });
        socket.on('player:joinWithCode', (payload, callback) => {
            const code = (payload.code || '').trim().toUpperCase();
            let team = null;
            if (liveState_1.liveState.matchCodes.teamACode === code)
                team = 'A';
            else if (liveState_1.liveState.matchCodes.teamBCode === code)
                team = 'B';
            if (!team) {
                callback?.({ success: false, error: 'Código inválido ou a partida ainda não começou.' });
                return;
            }
            if (team === 'A') {
                liveState_1.liveState.matchCodes.teamAConnected = true;
                liveState_1.liveState.matchCodes.teamAPlayerName = payload.playerName || null;
            }
            else {
                liveState_1.liveState.matchCodes.teamBConnected = true;
                liveState_1.liveState.matchCodes.teamBPlayerName = payload.playerName || null;
            }
            broadcast();
            callback?.({
                success: true,
                team,
                teamName: team === 'A' ? liveState_1.liveState.teamA?.name : liveState_1.liveState.teamB?.name,
                opponentName: team === 'A' ? liveState_1.liveState.teamB?.name : liveState_1.liveState.teamA?.name
            });
        });
        socket.on('disconnect', async () => {
            console.log('Cliente desligado:', socket.id);
            if (socket.id === moderatorSocketId && liveState_1.liveState.moderatorAdjusting) {
                liveState_1.liveState.moderatorAdjusting = false;
                moderatorSocketId = null;
                broadcast();
            }
            const jurorId = socket.data?.jurorId;
            if (jurorId) {
                liveState_1.liveState.jurors = liveState_1.liveState.jurors.filter((j) => j.id !== jurorId);
                liveState_1.liveState.jurorEntries = liveState_1.liveState.jurorEntries.filter((e) => e.jurorId !== jurorId);
                await checkAllJurorsSubmitted(broadcast);
                broadcast();
            }
            const localJurorIds = socket.data?.locallyRegisteredJurorIds || [];
            if (localJurorIds.length) {
                liveState_1.liveState.jurors = liveState_1.liveState.jurors.filter((j) => !localJurorIds.includes(j.id));
                liveState_1.liveState.jurorEntries = liveState_1.liveState.jurorEntries.filter((e) => !localJurorIds.includes(e.jurorId));
                await checkAllJurorsSubmitted(broadcast);
                broadcast();
            }
            const moderatorId = socket.data?.moderatorId;
            if (moderatorId) {
                liveState_1.liveState.activeModerators = liveState_1.liveState.activeModerators.filter((m) => m.id !== moderatorId);
                broadcast();
            }
        });
    });
}
exports.registerSocketHandlers = registerSocketHandlers;
//# sourceMappingURL=index.js.map