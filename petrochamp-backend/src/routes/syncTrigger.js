"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const syncService_1 = require("../services/syncService");
const router = (0, express_1.Router)();
// CORRIGIDO — syncService.ts passou a exportar a classe SyncService em vez
// da função runSync(). O CLOUD_API_URL é o mesmo usado no resto do backend
// para saber onde está o Admin Cloud (Render).
const CLOUD_API_URL = process.env.CLOUD_API_URL;
router.post('/run', async (_req, res) => {
    if (!CLOUD_API_URL) {
        res.json({ ran: false, reason: 'CLOUD_API_URL não configurado.' });
        return;
    }
    try {
        const syncService = new syncService_1.SyncService(CLOUD_API_URL);
        await syncService.syncAll();
        res.json({ ran: true });
    }
    catch (error) {
        res.status(500).json({
            ran: false,
            reason: error instanceof Error ? error.message : 'Erro desconhecido.'
        });
    }
});
exports.default = router;
//# sourceMappingURL=syncTrigger.js.map