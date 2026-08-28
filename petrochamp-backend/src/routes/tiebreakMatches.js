"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const db_1 = require("../db");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    const championship = req.query.championship;
    const phase = req.query.phase ? Number(req.query.phase) : undefined;
    const matches = await db_1.prisma.tiebreakMatch.findMany({
        where: { championship, phase },
        orderBy: { createdAt: 'asc' }
    });
    res.json(matches);
});
exports.default = router;
//# sourceMappingURL=tiebreakMatches.js.map