import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

const DEFAULTS = {
  questionTimeSeconds: 30,
  maxJurors: 5,
  partnersDurationSeconds: 20,
  tiebreakAutoEnabled: false,
  tiebreakMethod: 'quiz'
}

router.get('/', async (_req, res) => {
  const rows = await prisma.setting.findMany()
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]))
  res.json({
    questionTimeSeconds: Number(map.questionTimeSeconds ?? DEFAULTS.questionTimeSeconds),
    maxJurors: Number(map.maxJurors ?? DEFAULTS.maxJurors),
    partnersDurationSeconds: Number(map.partnersDurationSeconds ?? DEFAULTS.partnersDurationSeconds),
    tiebreakAutoEnabled: (map.tiebreakAutoEnabled ?? String(DEFAULTS.tiebreakAutoEnabled)) === 'true',
    tiebreakMethod: map.tiebreakMethod ?? DEFAULTS.tiebreakMethod
  })
})

router.put('/', async (req, res) => {
  const { questionTimeSeconds, maxJurors, partnersDurationSeconds, tiebreakAutoEnabled, tiebreakMethod } = req.body
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
  if (tiebreakAutoEnabled !== undefined) {
    await prisma.setting.upsert({
      where: { key: 'tiebreakAutoEnabled' },
      update: { value: String(tiebreakAutoEnabled) },
      create: { key: 'tiebreakAutoEnabled', value: String(tiebreakAutoEnabled) }
    })
  }
  if (tiebreakMethod !== undefined) {
    await prisma.setting.upsert({
      where: { key: 'tiebreakMethod' },
      update: { value: String(tiebreakMethod) },
      create: { key: 'tiebreakMethod', value: String(tiebreakMethod) }
    })
  }
  res.json({ questionTimeSeconds, maxJurors, partnersDurationSeconds, tiebreakAutoEnabled, tiebreakMethod })
})

export default router
