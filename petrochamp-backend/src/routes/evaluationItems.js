"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const configEvents_1 = require("../socket/configEvents");
const requireAdmin_1 = require("../middleware/requireAdmin");
const router = (0, express_1.Router)();
const LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
function buildOptionsData(mode, options) {
    const data = {};
    for (const label of LABELS) {
        if (mode !== 'multipla_escolha') {
            data[`option${label}`] = null;
            continue;
        }
        const found = options?.find((o) => o.label === label);
        data[`option${label}`] = found ? found.text : null;
    }
    return data;
}
router.get('/', async (req, res) => {
    const { championship, phase } = req.query;
    const items = await db_1.prisma.evaluationItem.findMany({
        where: {
            championship: championship || undefined,
            phase: phase ? Number(phase) : undefined,
            deletedAt: null // NOVO
        },
        include: { jurorAssignments: true },
        orderBy: { createdAt: 'asc' }
    });
    res.json(items.map((i) => ({
        ...i,
        correctIndexes: typeof i.correctIndexes === 'string'
            ? JSON.parse(i.correctIndexes || '[]')
            : i.correctIndexes || [],
        jurorIds: i.jurorAssignments.map((a) => a.jurorId),
        jurorAssignments: undefined
    })));
});
router.post('/', requireAdmin_1.requireAdmin, async (req, res) => {
    const { championship, type, mode, text, imageUrl, options, correctIndexes, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body;
    if (!championship || !type || !text || !maxPoints || !phase) {
        return res
            .status(400)
            .json({ error: 'championship, type, text, maxPoints e phase são obrigatórios' });
    }
    if (mode === 'multipla_escolha') {
        if (!Array.isArray(options) || options.length < 2 || options.length > 8) {
            return res
                .status(400)
                .json({ error: 'Perguntas de múltipla escolha precisam de entre 2 e 8 opções' });
        }
        if (!correctIndexes) {
            return res.status(400).json({ error: 'Seleciona pelo menos uma resposta correta' });
        }
    }
    const serializedCorrectIndexes = mode === 'multipla_escolha'
        ? typeof correctIndexes === 'string'
            ? correctIndexes
            : JSON.stringify(correctIndexes || [])
        : null;
    const item = await db_1.prisma.evaluationItem.create({
        data: {
            championship,
            type,
            mode: mode || 'aberta',
            text,
            imageUrl: imageUrl || null,
            ...buildOptionsData(mode, options),
            correctIndexes: serializedCorrectIndexes,
            timeSeconds: timeSeconds ? Number(timeSeconds) : 30,
            maxPoints: Number(maxPoints),
            phase: Number(phase),
            scope: scope || 'single',
            jurorAssignments: mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
                ? { create: jurorIds.map((jurorId) => ({ jurorId })) }
                : undefined
        },
        include: { jurorAssignments: true }
    });
    (0, configEvents_1.emitConfigUpdated)('evaluationItems', championship);
    res.status(201).json({
        ...item,
        correctIndexes: typeof item.correctIndexes === 'string'
            ? JSON.parse(item.correctIndexes || '[]')
            : item.correctIndexes || [],
        jurorIds: item.jurorAssignments.map((a) => a.jurorId)
    });
});
router.put('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    const { type, mode, text, imageUrl, options, correctIndexes, timeSeconds, maxPoints, phase, scope, jurorIds } = req.body;
    if (mode === 'multipla_escolha' &&
        (!Array.isArray(options) || options.length < 2 || options.length > 8)) {
        return res
            .status(400)
            .json({ error: 'Perguntas de múltipla escolha precisam de entre 2 e 8 opções' });
    }
    try {
        // Esta tabela de junção continua hard delete de propósito: é
        // recriada por inteiro a cada PUT do item, não é uma entidade que o
        // utilizador apaga diretamente através de um botão "remover" — não
        // precisa de soft delete nem de sincronizar como "apagado".
        await db_1.prisma.evaluationItemJuror.deleteMany({ where: { itemId: id } });
        const serializedCorrectIndexes = mode === 'multipla_escolha'
            ? typeof correctIndexes === 'string'
                ? correctIndexes
                : JSON.stringify(correctIndexes || [])
            : null;
        const item = await db_1.prisma.evaluationItem.update({
            where: { id },
            data: {
                type,
                mode,
                text,
                imageUrl: imageUrl || null,
                ...buildOptionsData(mode, options),
                correctIndexes: serializedCorrectIndexes,
                timeSeconds: timeSeconds ? Number(timeSeconds) : 30,
                maxPoints: Number(maxPoints),
                phase: Number(phase),
                scope,
                jurorAssignments: mode === 'aberta' && Array.isArray(jurorIds) && jurorIds.length
                    ? { create: jurorIds.map((jurorId) => ({ jurorId })) }
                    : undefined
            },
            include: { jurorAssignments: true }
        });
        (0, configEvents_1.emitConfigUpdated)('evaluationItems', item.championship);
        res.json({
            ...item,
            correctIndexes: typeof item.correctIndexes === 'string'
                ? JSON.parse(item.correctIndexes || '[]')
                : item.correctIndexes || [],
            jurorIds: item.jurorAssignments.map((a) => a.jurorId)
        });
    }
    catch (err) {
        console.error(err);
        res.status(404).json({ error: 'Item não encontrado ou erro na atualização' });
    }
});
// CORRIGIDO — soft delete (ver nota em questions.ts)
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    const { id } = req.params;
    try {
        const existing = await db_1.prisma.evaluationItem.update({
            where: { id },
            data: { deletedAt: new Date() }
        });
        (0, configEvents_1.emitConfigUpdated)('evaluationItems', existing.championship);
        res.status(204).send();
    }
    catch {
        res.status(404).json({ error: 'Item não encontrado' });
    }
});
exports.default = router;
//# sourceMappingURL=evaluationItems.js.map