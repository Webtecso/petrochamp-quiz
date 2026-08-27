import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { prisma } from './db'
import teamsRouter from './routes/teams'
import questionsRouter from './routes/questions'
import evaluationItemsRouter from './routes/evaluationItems'
import { evaluationCriteriaRouter } from './routes/evaluationCriteria'
import settingsRouter from './routes/settings'
import uploadRouter from './routes/upload'
import phasesRouter from './routes/phases'
import tiebreakQuestionsRouter from './routes/tiebreakQuestions'
import tiebreakMatchesRouter from './routes/tiebreakMatches'
import bracketRouter from './routes/bracket'
import bracketLiveRouter from './routes/bracketLive'
import suspensePhrasesRouter from './routes/suspensePhrases'
import partnersRouter from './routes/partners'
import matchHistoryRouter from './routes/matchHistory'
import repescagemRouter from './routes/repescagem'
import jurorsRouter from './routes/jurors'
import championshipHistoryRouter from './routes/championshipHistory'
import presentationRouter from './routes/presentation'
import presentationDocumentsRouter from './routes/presentationDocuments'
import moderatorsRouter from './routes/moderators'
import adminAuthRouter from './routes/adminAuth'
import syncRouter from './routes/sync'
import syncTriggerRouter from './routes/syncTrigger'
// NOVO — rota que expõe o IP da máquina na rede local, para o frontend
// conseguir mostrar o link/QR code do portal de jurados sem depender de
// nenhum IP fixo nem de configuração manual (ver services/networkInfo.ts).
import networkInfoRouter from './routes/networkInfo'
import { requireAdmin } from './middleware/requireAdmin'
import { registerSocketHandlers } from './socket'
import { initConfigEvents } from './socket/configEvents'
import { loadPersistedState, liveState } from './socket/liveState'
import { startPublicTunnel, stopPublicTunnel } from './services/tunnel'
import { runSync } from './services/syncService'

// NOTA: rede de segurança a nível de processo. Antes, um erro não
// tratado em qualquer rota ou callback (ex: o crash do otplib em
// adminAuth.ts) derrubava o processo Node inteiro, tirando o backend do
// ar por completo (todos os pedidos seguintes, incluindo Socket.io,
// passavam a dar ERR_CONNECTION_REFUSED até o tsx watch reiniciar
// sozinho). Isto garante que o processo nunca morre por causa de um erro
// isolado — o erro fica registado na consola, mas o backend continua vivo.
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Erro não tratado — o backend continua a correr:', err)
})
process.on('unhandledRejection', (err) => {
  console.error(
    '[unhandledRejection] Rejeição de Promise não tratada — o backend continua a correr:',
    err
  )
})

const app = express()
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))
app.use('/portal', express.static(path.join(__dirname, '..', 'public', 'portal')))
app.use(express.static(path.join(__dirname, '..', '..', 'out', 'renderer')))

app.get('/health', async (_req, res) => {
  const teamCount = await prisma.team.count()
  res.json({ status: 'ok', teamsInDatabase: teamCount })
})

app.use('/api/teams', teamsRouter)
app.use('/api/questions', questionsRouter)
app.use('/api/evaluation-items', evaluationItemsRouter)
// NOVO — critérios de avaliação por Pergunta Analítica (Admin → Avaliação).
app.use('/api/evaluation-criteria', evaluationCriteriaRouter)
app.use('/api/settings', settingsRouter)
app.use('/api/upload', uploadRouter)
app.use('/api/phases', phasesRouter)
app.use('/api/tiebreak-questions', tiebreakQuestionsRouter)
app.use('/api/tiebreak-matches', tiebreakMatchesRouter)
app.use('/api/bracket', bracketRouter)
app.use('/api/bracket-live', bracketLiveRouter)
app.use('/api/suspense-phrases', suspensePhrasesRouter)
app.use('/api/partners', partnersRouter)
app.use('/api/match-history', requireAdmin, matchHistoryRouter)
app.use('/api/repescagem', repescagemRouter)
app.use('/api/jurors', jurorsRouter)
app.use('/api/championship-history', requireAdmin, championshipHistoryRouter)
app.use('/api/presentation', presentationRouter)
app.use('/api/presentation-documents', presentationDocumentsRouter)
app.use('/api/moderators', requireAdmin, moderatorsRouter)
app.use('/api/admin-auth', adminAuthRouter)
// NOVO — GET /api/network-info: { ip, port, portalUrl }. Sem autenticação
// de propósito, para o ecrã inicial da app poder mostrar o link/QR do
// portal de jurados assim que abre, sem exigir login de moderador antes.
app.use('/api/network-info', networkInfoRouter)

// Rotas de sincronização com o Cloud. syncRouter expõe /pull e /push
// (usadas pelo Cloud quando é ELE a chamar-nos — não é o caso normal, mas
// fica simétrico); syncTriggerRouter expõe /run, chamada tanto pelo
// processo do Electron (main/index.ts) ao abrir a app, como pelo botão
// "Atualizar" no Admin, para forçar sync sem esperar pelo ciclo periódico.
app.use('/api/sync', syncRouter)
app.use('/api/sync', syncTriggerRouter)

// Rota interna para atualização do URL público via tunnel
app.post('/api/internal/public-url', (req, res) => {
  const { url } = req.body as { url?: string }
  liveState.publicVotingUrl = url ?? null
  io.emit('state:sync', liveState)
  res.json({ success: true })
})

// NOTA: middleware de erro final. Apanha qualquer erro que chegue até
// aqui vindo de dentro de uma rota e devolve uma resposta 500 controlada.
// Tem de ser o ÚLTIMO app.use() de rotas Express.
app.use(
  (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Erro não tratado numa rota]', err)
    if (!res.headersSent) {
      res.status(500).json({ error: 'Erro interno do servidor.' })
    }
  }
)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

registerSocketHandlers(io)
initConfigEvents(io)

startPublicTunnel(() => {
  io.emit('state:sync', liveState)
})

// Tratamento centralizado para encerramento gracioso
const handleShutdown = () => {
  stopPublicTunnel()
  process.exit(0)
}

process.on('SIGINT', handleShutdown)
process.on('SIGTERM', handleShutdown)

const PORT = process.env.PORT || 4000

loadPersistedState().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Petrochamp backend a correr em http://localhost:${PORT}`)
  })

  // Sincronização periódica em segundo plano (3 minutos)
  const SYNC_INTERVAL_MS = 3 * 60 * 1000
  setInterval(() => {
    runSync()
      .then((result) => {
        if (result.ran) {
          console.log('Sincronização periódica com o Cloud concluída.', result)
          io.emit('state:sync', liveState)
        }
      })
      .catch((err) => {
        console.log('Sincronização periódica falhou (a continuar offline):', err?.message ?? err)
      })
  }, SYNC_INTERVAL_MS)
})
