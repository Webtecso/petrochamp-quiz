"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const { championship, phase } = req.query;
    const history = await db_1.prisma.matchHistory.findMany({
        where: {
            championship: championship ? String(championship) : undefined,
            phase: phase ? Number(phase) : undefined,
            deletedAt: null // NOVO
        },
        orderBy: { endedAt: 'desc' }
    });
    res.json(history);
});
router.get('/:id', async (req, res) => {
    const id = Number(req.params.id);
    const entry = await db_1.prisma.matchHistory.findUnique({ where: { id } });
    if (!entry || entry.deletedAt) {
        res.status(404).json({ error: 'Registo não encontrado' });
        return;
    }
    res.json(entry);
});
// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.matchHistory.update({ where: { id }, data: { deletedAt: new Date() } });
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Registo não encontrado' });
    }
});
exports.default = router;
//# sourceMappingURL=matchHistory.js.map