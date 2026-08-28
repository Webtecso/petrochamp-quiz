"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const networkInfo_1 = require("../services/networkInfo");
const router = (0, express_1.Router)();
// GET /api/network-info
// Devolve o IP da máquina na rede local e a URL completa do portal de jurados
router.get('/', (_req, res) => {
    const { ip, port } = (0, networkInfo_1.getNetworkInfo)();
    const portalUrl = ip ? `http://${ip}:${port}/portal/jurados.html` : null;
    res.json({ ip, port, portalUrl });
});
exports.default = router;
//# sourceMappingURL=networkInfo.js.map