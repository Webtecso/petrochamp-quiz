"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
router.get('/', async (_req, res) => {
    const teams = await db_1.prisma.team.findMany({
        where: { deletedAt: null }, // NOVO
        orderBy: { createdAt: 'asc' }
    });
    res.json(teams);
});
router.post('/', requireAdmin_1.requireAdmin, async (req, res) => {
    const { name, institution, category, logoUrl, group, bracketPosition } = req.body;
    if (!name || !institution || !category) {
        return res.status(400).json({ error: 'name, institution e category são obrigatórios' });
    }
    const team = await db_1.prisma.team.create({
        data: {
            name,
            institution,
            category,
            logoUrl: logoUrl || null,
            group: group || null,
            bracketPosition: bracketPosition ?? null
        }
    });
    (0, configEvents_1.emitConfigUpdated)('teams', category);
    res.status(201).json(team);
});
router.put('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { name, institution, category, logoUrl, group, bracketPosition } = req.body;
    try {
        const team = await db_1.prisma.team.update({
            where: { id },
            data: {
                name,
                institution,
                category,
                logoUrl: logoUrl || null,
                group: group || null,
                bracketPosition: bracketPosition ?? null
            }
        });
        (0, configEvents_1.emitConfigUpdated)('teams', category);
        res.json(team);
    }
    catch {
        res.status(404).json({ error: 'Equipa não encontrada' });
    }
});
// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await db_1.prisma.team.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        (0, configEvents_1.emitConfigUpdated)('teams', existing.category);
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Equipa não encontrada' });
    }
});
exports.default = router;
//# sourceMappingURL=teams.js.map