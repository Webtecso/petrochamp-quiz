"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
function toApiShape(q) {
    const options = LABELS.map((label, i) => ({
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
        // mantém correctIndex singular para compatibilidade com quem ainda lê
        // só o primeiro índice correto (ex: correção de resposta única)
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
    const questions = await db_1.prisma.question.findMany({
        where: {
            championship: championship || undefined,
            phase: phase ? Number(phase) : undefined,
            deletedAt: null // NOVO - soft delete: nunca listar registos apagados
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
    try {
        const question = await db_1.prisma.question.create({
            data: {
                championship,
                text,
                imageUrl: imageUrl || null,
                ...buildOptionsData(options),
                correctIndexes: JSON.stringify(resolvedCorrectIndexes),
                points: Number(points) || 10,
                phase: Number(phase) || 1
            }
        });
        (0, configEvents_1.emitConfigUpdated)('questions', championship);
        res.status(201).json(toApiShape(question));
    }
    catch (error) {
        console.error('Erro detalhado ao criar pergunta no Prisma:', error);
        res.status(500).json({ error: error.message || 'Erro interno ao criar pergunta' });
    }
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
        const question = await db_1.prisma.question.update({
            where: { id },
            data: {
                text,
                imageUrl: imageUrl || null,
                ...buildOptionsData(options),
                correctIndexes: JSON.stringify(resolvedCorrectIndexes),
                points: Number(points) || 10,
                phase: Number(phase) || 1
            }
        });
        (0, configEvents_1.emitConfigUpdated)('questions', question.championship);
        res.json(toApiShape(question));
    }
    catch (error) {
        console.error('Erro detalhado ao atualizar pergunta:', error);
        res.status(500).json({ error: error.message || 'Erro interno' });
    }
});
// CORRIGIDO - hard delete trocado por soft delete (marca deletedAt em vez
// de apagar a linha da BD). O syncService compara updatedAt > lastSyncedAt
// para saber o que propagar entre o admin local e o admin cloud; uma linha
// fisicamente apagada desaparece de qualquer findMany e nunca é vista como
// "mudança" a sincronizar. Ao fazer update({ data: { deletedAt } }) em vez
// de delete(), o campo @updatedAt do Prisma é tocado automaticamente, o
// syncService apanha a alteração no próximo ciclo, e o pullModel do outro
// lado já sabe aplicar deletedAt corretamente (isso já estava certo).
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await db_1.prisma.question.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        (0, configEvents_1.emitConfigUpdated)('questions', existing.championship);
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Pergunta não encontrada' });
    }
});
exports.default = router;
//# sourceMappingURL=questions.js.map