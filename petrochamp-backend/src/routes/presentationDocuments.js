"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const promises_1 = __importDefault(require("fs/promises"));
const db_1 = require("../db");
const requireAdmin_1 = require("../middleware/requireAdmin");
const configEvents_1 = require("../socket/configEvents");
const router = (0, express_1.Router)();
const upload = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: { fileSize: 15 * 1024 * 1024, files: 80 },
    fileFilter: (_req, file, cb) => {
        if (file.mimetype !== 'image/png' && file.mimetype !== 'image/jpeg') {
            cb(new Error('Só são aceites imagens PNG ou JPEG (exportadas do PowerPoint como imagens).'));
            return;
        }
        cb(null, true);
    }
});
const UPLOADS_ROOT = path_1.default.join(__dirname, '..', '..', 'uploads', 'presentations');
function extractOrder(filename, fallbackIndex) {
    const match = filename.match(/(\d+)(?=\.[^.]*$)/);
    if (match)
        return Number(match[1]);
    return 100000 + fallbackIndex;
}
// GET /api/presentation-documents
router.get('/', async (req, res) => {
    try {
        const { phaseId, duplaId, teamId } = req.query;
        const where = { deletedAt: null }; // NOVO
        if (phaseId)
            where.phaseId = phaseId;
        if (duplaId)
            where.duplaId = duplaId;
        if (teamId)
            where.teamId = teamId;
        const docs = await db_1.prisma.presentationDocument.findMany({
            where,
            include: {
                slides: {
                    orderBy: { order: 'asc' }
                }
            }
        });
        return res.json(docs);
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Erro ao carregar os documentos.' });
    }
});
// POST /api/presentation-documents
router.post('/', requireAdmin_1.requireAdmin, upload.array('files'), async (req, res) => {
    try {
        const { duplaId, teamId } = req.body;
        const files = req.files;
        if (!duplaId || !teamId || !files || !files.length) {
            return res
                .status(400)
                .json({ error: 'duplaId, teamId e pelo menos uma imagem são obrigatórios.' });
        }
        const dupla = await db_1.prisma.presentationDupla.findUnique({ where: { id: duplaId } });
        if (!dupla || (dupla.teamAId !== teamId && dupla.teamBId !== teamId)) {
            return res.status(400).json({ error: 'Esta equipa não pertence a esta dupla.' });
        }
        const ordersRaw = req.body.orders;
        let explicitOrders = null;
        if (ordersRaw) {
            const arr = Array.isArray(ordersRaw) ? ordersRaw : [ordersRaw];
            if (arr.length === files.length) {
                explicitOrders = arr.map(Number);
            }
        }
        const indexed = files.map((file, i) => ({
            file,
            order: explicitOrders ? explicitOrders[i] : extractOrder(file.originalname, i)
        }));
        indexed.sort((a, b) => a.order - b.order);
        const folder = path_1.default.join(UPLOADS_ROOT, dupla.phaseId, teamId);
        await promises_1.default.mkdir(folder, { recursive: true });
        const existing = await db_1.prisma.presentationDocument.findUnique({
            where: { duplaId_teamId: { duplaId, teamId } },
            include: { slides: true }
        });
        if (existing) {
            // Ficheiros físicos: continuam a ser apagados do disco imediatamente
            // - isso é local a esta máquina, não precisa (nem faz sentido)
            // sincronizar entre admin local e admin cloud.
            for (const slide of existing.slides) {
                await promises_1.default.unlink(path_1.default.join(__dirname, '..', '..', slide.imageUrl)).catch(() => { });
            }
            await db_1.prisma.presentationSlide.deleteMany({ where: { documentId: existing.id } });
        }
        const doc = await db_1.prisma.presentationDocument.upsert({
            where: { duplaId_teamId: { duplaId, teamId } },
            update: { deletedAt: null },
            create: { phaseId: dupla.phaseId, duplaId, teamId }
        });
        let order = 1;
        for (const { file } of indexed) {
            const safeName = `${Date.now()}-${order}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
            await promises_1.default.writeFile(path_1.default.join(folder, safeName), file.buffer);
            const imageUrl = `/uploads/presentations/${dupla.phaseId}/${teamId}/${safeName}`;
            await db_1.prisma.presentationSlide.create({
                data: { documentId: doc.id, order, imageUrl }
            });
            order += 1;
        }
        const full = await db_1.prisma.presentationDocument.findUnique({
            where: { id: doc.id },
            include: { slides: { orderBy: { order: 'asc' } } }
        });
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.status(201).json(full);
    }
    catch (error) {
        return res.status(400).json({ error: error?.message || 'Falha ao enviar as imagens.' });
    }
});
// DELETE /api/presentation-documents/:id
// CORRIGIDO - soft delete no registo (ver nota em questions.ts); os
// ficheiros físicos das slides continuam a ser apagados do disco de
// imediato, já que isso é local e não passa pelo sync.
router.delete('/:id', requireAdmin_1.requireAdmin, async (req, res) => {
    try {
        const { id } = req.params;
        const doc = await db_1.prisma.presentationDocument.findUnique({
            where: { id },
            include: { slides: true }
        });
        if (!doc) {
            return res.status(404).json({ error: 'Documento não encontrado.' });
        }
        for (const slide of doc.slides) {
            await promises_1.default.unlink(path_1.default.join(__dirname, '..', '..', slide.imageUrl)).catch(() => { });
        }
        await db_1.prisma.presentationDocument.update({ where: { id }, data: { deletedAt: new Date() } });
        (0, configEvents_1.emitConfigUpdated)('presentation');
        return res.status(204).send();
    }
    catch (error) {
        return res.status(500).json({ error: error?.message || 'Erro ao eliminar o documento.' });
    }
});
exports.default = router;
//# sourceMappingURL=presentationDocuments.js.map