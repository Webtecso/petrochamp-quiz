"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const http_1 = require("http");
const socket_io_1 = require("socket.io");
const db_1 = require("./db");
const teams_1 = __importDefault(require("./routes/teams"));
const questions_1 = __importDefault(require("./routes/questions"));
const evaluationItems_1 = __importDefault(require("./routes/evaluationItems"));
const evaluationCriteria_1 = require("./routes/evaluationCriteria");
const settings_1 = __importDefault(require("./routes/settings"));
const upload_1 = __importDefault(require("./routes/upload"));
const phases_1 = __importDefault(require("./routes/phases"));
const tiebreakQuestions_1 = __importDefault(require("./routes/tiebreakQuestions"));
const tiebreakMatches_1 = __importDefault(require("./routes/tiebreakMatches"));
const bracket_1 = __importDefault(require("./routes/bracket"));
const bracketLive_1 = __importDefault(require("./routes/bracketLive"));
const suspensePhrases_1 = __importDefault(require("./routes/suspensePhrases"));
const partners_1 = __importDefault(require("./routes/partners"));
const matchHistory_1 = __importDefault(require("./routes/matchHistory"));
const repescagem_1 = __importDefault(require("./routes/repescagem"));
const jurors_1 = __importDefault(require("./routes/jurors"));
const championshipHistory_1 = __importDefault(require("./routes/championshipHistory"));
const presentation_1 = __importDefault(require("./routes/presentation"));
const presentationDocuments_1 = __importDefault(require("./routes/presentationDocuments"));
const moderators_1 = __importDefault(require("./routes/moderators"));
const adminAuth_1 = __importDefault(require("./routes/adminAuth"));
const sync_1 = __importDefault(require("./routes/sync"));
const syncTrigger_1 = __importDefault(require("./routes/syncTrigger"));
// NOVO - rota que expõe o IP da máquina na rede local, para o frontend
// conseguir mostrar o link/QR code do portal de jurados sem depender de
// nenhum IP fixo nem de configuração manual (ver services/networkInfo.ts).
const networkInfo_1 = __importDefault(require("./routes/networkInfo"));
const requireAdmin_1 = require("./middleware/requireAdmin");
const socket_1 = require("./socket");
const configEvents_1 = require("./socket/configEvents");
const liveState_1 = require("./socket/liveState");
const tunnel_1 = require("./services/tunnel");
// CORRIGIDO - syncService.ts passou a exportar a classe SyncService em vez
// da função runSync(). O import antigo compilava (TypeScript não apanha
// isto sem strict de exports em runtime dinâmico), mas rebentava sempre
// que o setInterval periódico chamava runSync(), porque deixou de existir.
const syncService_1 = require("./services/syncService");
// NOTA: rede de segurança a nível de processo. Antes, um erro não
// tratado em qualquer rota ou callback (ex: o crash do otplib em
// adminAuth.ts) derrubava o processo Node inteiro, tirando o backend do
// ar por completo (todos os pedidos seguintes, incluindo Socket.io,
// passavam a dar ERR_CONNECTION_REFUSED até o tsx watch reiniciar
// sozinho). Isto garante que o processo nunca morre por causa de um erro
// isolado - o erro fica registado na consola, mas o backend continua vivo.
process.on('uncaughtException', (err) => {
    console.error('[uncaughtException] Erro não tratado - o backend continua a correr:', err);
});
process.on('unhandledRejection', (err) => {
    console.error('[unhandledRejection] Rejeição de Promise não tratada - o backend continua a correr:', err);
});
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
// CORRIGIDO - 10mb para 15mb. Perguntas/critérios/equipas com imagem
// guardam a imagem como base64 diretamente no campo (ver upload.ts), o
// que facilmente ultrapassa vários MB no JSON do pedido inteiro (POST/PATCH
// de uma pergunta com imagem). O limite antigo (mesmo a 10mb) ainda podia
// ser insuficiente para payloads com múltiplas imagens de uma vez (ex:
// sincronização), e o valor por omissão do Express (100kb) já tinha
// causado um PayloadTooLargeError confirmado nos logs.
app.use(express_1.default.json({ limit: '15mb' }));
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '..', 'uploads')));
app.use('/portal', express_1.default.static(path_1.default.join(__dirname, '..', 'public', 'portal')));
app.use(express_1.default.static(path_1.default.join(__dirname, '..', '..', 'out', 'renderer')));
app.get('/health', async (_req, res) => {
    const teamCount = await db_1.prisma.team.count();
    res.json({ status: 'ok', teamsInDatabase: teamCount });
});
app.use('/api/teams', teams_1.default);
app.use('/api/questions', questions_1.default);
app.use('/api/evaluation-items', evaluationItems_1.default);
// NOVO - critérios de avaliação por Pergunta Analítica (Admin → Avaliação).
app.use('/api/evaluation-criteria', evaluationCriteria_1.evaluationCriteriaRouter);
app.use('/api/settings', settings_1.default);
app.use('/api/upload', upload_1.default);
app.use('/api/phases', phases_1.default);
app.use('/api/tiebreak-questions', tiebreakQuestions_1.default);
app.use('/api/tiebreak-matches', tiebreakMatches_1.default);
app.use('/api/bracket', bracket_1.default);
app.use('/api/bracket-live', bracketLive_1.default);
app.use('/api/suspense-phrases', suspensePhrases_1.default);
app.use('/api/partners', partners_1.default);
app.use('/api/match-history', requireAdmin_1.requireAdmin, matchHistory_1.default);
app.use('/api/repescagem', repescagem_1.default);
app.use('/api/jurors', jurors_1.default);
app.use('/api/championship-history', requireAdmin_1.requireAdmin, championshipHistory_1.default);
app.use('/api/presentation', presentation_1.default);
app.use('/api/presentation-documents', presentationDocuments_1.default);
app.use('/api/moderators', requireAdmin_1.requireAdmin, moderators_1.default);
app.use('/api/admin-auth', adminAuth_1.default);
// NOVO - GET /api/network-info: { ip, port, portalUrl }. Sem autenticação
// de propósito, para o ecrã inicial da app poder mostrar o link/QR do
// portal de jurados assim que abre, sem exigir login de moderador antes.
app.use('/api/network-info', networkInfo_1.default);
// Rotas de sincronização com o Cloud. syncRouter expõe /pull e /push
// (usadas pelo Cloud quando é ELE a chamar-nos - não é o caso normal, mas
// fica simétrico); syncTriggerRouter expõe /run, chamada tanto pelo
// processo do Electron (main/index.ts) ao abrir a app, como pelo botão
// "Atualizar" no Admin, para forçar sync sem esperar pelo ciclo periódico.
app.use('/api/sync', sync_1.default);
app.use('/api/sync', syncTrigger_1.default);
// Rota interna para atualização do URL público via tunnel
app.post('/api/internal/public-url', (req, res) => {
    const { url } = req.body;
    liveState_1.liveState.publicVotingUrl = url ?? null;
    io.emit('state:sync', liveState_1.liveState);
    res.json({ success: true });
});
// NOTA: middleware de erro final. Apanha qualquer erro que chegue até
// aqui vindo de dentro de uma rota e devolve uma resposta 500 controlada.
// Tem de ser o ÚLTIMO app.use() de rotas Express.
app.use((err, _req, res, _next) => {
    console.error('[Erro não tratado numa rota]', err);
    if (!res.headersSent) {
        res.status(500).json({ error: 'Erro interno do servidor.' });
    }
});
const httpServer = (0, http_1.createServer)(app);
const io = new socket_io_1.Server(httpServer, {
    cors: { origin: '*' }
});
(0, socket_1.registerSocketHandlers)(io);
(0, configEvents_1.initConfigEvents)(io);
(0, tunnel_1.startPublicTunnel)(() => {
    io.emit('state:sync', liveState_1.liveState);
});
// Tratamento centralizado para encerramento gracioso
const handleShutdown = () => {
    (0, tunnel_1.stopPublicTunnel)();
    process.exit(0);
};
process.on('SIGINT', handleShutdown);
process.on('SIGTERM', handleShutdown);
const PORT = process.env.PORT || 4000;
(0, liveState_1.loadPersistedState)().then(() => {
    httpServer.listen(PORT, () => {
        console.log(`Petrochamp backend a correr em http://localhost:${PORT}`);
    });
    // Sincronização periódica em segundo plano (3 minutos)
    const SYNC_INTERVAL_MS = 3 * 60 * 1000;
    setInterval(() => {
        // CORRIGIDO - usa SyncService.syncAll() em vez da função runSync()
        // antiga (ver nota no import acima). Sem CLOUD_API_URL configurado,
        // salta silenciosamente em vez de tentar sincronizar.
        const cloudApiUrl = process.env.CLOUD_API_URL;
        if (!cloudApiUrl)
            return;
        const syncService = new syncService_1.SyncService(cloudApiUrl);
        syncService
            .syncAll()
            .then((result) => {
            console.log('Sincronização periódica com o Cloud concluída.', result);
            io.emit('state:sync', liveState_1.liveState);
        })
            .catch((err) => {
            console.log('Sincronização periódica falhou (a continuar offline):', err?.message ?? err);
        });
    }, SYNC_INTERVAL_MS);
});
//# sourceMappingURL=index.js.map