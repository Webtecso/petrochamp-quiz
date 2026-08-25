import { prisma } from '../db'
import { emitConfigUpdated, type ConfigType } from '../socket/configEvents'

const CLOUD_API_URL = process.env.CLOUD_API_URL

// Reordenado por hierarquia de dependência (Entidades Pai -> Entidades Filhas)
const SYNC_TABLES = [
  // 1. Entidades base / independentes
  'team',
  'juror',
  'moderator',
  'partner',
  'suspensePhrase',
  'repescagemConfig',
  'phase',

  // 2. Definições e itens de avaliação (devem preceder a associação aos critérios)
  'evaluationItem',
  'moderatorAreaPermission',

  // 3. Critérios e dados dependentes de Phase / EvaluationItem
  'presentationCriteria',
  'presentationDupla',
  'question',
  'tiebreakQuestion',
  'evaluationItemJuror',
  'phaseJurorAuthorization',

  // 4. Jogos, pontuações, documentos e históricos
  'bracketMatch',
  'tiebreakMatch',
  'repescagemVote',
  'presentationScore',
  'presentationDocument',
  'presentationSlide',
  'matchHistory',
  'championshipHistory'
] as const

type SyncTable = (typeof SYNC_TABLES)[number]

const TABLE_TO_CONFIG_TYPE: Partial<Record<SyncTable, ConfigType>> = {
  team: 'teams',
  phase: 'phases',
  question: 'questions',
  tiebreakQuestion: 'tiebreakQuestions',
  evaluationItem: 'evaluationItems',
  evaluationItemJuror: 'evaluationItems',
  juror: 'jurors',
  partner: 'partners',
  suspensePhrase: 'suspensePhrases',
  bracketMatch: 'bracket',
  presentationCriteria: 'presentation',
  presentationDupla: 'presentation',
  presentationScore: 'presentation',
  presentationDocument: 'presentation',
  presentationSlide: 'presentation'
}

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>
  findUnique: (args: unknown) => Promise<{ updatedAt: Date } | null>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
}

const prismaClient = prisma as unknown as Record<string, PrismaDelegate>

interface SyncResult {
  ran: boolean
  reason?: string
  pushed?: Record<string, number>
  pulled?: Record<string, number>
}

async function getLastSyncedAt(): Promise<Date> {
  const meta = await prisma.syncMeta.findUnique({ where: { id: 'singleton' } })
  return meta?.lastSyncedAt ?? new Date(0)
}

async function setLastSyncedAt(date: Date): Promise<void> {
  await prisma.syncMeta.upsert({
    where: { id: 'singleton' },
    update: { lastSyncedAt: date },
    create: { id: 'singleton', lastSyncedAt: date }
  })
}

async function collectLocalChanges(since: Date): Promise<Record<string, unknown[]>> {
  const tables: Record<string, unknown[]> = {}
  for (const table of SYNC_TABLES) {
    const delegate = prismaClient[table]
    tables[table] = await delegate.findMany({ where: { updatedAt: { gt: since } } })
  }
  return tables
}

async function applyRemoteChanges(tables: Record<string, Array<Record<string, unknown>>>): Promise<Record<string, number>> {
  const applied: Record<string, number> = {}
  const deferred: Array<{ table: SyncTable; record: Record<string, unknown> }> = []

  // Primeira passagem: insere registos pela ordem hierárquica
  for (const table of SYNC_TABLES) {
    const records = tables[table]
    if (!records || records.length === 0) continue

    const delegate = prismaClient[table]
    let count = 0

    for (const record of records) {
      const incomingUpdatedAt = new Date(record.updatedAt as string)
      const existing = await delegate.findUnique({ where: { id: record.id } })

      try {
        if (!existing) {
          await delegate.create({ data: record })
          count++
        } else if (incomingUpdatedAt > existing.updatedAt) {
          await delegate.update({ where: { id: record.id }, data: record })
          count++
        }
      } catch (err: any) {
        // Guarda registos com falha de chave estrangeira para reprocessar no fim
        if (err.code === 'P2003') {
          deferred.push({ table, record })
        } else {
          throw err
        }
      }
    }
    applied[table] = count
  }

  // Segunda passagem: reprocessa registos diferidos cujos pais foram criados posteriormente
  for (const { table, record } of deferred) {
    const delegate = prismaClient[table]
    const incomingUpdatedAt = new Date(record.updatedAt as string)
    const existing = await delegate.findUnique({ where: { id: record.id } })

    try {
      if (!existing) {
        await delegate.create({ data: record })
        applied[table] = (applied[table] || 0) + 1
      } else if (incomingUpdatedAt > existing.updatedAt) {
        await delegate.update({ where: { id: record.id }, data: record })
        applied[table] = (applied[table] || 0) + 1
      }
    } catch (err: any) {
      if (err.code === 'P2003') {
        console.warn(`[Sync] Registo ${record.id} em '${table}' ignorado (chave estrangeira não resolvida).`)
      } else {
        throw err
      }
    }
  }

  return applied
}

function notifyChangedTypes(pulled: Record<string, number>): void {
  const emitted = new Set<ConfigType>()
  for (const [table, count] of Object.entries(pulled)) {
    if (count <= 0) continue
    const type = TABLE_TO_CONFIG_TYPE[table as SyncTable]
    if (type && !emitted.has(type)) {
      emitted.add(type)
      emitConfigUpdated(type)
    }
  }
}

export async function runSync(): Promise<SyncResult> {
  if (!CLOUD_API_URL) {
    return { ran: false, reason: 'CLOUD_API_URL não configurado.' }
  }

  try {
    const since = await getLastSyncedAt()
    const syncStartedAt = new Date()

    const localChanges = await collectLocalChanges(since)
    const pushRes = await fetch(`${CLOUD_API_URL}/api/sync/push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tables: localChanges }),
      signal: AbortSignal.timeout(15000)
    })
    if (!pushRes.ok) throw new Error(`Push falhou: ${pushRes.status}`)
    const pushData = (await pushRes.json()) as { applied: Record<string, number> }

    const pullRes = await fetch(`${CLOUD_API_URL}/api/sync/pull?since=${since.toISOString()}`, {
      signal: AbortSignal.timeout(15000)
    })
    if (!pullRes.ok) throw new Error(`Pull falhou: ${pullRes.status}`)
    const pullData = (await pullRes.json()) as { tables: Record<string, Array<Record<string, unknown>>> }
    const pulled = await applyRemoteChanges(pullData.tables)

    await setLastSyncedAt(syncStartedAt)

    console.log('Sincronização com o Cloud concluída.', { pushed: pushData.applied, pulled })
    notifyChangedTypes(pulled)
    return { ran: true, pushed: pushData.applied, pulled }
  } catch (error) {
    console.error('Sincronização com o Cloud falhou (a continuar offline):', error)
    return { ran: false, reason: error instanceof Error ? error.message : 'Erro desconhecido.' }
  }
}
