import { prisma } from '../db'

const CLOUD_API_URL = process.env.CLOUD_API_URL

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

type PrismaDelegate = {
  findMany: (args: unknown) => Promise<unknown[]>
  findUnique: (args: unknown) => Promise<{ updatedAt: Date } | null>
  create: (args: unknown) => Promise<unknown>
  update: (args: unknown) => Promise<unknown>
}

// Cast centralizado para evitar parsing errors no esbuild/tsx
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

  for (const table of SYNC_TABLES) {
    const records = tables[table]
    if (!records || records.length === 0) continue

    const delegate = prismaClient[table]

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
    }
    applied[table] = count
  }

  return applied
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
    return { ran: true, pushed: pushData.applied, pulled }
  } catch (error) {
    console.error('Sincronização com o Cloud falhou (a continuar offline):', error)
    return { ran: false, reason: error instanceof Error ? error.message : 'Erro desconhecido.' }
  }
}
