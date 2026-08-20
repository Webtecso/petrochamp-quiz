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
import { requireAdmin } from './middleware/requireAdmin'
import { registerSocketHandlers } from './socket'
import { initConfigEvents } from './socket/configEvents'
import { loadPersistedState, liveState } from './socket/liveState'
import { startPublicTunnel, stopPublicTunnel } from './services/tunnel'

const app = express()
app.use(cors())
app.use(express.json())
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

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

app.post('/api/internal/public-url', (req, res) => {
  const { url } = req.body as { url?: string }
  liveState.publicVotingUrl = url ?? null
  io.emit('state:sync', liveState)
  res.json({ success: true })
})

registerSocketHandlers(io)
initConfigEvents(io)

startPublicTunnel(() => {
  io.emit('state:sync', liveState)
})

process.on('SIGINT', () => {
  stopPublicTunnel()
  process.exit(0)
})

const PORT = process.env.PORT || 4000

loadPersistedState().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Petrochamp backend a correr em http://localhost:${PORT}`)
  })
})
