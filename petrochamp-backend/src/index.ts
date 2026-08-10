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
import { registerSocketHandlers } from './socket'
import { loadPersistedState } from './socket/liveState'

const app = express()
app.use(cors())
app.use(express.json())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))
app.use('/portal', express.static(path.join(__dirname, '..', 'public', 'portal')))

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
app.use('/api/match-history', matchHistoryRouter)
app.use('/api/repescagem', repescagemRouter)
app.use('/api/jurors', jurorsRouter)
app.use('/api/championship-history', championshipHistoryRouter)
app.use('/api/presentation', presentationRouter)
app.use('/api/presentation-documents', presentationDocumentsRouter)

const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: '*' }
})

registerSocketHandlers(io)

const PORT = process.env.PORT || 4000

loadPersistedState().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`Petrochamp backend a correr em http://localhost:${PORT}`)
  })
})
