export declare class SyncService {
    private cloudUrl;
    constructor(cloudUrl: string);
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
    syncAll(): Promise<{
        pushed: Record<string, number>;
        pulled: Record<string, number>;
    }>;
    private pushAll;
    private pullAll;
    private applyRecord;
}
//# sourceMappingURL=syncService.d.ts.map