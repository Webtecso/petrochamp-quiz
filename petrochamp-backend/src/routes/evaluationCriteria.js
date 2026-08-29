"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluationCriteriaRouter = void 0;
const express_1 = require("express");
const db_1 = require("../db");
exports.evaluationCriteriaRouter = (0, express_1.Router)();
// GET /api/evaluation-criteria?itemId=xxx
exports.evaluationCriteriaRouter.get('/', async (req, res) => {
    const itemId = req.query.itemId;
    if (!itemId) {
        res.json([]);
        return;
    }
    const criteria = await db_1.prisma.evaluationCriteria.findMany({
        where: { itemId, deletedAt: null }, // NOVO
        orderBy: { order: 'asc' }
    });
    res.json(criteria);
});
exports.evaluationCriteriaRouter.post('/', async (req, res) => {
    const { itemId, label, maxPoints } = req.body;
    if (!itemId || !label || !label.trim()) {
        res.status(400).json({ error: 'itemId e label são obrigatórios.' });
        return;
    }
    const count = await db_1.prisma.evaluationCriteria.count({ where: { itemId, deletedAt: null } });
    const created = await db_1.prisma.evaluationCriteria.create({
        data: { itemId, label: label.trim(), maxPoints: Number(maxPoints) || 10, order: count }
    });
    res.json(created);
});
exports.evaluationCriteriaRouter.put('/:id', async (req, res) => {
    const { label, maxPoints } = req.body;
    const updated = await db_1.prisma.evaluationCriteria.update({
        where: { id: req.params.id },
        data: {
            ...(label !== undefined ? { label } : {}),
            ...(maxPoints !== undefined ? { maxPoints: Number(maxPoints) } : {})
        }
    });
    res.json(updated);
});
// CORRIGIDO - soft delete (ver nota em questions.ts)
exports.evaluationCriteriaRouter.delete('/:id', async (req, res) => {
    await db_1.prisma.evaluationCriteria.update({
        where: { id: req.params.id },
        data: { deletedAt: new Date() }
    });
    res.json({ success: true });
});
//# sourceMappingURL=evaluationCriteria.js.map