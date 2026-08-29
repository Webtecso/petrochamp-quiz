"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const { championship } = req.query;
    const entries = await db_1.prisma.championshipHistory.findMany({
        where: {
            championship: championship || undefined,
            deletedAt: null // NOVO
        },
        orderBy: { endedAt: 'desc' }
    });
    res.json(entries);
});
// CORRIGIDO - soft delete (ver nota em questions.ts)
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.championshipHistory.update({ where: { id }, data: { deletedAt: new Date() } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Registo não encontrado' });
    }
});
exports.default = router;
//# sourceMappingURL=championshipHistory.js.map