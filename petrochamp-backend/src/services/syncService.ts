import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const prisma = new PrismaClient()

// Ordem estrita: Pais primeiro, Filhos depois (evita erros de Foreign Key)
const SYNC_ORDER = [
  // 1. Tabelas Independentes / Base
  'team',
  'juror',
  'question',
  'tiebreakQuestion',
  'setting',
  'phase',
  'suspensePhrase',
  'partner',
  'moderator',
  'repescagemConfig',
  'evaluationItem',
  // 2. Tabelas Nível 1 (Dependem das tabelas base)
  'presentationDupla',
  'presentationCriteria',
  'phaseJurorAuthorization',
  'evaluationItemJuror',
  'evaluationCriteria',
  'presentationDocument',
  'moderatorAreaPermission',
  'bracketMatch',
  'tiebreakMatch',
  'matchHistory',
  'repescagemVote',
  'championshipHistory',
  // 3. Tabelas Nível 2 (Dependem do Nível 1)
  'presentationScore',
  'evaluationCriteriaScore',
  'presentationSlide'
] as const

type SyncModel = (typeof SYNC_ORDER)[number]

export class SyncService {
  private cloudUrl: string

  constructor(cloudUrl: string) {
    this.cloudUrl = cloudUrl
  }

  /**
   * Executa o ciclo de sincronização completo.
   *
   * CORRIGIDO — o endpoint do Admin Cloud (/api/sync/pull e /api/sync/push)
   * trabalha com TODAS as tabelas numa única chamada, não uma tabela por
   * pedido. A versão anterior desta classe chamava pullModel/pushModel por
   * tabela, com um formato de payload diferente do que o servidor espera
   * ({ model, data } em vez de { tables: {...} }), o que fazia o sync
   * falhar silenciosamente (ou nem sequer bater certo com a resposta).
   */
  async syncAll(): Promise<{ pushed: Record<string, number>; pulled: Record<string, number> }> {
    const meta = await prisma.syncMeta.findUnique({ where: { id: 'singleton' } })
    const lastSyncedAt = meta?.lastSyncedAt || new Date(0)
    const newSyncTimestamp = new Date()

    console.log(`[Sync] A iniciar sincronização desde: ${lastSyncedAt.toISOString()}`)

    const pushed = await this.pushAll(lastSyncedAt)
    const pulled = await this.pullAll(lastSyncedAt)

    await prisma.syncMeta.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastSyncedAt: newSyncTimestamp },
      update: { lastSyncedAt: newSyncTimestamp }
    })

    console.log('[Sync] Sincronização concluída com sucesso!', { pushed, pulled })
    return { pushed, pulled }
  }

  // Reúne as alterações locais de todas as tabelas e envia tudo de uma vez
  // para POST /api/sync/push, no formato { tables: { team: [...], ... } }
  // que o servidor espera.
  private async pushAll(lastSync: Date): Promise<Record<string, number>> {
    const tables: Record<string, unknown[]> = {}

    for (const model of SYNC_ORDER) {
      const changes = await (prisma as any)[model].findMany({
        where: { updatedAt: { gt: lastSync } }
      })
      if (changes.length > 0) {
        tables[model] = changes
      }
    }

    if (Object.keys(tables).length === 0) {
      return {}
    }

    const response = await axios.post(`${this.cloudUrl}/api/sync/push`, { tables })
    return (response.data?.applied as Record<string, number>) ?? {}
  }

  // Pede tudo o que mudou no Cloud desde a última sync, numa única chamada
  // a GET /api/sync/pull?since=X, e aplica cada tabela localmente.
  private async pullAll(lastSync: Date): Promise<Record<string, number>> {
    const response = await axios.get(`${this.cloudUrl}/api/sync/pull`, {
      params: { since: lastSync.toISOString() }
    })

    const remoteTables = (response.data?.tables as Record<string, unknown[]>) ?? {}
    const applied: Record<string, number> = {}

    for (const model of SYNC_ORDER) {
      const records = remoteTables[model]
      if (!records || records.length === 0) continue

      let count = 0
      for (const record of records) {
        const wasApplied = await this.applyRecord(model, record as Record<string, unknown>)
        if (wasApplied) count++
      }
      applied[model] = count
    }

    return applied
  }

  // Cria ou atualiza um único registo local (regra "mais recente ganha").
  private async applyRecord(model: SyncModel, record: Record<string, unknown>): Promise<boolean> {
    const delegate = (prisma as any)[model]
    const rec = record as any
    const incomingUpdatedAt = new Date(rec.updatedAt)

    const existing = await delegate.findUnique({ where: { id: rec.id } }).catch(() => null)

    if (!existing) {
      const { id, createdAt, updatedAt, deletedAt, ...payload } = rec
      await delegate.create({
        data: {
          id,
          ...payload,
          ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
          updatedAt: new Date(updatedAt),
          deletedAt: deletedAt ? new Date(deletedAt) : null
        }
      })
      return true
    }

    if (incomingUpdatedAt > existing.updatedAt) {
      const { id, createdAt, updatedAt, deletedAt, ...payload } = rec
      await delegate.update({
        where: { id: existing.id },
        data: {
          ...payload,
          updatedAt: new Date(updatedAt),
          deletedAt: deletedAt ? new Date(deletedAt) : null
        }
      })
      return true
    }

    return false
  }
}
