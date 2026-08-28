import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

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
  'presentationSlide',
] as const;

export class SyncService {
  private cloudUrl: string;

  constructor(cloudUrl: string) {
    this.cloudUrl = cloudUrl;
  }

  /**
   * Executa o ciclo de sincronização completo
   */
  async syncAll() {
    // 1. Obtém o timestamp da última sincronização com sucesso
    const meta = await prisma.syncMeta.findUnique({ where: { id: 'singleton' } });
    const lastSyncedAt = meta?.lastSyncedAt || new Date(0);
    const newSyncTimestamp = new Date();

    console.log(`[Sync] A iniciar sincronização desde: ${lastSyncedAt.toISOString()}`);

    for (const model of SYNC_ORDER) {
      try {
        await this.pushModel(model, lastSyncedAt);
        await this.pullModel(model, lastSyncedAt);
      } catch (error: any) {
        console.error(`[Sync Error] Falha ao sincronizar '${model}':`, error?.message || error);
      }
    }

    // 2. Atualiza o registo de última sincronização
    await prisma.syncMeta.upsert({
      where: { id: 'singleton' },
      create: { id: 'singleton', lastSyncedAt: newSyncTimestamp },
      update: { lastSyncedAt: newSyncTimestamp },
    });

    console.log('[Sync] Sincronização concluída com sucesso!');
  }

  private async pushModel(modelName: string, lastSync: Date) {
    // Puxa registos atualizados ou marcados com deletedAt após a última sync
    const changes = await (prisma as any)[modelName].findMany({
      where: {
        updatedAt: { gt: lastSync },
      },
    });

    if (changes.length === 0) return;

    // CORRIGIDO — o backend (routes/sync.ts, local e cloud) espera
    // { model, data } no body de /api/sync/push. Antes disto batia
    // sempre em 400 "Corpo inválido: falta tables", e o push nunca
    // aplicava nada do outro lado — incluindo os apagados (soft
    // delete), que é exatamente o bug reportado ("apago de um lado, o
    // outro continua"). O endpoint devolvia erro, o catch do syncAll()
    // engolia silenciosamente, e os logs diziam "concluída com
    // sucesso" mesmo sem nada ter sido de facto aplicado.
    await axios.post(`${this.cloudUrl}/api/sync/push`, {
      model: modelName,
      data: changes,
    });
  }

  private async pullModel(modelName: string, lastSync: Date) {
    // CORRIGIDO — o backend devolve agora um array diretamente para
    // ?model=<nome>&since=<data> (antes devolvia sempre TODAS as
    // tabelas num objeto { serverTime, tables }, ignorando por completo
    // o parâmetro "model" da query — o Array.isArray abaixo falhava
    // sempre, e o pull nunca aplicava nada).
    const response = await axios.get(`${this.cloudUrl}/api/sync/pull`, {
      params: { model: modelName, since: lastSync.toISOString() },
    });

    const remoteChanges = response.data;
    if (!Array.isArray(remoteChanges) || remoteChanges.length === 0) return;

    for (const item of remoteChanges) {
      try {
        const { id, createdAt, updatedAt, deletedAt, ...payload } = item;

        // Trata os campos de data
        const dataToSave = {
          ...payload,
          updatedAt: new Date(updatedAt),
          deletedAt: deletedAt ? new Date(deletedAt) : null,
        };

        if (createdAt) {
          (dataToSave as any).createdAt = new Date(createdAt);
        }

        await (prisma as any)[modelName].upsert({
          where: { id },
          create: { id, ...dataToSave },
          update: dataToSave,
        });
      } catch (err: any) {
        // CORRIGIDO — antes, uma exceção num único registo (ex: chave
        // estrangeira ainda não resolvida, P2003) abortava o `for`
        // inteiro, e todos os registos seguintes deste lote nunca
        // chegavam a ser aplicados. Agora regista o aviso e continua
        // com o resto — os registos com FK pendente acabam por ser
        // aplicados num ciclo de sync seguinte, quando o pai já existir.
        if (err?.code === 'P2003') {
          console.warn(`[Sync] '${modelName}' (${item.id}) ignorado nesta ronda — chave estrangeira não resolvida.`);
        } else if (err?.code === 'P2002') {
          console.warn(`[Sync] '${modelName}' (${item.id}) duplicado, ignorado.`);
        } else {
          console.error(`[Sync] Falha ao aplicar '${modelName}' (${item.id}):`, err?.message || err);
        }
      }
    }
  }
}
