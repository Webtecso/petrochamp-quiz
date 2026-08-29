"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const partners = await db_1.prisma.partner.findMany({
        where: { deletedAt: null }, // NOVO
        orderBy: { order: 'asc' }
    });
    res.json(partners);
});
router.post('/', requireAdmin_1.requireAdmin, async (req, res) => {
    const { name, logoUrl, order } = req.body;
    if (!name || !logoUrl) {
        res.status(400).json({ error: 'name e logoUrl são obrigatórios' });
        return;
    }
    const partner = await db_1.prisma.partner.create({ data: { name, logoUrl, order: order ?? 0 } });
    (0, configEvents_1.emitConfigUpdated)('partners');
    res.status(201).json(partner);
});
router.put('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const { name, logoUrl, order } = req.body;
    try {
        const partner = await db_1.prisma.partner.update({ where: { id }, data: { name, logoUrl, order } });
        (0, configEvents_1.emitConfigUpdated)('partners');
        res.json(partner);
    }
    catch {
        res.status(404).json({ error: 'Parceiro não encontrado' });
    }
});
// CORRIGIDO - soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    try {
        await db_1.prisma.partner.update({ where: { id }, data: { deletedAt: new Date() } });
        (0, configEvents_1.emitConfigUpdated)('partners');
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Parceiro não encontrado' });
    }
});
exports.default = router;
//# sourceMappingURL=partners.js.map