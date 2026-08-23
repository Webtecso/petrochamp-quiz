import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

// Tabelas sincronizáveis, por ordem de dependência (as que são referenciadas
// por outras vêm primeiro, para o lado que recebe conseguir aplicar sem
// violar foreign keys). Setting, LiveSession, AdminAuth e AdminSession ficam
// de fora de propósito (ver notas no schema.prisma).
const SYNC_TABLES = [
  'team',
  'juror',
  'moderator',
  'moderatorAreaPermission',
  'phase',
  'presentationCriteria',
  'presentationDupla',
  'question',
  'tiebreakQuestion',
  'evaluationItem',
  'evaluationItemJuror',
  'phaseJurorAuthorization',
  'partner',
  'suspensePhrase',
  'bracketMatch',
  'tiebreakMatch',
  'repescagemConfig',
  'repescagemVote',
  'presentationScore',
  'presentationDocument',
  'presentationSlide',
  'matchHistory',
  'championshipHistory'
] as const

type SyncTable = (typeof SYNC_TABLES)[number]

// GET /api/sync/pull?since=<ISO timestamp ou vazio>
// Devolve tudo o que mudou (criado, editado, ou apagado) depois de "since",
// em todas as tabelas sincronizáveis. deletedAt preenchido = "apagar aí".
router.get('/pull', async (req, res) => {
  try {
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0)
    const result: Record<string, unknown[]> = {}

    for (const table of SYNC_TABLES) {
      const delegate = (
        prisma as unknown as Record<
          SyncTable,
          { findMany: (args: unknown) => Promise<unknown[]> }
        >
      )[table]

      result[table] = await delegate.findMany({
        where: { updatedAt: { gt: since } }
      })
    }

    res.json({ serverTime: new Date().toISOString(), tables: result })
  } catch (error) {
    console.error('Erro em /api/sync/pull:', error)
    res.status(500).json({ error: 'Falha ao gerar dados de sincronização.' })
  }
})

// POST /api/sync/push
// Body: { tables: { [tableName]: record[] } }
// Aplica cada registo recebido via upsert. Se já existir localmente um
// registo com o mesmo id e updatedAt mais recente ou igual, ignora (o
// outro lado é que está desatualizado, não este). Só substitui quando o
// registo recebido é mais recente — regra "mais recente ganha".
router.post('/push', async (req, res) => {
  try {
    const tables = req.body?.tables as Record<string, Array<Record<string, unknown>>> | undefined
    if (!tables) {
      res.status(400).json({ error: 'Corpo inválido: falta "tables".' })
      return
    }

    const applied: Record<string, number> = {}

    for (const table of SYNC_TABLES) {
      const records = tables[table]
      if (!records || records.length === 0) continue

      const delegate = (
        prisma as unknown as Record<
          SyncTable,
          {
            findUnique: (args: unknown) => Promise<{ updatedAt: Date } | null>
            create: (args: unknown) => Promise<unknown>
            update: (args: unknown) => Promise<unknown>
          }
        >
      )[table]

      let count = 0
      for (const record of records) {
        const incomingUpdatedAt = new Date(record.updatedAt as string)
        const existing = await delegate.findUnique({ where: { id: record.id } })

        if (!existing) {
          await delegate.create({ data: record })
          count++
          continue
        }

        if (incomingUpdatedAt > existing.updatedAt) {
          await delegate.update({ where: { id: record.id }, data: record })
          count++
        }
        // Se existing for mais recente ou igual, não faz nada — o lado
        // que enviou é que vai ficar atualizado no próximo "pull" dele.
      }
      applied[table] = count
    }

    res.json({ success: true, applied })
  } catch (error) {
    console.error('Erro em /api/sync/push:', error)
    res.status(500).json({ error: 'Falha ao aplicar dados de sincronização.' })
  }
})

export default router
