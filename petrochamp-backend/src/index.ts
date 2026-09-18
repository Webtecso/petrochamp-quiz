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

import networkInfoRouter from './routes/networkInfo'
import { requireAdmin } from './middleware/requireAdmin'
import { registerSocketHandlers } from './socket'
import { initConfigEvents } from './socket/configEvents'
import { loadPersistedState, liveState } from './socket/liveState'
import { startPublicTunnel, stopPublicTunnel } from './services/tunnel'

import { SyncService } from './services/syncService'

process.on('uncaughtException', (err) => {
  console.error('[uncaughtException] Erro não tratado - o backend continua a correr:', err)
})
process.on('unhandledRejection', (err) => {
  console.error(
    '[unhandledRejection] Rejeição de Promise não tratada - o backend continua a correr:',
    err
  )
})

const app = express()
app.use(cors())

app.use(express.json({ limit: '15mb' }))

const UPLOADS_BASE = process.env.UPLOADS_DIR
  ? process.env.UPLOADS_DIR
  : path.join(__dirname, '..', 'uploads')
app.use('/uploads', express.static(UPLOADS_BASE))

app.use('/portal', express.static(path.join(__dirname, '..', 'public', 'portal')))
app.use(express.static(path.join(__dirname, '..', '..', 'out', 'renderer')))

app.get('/health', async (_req, res) => {
  const teamCount = await prisma.team.count()
  res.json({ status: 'ok', teamsInDatabase: teamCount })
})

app.use('/api/teams', teamsRouter)
app.use('/api/questions', questionsRouter)
app.use('/api/evaluation-items', evaluationItemsRouter)
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

app.use('/api/network-info', networkInfoRouter)

app.use('/api/sync', syncRouter)
app.use('/api/sync', syncTriggerRouter)

app.post('/api/internal/public-url', (req, res) => {
  const { url } = req.body as { url?: string }
  liveState.publicVotingUrl = url ?? null
  io.emit('state:sync', liveState)
  res.json({ success: true })
})

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
    // CORRIGIDO - usa SyncService.syncAll() em vez da função runSync()
    // antiga (ver nota no import acima). Sem CLOUD_API_URL configurado,
    // salta silenciosamente em vez de tentar sincronizar.
    const cloudApiUrl = process.env.CLOUD_API_URL
    if (!cloudApiUrl) return

    const syncService = new SyncService(cloudApiUrl)
    syncService
      .syncAll()
      .then((result) => {
        console.log('Sincronização periódica com o Cloud concluída.', result)
        io.emit('state:sync', liveState)
      })
      .catch((err) => {
        console.log('Sincronização periódica falhou (a continuar offline):', err?.message ?? err)
      })
  }, SYNC_INTERVAL_MS)
})
