"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const phrases = await db_1.prisma.suspensePhrase.findMany({
        where: { deletedAt: null }, // NOVO
        orderBy: { createdAt: 'asc' }
    });
    res.json(phrases);
});
router.post('/', requireAdmin_1.requireAdmin, async (req, res) => {
    const { text } = req.body;
    if (!text) {
        res.status(400).json({ error: 'text é obrigatório' });
        return;
    }
    const phrase = await db_1.prisma.suspensePhrase.create({ data: { text } });
    (0, configEvents_1.emitConfigUpdated)('suspensePhrases');
    res.status(201).json(phrase);
});
// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.suspensePhrase.update({ where: { id }, data: { deletedAt: new Date() } });
        (0, configEvents_1.emitConfigUpdated)('suspensePhrases');
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Frase não encontrada' });
    }
});
exports.default = router;
//# sourceMappingURL=suspensePhrases.js.map