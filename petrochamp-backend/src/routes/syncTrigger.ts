import { Router } from 'express'
import { runSync } from '../services/syncService'

const router = Router()

router.post('/run', async (_req, res) => {
  const result = await runSync()
  res.json(result)
})

export default router
