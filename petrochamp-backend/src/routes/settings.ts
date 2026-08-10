import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

const DEFAULTS = {
  questionTimeSeconds: 30,
  maxJurors: 5,
  partnersDurationSeconds: 20
}

router.get('/', async (_req, res) => {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  res.json({
    questionTimeSeconds: Number(map.questionTimeSeconds ?? DEFAULTS.questionTimeSeconds),
    maxJurors: Number(map.maxJurors ?? DEFAULTS.maxJurors),
    partnersDurationSeconds: Number(map.partnersDurationSeconds ?? DEFAULTS.partnersDurationSeconds)
  })
})

router.put('/', async (req, res) => {
  const { questionTimeSeconds, maxJurors, partnersDurationSeconds } = req.body
  await prisma.setting.upsert({
    where: { key: 'questionTimeSeconds' },
    update: { value: String(questionTimeSeconds) },
    create: { key: 'questionTimeSeconds', value: String(questionTimeSeconds) }
  })
  await prisma.setting.upsert({
    where: { key: 'maxJurors' },
    update: { value: String(maxJurors) },
    create: { key: 'maxJurors', value: String(maxJurors) }
  })
  await prisma.setting.upsert({
    where: { key: 'partnersDurationSeconds' },
    update: { value: String(partnersDurationSeconds) },
    create: { key: 'partnersDurationSeconds', value: String(partnersDurationSeconds) }
  })
  res.json({ questionTimeSeconds, maxJurors, partnersDurationSeconds })
})

export default router
