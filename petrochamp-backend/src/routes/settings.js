"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
const DEFAULTS = {
    questionTimeSeconds: 30,
    maxJurors: 5,
    partnersDurationSeconds: 20
};
router.get('/', async (_req, res) => {
    const rows = await db_1.prisma.setting.findMany();
    const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    res.json({
        questionTimeSeconds: Number(map.questionTimeSeconds ?? DEFAULTS.questionTimeSeconds),
        maxJurors: Number(map.maxJurors ?? DEFAULTS.maxJurors),
        partnersDurationSeconds: Number(map.partnersDurationSeconds ?? DEFAULTS.partnersDurationSeconds)
    });
});
router.put('/', async (req, res) => {
    const { questionTimeSeconds, maxJurors, partnersDurationSeconds } = req.body;
    await db_1.prisma.setting.upsert({
        where: { key: 'questionTimeSeconds' },
        update: { value: String(questionTimeSeconds) },
        create: { key: 'questionTimeSeconds', value: String(questionTimeSeconds) }
    });
    await db_1.prisma.setting.upsert({
        where: { key: 'maxJurors' },
        update: { value: String(maxJurors) },
        create: { key: 'maxJurors', value: String(maxJurors) }
    });
    await db_1.prisma.setting.upsert({
        where: { key: 'partnersDurationSeconds' },
        update: { value: String(partnersDurationSeconds) },
        create: { key: 'partnersDurationSeconds', value: String(partnersDurationSeconds) }
    });
    res.json({ questionTimeSeconds, maxJurors, partnersDurationSeconds });
});
exports.default = router;
//# sourceMappingURL=settings.js.map