import { Router } from 'express'
import { prisma } from '../db'

const router = Router()

// Tabelas sincronizáveis, por ordem de dependência (as que são referenciadas
// por outras vêm primeiro). Setting, LiveSession, AdminAuth e AdminSession
// ficam de fora de propósito (ver notas no schema.prisma).
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
  'evaluationCriteria',
  'evaluationCriteriaScore',
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

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>
  findUnique: (args: unknown) => Promise<{ id: string; updatedAt: Date } | null>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
}

const prismaClient = prisma as unknown as Record<SyncTable, PrismaDelegate>

function isSyncTable(name: string): name is SyncTable {
  return (SYNC_TABLES as readonly string[]).includes(name)
}

// Encontra o registo existente também por chave composta, para tabelas
// onde o "id" pode divergir entre os dois lados mas o registo lógico é o
// mesmo (bracketMatch, presentationDupla, presentationDocument).
async function findExisting(
  table: SyncTable,
  record: Record<string, unknown>
): Promise<{ id: string; updatedAt: Date } | null> {
  const delegate = prismaClient[table]
  const rec = record as any

  if (table === 'bracketMatch') {
    return prisma.bracketMatch.findFirst({
      where: {
        OR: [{ id: rec.id }, { championship: rec.championship, round: rec.round, slot: rec.slot }]
      }
    })
  }

  if (table === 'presentationDupla') {
    return prisma.presentationDupla.findFirst({
      where: { OR: [{ id: rec.id }, { phaseId: rec.phaseId, teamAId: rec.teamAId }] }
    })
  }

  if (table === 'presentationDocument') {
    if (rec.duplaId && rec.teamId) {
      return prisma.presentationDocument.findFirst({
        where: { OR: [{ id: rec.id }, { duplaId: rec.duplaId, teamId: rec.teamId }] }
      })
    }
  }

  return delegate.findUnique({ where: { id: rec.id } })
}

// Aplica um único registo (create ou update, regra "mais recente ganha",
// incluindo apagados - deletedAt preenchido é só mais um campo do
// registo, propaga-se como qualquer outro). Devolve true se aplicou algo.
async function applyRecord(table: SyncTable, record: Record<string, unknown>): Promise<boolean> {
  const delegate = prismaClient[table]
  const incomingUpdatedAt = new Date(record.updatedAt as string)
  const existing = await findExisting(table, record)

  if (!existing) {
    await delegate.create({ data: record })
    return true
  }

  if (incomingUpdatedAt > existing.updatedAt) {
    // Força o id já existente (caso encontrado pela chave composta) para
    // não duplicar a primary key nem quebrar referências já existentes.
    await delegate.update({ where: { id: existing.id }, data: { ...record, id: existing.id } })
    return true
  }

  return false
}

// GET /api/sync/pull?model=<tabela>&since=<ISO timestamp>
// Devolve um ARRAY dos registos dessa tabela alterados (criados, editados
// ou apagados - deletedAt preenchido é só mais um campo) depois de
// "since". Contrato alinhado com services/syncService.ts (SyncService.pullModel),
// que espera response.data diretamente como array.
router.get('/pull', async (req, res) => {
  try {
    const modelParam = String(req.query.model || '')
    if (!isSyncTable(modelParam)) {
      res.status(400).json({ error: `Tabela inválida ou não sincronizável: "${modelParam}"` })
      return
    }
    const since = req.query.since ? new Date(String(req.query.since)) : new Date(0)
    const delegate = prismaClient[modelParam]
    const records = await delegate.findMany({ where: { updatedAt: { gt: since } } })
    res.json(records)
  } catch (error) {
    console.error('Erro em /api/sync/pull:', error)
    res.status(500).json({ error: 'Falha ao gerar dados de sincronização.' })
  }
})

// POST /api/sync/push
// Body: { model: <tabela>, data: record[] }
// Contrato alinhado com services/syncService.ts (SyncService.pushModel).
router.post('/push', async (req, res) => {
  try {
    const { model, data } = req.body as { model?: string; data?: Array<Record<string, unknown>> }
    if (!model || !isSyncTable(model)) {
      res.status(400).json({ error: `Corpo inválido: "model" em falta ou não sincronizável.` })
      return
    }
    if (!Array.isArray(data)) {
      res.status(400).json({ error: 'Corpo inválido: "data" tem de ser um array.' })
      return
    }

    let applied = 0
    for (const record of data) {
      try {
        const wasApplied = await applyRecord(model, record)
        if (wasApplied) applied++
      } catch (err: any) {
        if (err?.code === 'P2003') {
          console.warn(`[Sync] Registo em '${model}' (${(record as any).id}) ignorado - chave estrangeira não resolvida.`)
        } else if (err?.code === 'P2002') {
          console.warn(`[Sync] Registo duplicado em '${model}' (${(record as any).id}) ignorado.`)
        } else {
          throw err
        }
      }
    }

    res.json({ success: true, applied })
  } catch (error) {
    console.error('Erro em /api/sync/push:', error)
    res.status(500).json({ error: 'Falha ao aplicar dados de sincronização.' })
  }
})

export default router
