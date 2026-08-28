"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
// PresentationDupla não tem relações Prisma definidas para Team/Phase (só
// teamAId/teamBId/phaseId como texto simples) — por isso, em vez de
// include, buscamos as equipas à parte e juntamos manualmente.
async function attachTeams(duplas) {
    const teamIds = new Set();
    for (const d of duplas) {
        teamIds.add(d.teamAId);
        if (d.teamBId)
            teamIds.add(d.teamBId);
    }
    const teams = await db_1.prisma.team.findMany({ where: { id: { in: Array.from(teamIds) } } });
    const teamMap = new Map(teams.map((t) => [t.id, t]));
    return duplas.map((d) => ({
        ...d,
        teamA: teamMap.get(d.teamAId) ?? null,
        teamB: d.teamBId ? teamMap.get(d.teamBId) ?? null : null
    }));
}
// GET /api/presentation/duplas?phaseId=...&championship=...
router.get('/duplas', async (req, res) => {
    try {
        const { phaseId, championship } = req.query;
        let duplas = [];
        if (phaseId && phaseId !== 'undefined' && phaseId !== 'null') {
            duplas = await db_1.prisma.presentationDupla.findMany({
                where: { phaseId, deletedAt: null }, // CORRIGIDO — filtra apagados
                orderBy: { order: 'asc' }
            });
        }
        else if (championship && championship !== 'undefined' && championship !== 'null') {
            const phases = await db_1.prisma.phase.findMany({ where: { championship }, select: { id: true } });
            const phaseIds = phases.map((p) => p.id);
            duplas = await db_1.prisma.presentationDupla.findMany({
                where: { phaseId: { in: phaseIds }, deletedAt: null }, // CORRIGIDO — filtra apagados
                orderBy: { order: 'asc' }
            });
        }
        const shaped = await attachTeams(duplas);
        return res.json(shaped);
    }
    catch (error) {
        console.error('[Presentation Duplas GET Error]:', error);
        return res.status(500).json({ error: error?.message || 'Erro ao carregar as duplas.' });
    }
});
// POST /api/presentation/duplas
router.post('/duplas', requireAdmin_1.requireAdmin, async (_req, res) => {
    return res.status(400).json({
        error: 'As duplas são geradas automaticamente a partir do Chaveamento (Admin → Chaveamento → Gerar). Não é possível criar manualmente.'
    });
});
// PATCH /api/presentation/duplas/:id/theme
router.patch('/duplas/:id/theme', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { team, theme } = req.body;
    if (!team || !theme || !['A', 'B'].includes(team)) {
        return res.status(400).json({ error: 'team ("A" ou "B") e theme são obrigatórios.' });
    }
    try {
        const dataUpdate = team === 'A' ? { themeA: theme } : { themeB: theme };
        const dupla = await db_1.prisma.presentationDupla.update({ where: { id }, data: dataUpdate });
        const [shaped] = await attachTeams([dupla]);
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.json(shaped);
    }
    catch (error) {
        return res.status(404).json({ error: 'Dupla não encontrada.' });
    }
});
// DELETE /api/presentation/duplas/:id
// CORRIGIDO — antes usava prisma.presentationDupla.delete() (apagamento
// FÍSICO). O sistema de sincronização com o Cloud só consegue comunicar
// remoções através do campo deletedAt (soft delete) — um registo
// verdadeiramente apagado deixa de existir localmente, por isso nunca é
// "enviado" ao Cloud como apagado. No próximo ciclo de sync, o Cloud
// (que continua com o registo antigo, nunca avisado) via que o local já
// não o tem e recriava-o automaticamente — exatamente o bug "apaga e
// depois volta a aparecer".
router.delete('/duplas/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db_1.prisma.presentationDupla.update({ where: { id }, data: { deletedAt: new Date() } });
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.status(204).send();
    }
    catch (error) {
        return res.status(404).json({ error: 'Dupla não encontrada.' });
    }
});
// GET /api/presentation/criteria?phaseId=...
router.get('/criteria', async (req, res) => {
    try {
        const { phaseId } = req.query;
        if (!phaseId)
            return res.json([]);
        const criteria = await db_1.prisma.presentationCriteria.findMany({
            where: { phaseId, deletedAt: null }, // CORRIGIDO — filtra apagados
            orderBy: { id: 'asc' }
        });
        return res.json(criteria);
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Erro ao carregar os critérios.' });
    }
});
// POST /api/presentation/criteria
router.post('/criteria', requireAdmin_1.requireAdmin, async (req, res) => {
    try {
        const { phaseId, label, maxPoints } = req.body;
        if (!phaseId || !label || maxPoints === undefined || maxPoints === null) {
            return res.status(400).json({ error: 'phaseId, label e maxPoints são obrigatórios.' });
        }
        const points = Number(maxPoints);
        if (isNaN(points) || points <= 0) {
            return res.status(400).json({ error: 'maxPoints deve ser um número válido e maior que zero.' });
        }
        const criteria = await db_1.prisma.presentationCriteria.create({
            data: { phaseId, label, maxPoints: points }
        });
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.status(201).json(criteria);
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Erro ao criar o critério.' });
    }
});
// DELETE /api/presentation/criteria/:id
// CORRIGIDO — mesmo motivo do DELETE /duplas acima: apagamento físico
// impedia o sync de comunicar a remoção ao Cloud, fazendo o critério
// reaparecer no próximo ciclo de sincronização.
router.delete('/criteria/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        await db_1.prisma.presentationCriteria.update({ where: { id }, data: { deletedAt: new Date() } });
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.status(204).send();
    }
    catch (error) {
        return res.status(404).json({ error: 'Critério não encontrado.' });
    }
});
exports.default = router;
//# sourceMappingURL=presentation.js.map