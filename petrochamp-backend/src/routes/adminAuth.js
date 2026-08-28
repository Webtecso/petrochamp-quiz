"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const otplibModule = __importStar(require("otplib"));
const crypto_1 = require("crypto");
const qrcode_1 = __importDefault(require("qrcode"));
const db_1 = require("../db");
// Resolução robusta de compatibilidade ESM/CJS para otplib + tsx
function getAuthenticator() {
    const m = otplibModule;
    if (m.authenticator && typeof m.authenticator.generateSecret === 'function') {
        return m.authenticator;
    }
    if (m.default?.authenticator && typeof m.default.authenticator.generateSecret === 'function') {
        return m.default.authenticator;
    }
    if (m.default && typeof m.default.generateSecret === 'function') {
        return m.default;
    }
    if (typeof m.generateSecret === 'function') {
        return m;
    }
    if (m.Authenticator) {
        return new m.Authenticator();
    }
    if (m.default?.Authenticator) {
        return new m.default.Authenticator();
    }
    return m;
}
function verifyTOTP(token, secret) {
    const auth = getAuthenticator();
    try {
        if (typeof auth.verify === 'function') {
            return auth.verify({ token, secret });
        }
    }
    catch (_) { }
    if (typeof auth.check === 'function') {
        return auth.check(token, secret);
    }
    return false;
}
const router = (0, express_1.Router)();
const SESSION_DAYS = 7;
async function getAuth() {
    return db_1.prisma.adminAuth.findUnique({ where: { id: 1 } });
}
// Primeira configuração — só corre se ainda não existir password configurada.
router.post('/setup', async (req, res) => {
    const existing = await getAuth();
    if (existing) {
        res.status(400).json({ error: 'Já existe uma password configurada.' });
        return;
    }
    const { password } = req.body;
    if (!password || password.length < 8) {
        res.status(400).json({ error: 'A password tem de ter pelo menos 8 caracteres.' });
        return;
    }
    const passwordHash = await bcryptjs_1.default.hash(password, 12);
    const auth = getAuthenticator();
    const totpSecret = auth.generateSecret();
    await db_1.prisma.adminAuth.create({ data: { id: 1, passwordHash, totpSecret, totpEnabled: false } });
    const keyuri = typeof auth.keyuri === 'function'
        ? auth.keyuri('Admin', 'Petrochamp', totpSecret)
        : `otpauth://totp/Petrochamp:Admin?secret=${totpSecret}&issuer=Petrochamp`;
    const qrDataUrl = await qrcode_1.default.toDataURL(keyuri);
    res.status(201).json({ qrDataUrl, secret: totpSecret });
});
// Confirma o primeiro código TOTP e ativa definitivamente o 2FA.
router.post('/confirm-totp', async (req, res) => {
    const { token } = req.body;
    const auth = await getAuth();
    if (!auth?.totpSecret) {
        res.status(400).json({ error: 'Configuração não iniciada.' });
        return;
    }
    const valid = verifyTOTP(token ?? '', auth.totpSecret);
    if (!valid) {
        res.status(400).json({ error: 'Código inválido.' });
        return;
    }
    await db_1.prisma.adminAuth.update({ where: { id: 1 }, data: { totpEnabled: true } });
    res.json({ success: true });
});
router.post('/login', async (req, res) => {
    const { password, token } = req.body;
    const auth = await getAuth();
    if (!auth || !auth.totpEnabled) {
        res.status(400).json({ error: 'Admin ainda não foi configurado.' });
        return;
    }
    const passwordOk = await bcryptjs_1.default.compare(password ?? '', auth.passwordHash);
    if (!passwordOk) {
        res.status(401).json({ error: 'Password incorreta.' });
        return;
    }
    const totpOk = verifyTOTP(token ?? '', auth.totpSecret);
    if (!totpOk) {
        res.status(401).json({ error: 'Código de autenticação inválido.' });
        return;
    }
    const sessionToken = (0, crypto_1.randomUUID)();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    await db_1.prisma.adminSession.create({ data: { token: sessionToken, expiresAt } });
    res.json({ token: sessionToken });
});
router.get('/status', async (_req, res) => {
    const auth = await getAuth();
    res.json({ configured: !!auth?.totpEnabled });
});
router.post('/logout', async (req, res) => {
    const { token } = req.body;
    if (token)
        await db_1.prisma.adminSession.delete({ where: { token } }).catch(() => { });
    res.json({ success: true });
});
exports.default = router;
//# sourceMappingURL=adminAuth.js.map