"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
function toApiShape(q) {
    const options = LABELS.map((label) => ({
        label,
        text: q[`option${label}`]
    })).filter((o) => o.text !== null && o.text !== undefined);
    let correctIndexes = [];
    try {
        correctIndexes = q.correctIndexes ? JSON.parse(q.correctIndexes) : [];
    }
    catch {
        correctIndexes = [];
    }
    return {
        id: q.id,
        championship: q.championship,
        text: q.text,
        imageUrl: q.imageUrl ?? undefined,
        correctIndexes,
        correctIndex: correctIndexes[0] ?? 0,
        points: q.points,
        phase: q.phase,
        options
    };
}
function buildOptionsData(options) {
    const data = {};
    for (const label of LABELS) {
        const found = options.find((o) => o.label === label);
        data[`option${label}`] = found ? found.text : null;
    }
    return data;
}
router.get('/', async (req, res) => {
    const { championship, phase } = req.query;
    const questions = await db_1.prisma.tiebreakQuestion.findMany({
        where: {
            championship: championship || undefined,
            phase: phase ? Number(phase) : undefined,
            deletedAt: null // NOVO
        },
        orderBy: { id: 'asc' }
    });
    res.json(questions.map(toApiShape));
});
router.post('/', requireAdmin_1.requireAdmin, async (req, res) => {
    const { championship, text, imageUrl, options, correctIndexes, correctIndex, points, phase } = req.body;
    if (!text ||
        !championship ||
        !Array.isArray(options) ||
        options.length < 2 ||
        options.length > 8) {
        return res
            .status(400)
            .json({ error: 'championship, text e entre 2 e 8 options são obrigatórios' });
    }
    const resolvedCorrectIndexes = Array.isArray(correctIndexes)
        ? correctIndexes
        : correctIndex !== undefined
            ? [Number(correctIndex)]
            : [];
    const question = await db_1.prisma.tiebreakQuestion.create({
        data: {
            championship,
            text,
            imageUrl: imageUrl || null,
            ...buildOptionsData(options),
            correctIndexes: JSON.stringify(resolvedCorrectIndexes),
            points,
            phase
        }
    });
    (0, configEvents_1.emitConfigUpdated)('tiebreakQuestions', championship);
    res.status(201).json(toApiShape(question));
});
router.put('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { text, imageUrl, options, correctIndexes, correctIndex, points, phase } = req.body;
    if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
        return res.status(400).json({ error: 'options deve ter entre 2 e 8 itens' });
    }
    const resolvedCorrectIndexes = Array.isArray(correctIndexes)
        ? correctIndexes
        : correctIndex !== undefined
            ? [Number(correctIndex)]
            : [];
    try {
        const question = await db_1.prisma.tiebreakQuestion.update({
            where: { id },
            data: {
                text,
                imageUrl: imageUrl || null,
                ...buildOptionsData(options),
                correctIndexes: JSON.stringify(resolvedCorrectIndexes),
                points,
                phase
            }
        });
        (0, configEvents_1.emitConfigUpdated)('tiebreakQuestions', question.championship);
        res.json(toApiShape(question));
    }
    catch {
        res.status(404).json({ error: 'Pergunta não encontrada' });
    }
});
// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await db_1.prisma.tiebreakQuestion.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        (0, configEvents_1.emitConfigUpdated)('tiebreakQuestions', existing.championship);
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Pergunta não encontrada' });
    }
});
exports.default = router;
//# sourceMappingURL=tiebreakQuestions.js.map