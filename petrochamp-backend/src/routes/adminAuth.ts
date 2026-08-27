import { Router } from 'express'
import bcrypt from 'bcryptjs'
import * as otplibModule from 'otplib'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'
import { prisma } from '../db'

// Resolução robusta de compatibilidade ESM/CJS para otplib + tsx
function getAuthenticator(): any {
  const m = otplibModule as any
  if (m.authenticator && typeof m.authenticator.generateSecret === 'function') {
    return m.authenticator
  }
  if (m.default?.authenticator && typeof m.default.authenticator.generateSecret === 'function') {
    return m.default.authenticator
  }
  if (m.default && typeof m.default.generateSecret === 'function') {
    return m.default
  }
  if (typeof m.generateSecret === 'function') {
    return m
  }
  if (m.Authenticator) {
    return new m.Authenticator()
  }
  if (m.default?.Authenticator) {
    return new m.default.Authenticator()
  }
  return m
}

function verifyTOTP(token: string, secret: string): boolean {
  const auth = getAuthenticator()
  try {
    if (typeof auth.verify === 'function') {
      return auth.verify({ token, secret })
    }
  } catch (_) {}
  if (typeof auth.check === 'function') {
    return auth.check(token, secret)
  }
  return false
}

const router = Router()
const SESSION_DAYS = 7

async function getAuth() {
  return prisma.adminAuth.findUnique({ where: { id: 1 } })
}

// Primeira configuração — só corre se ainda não existir password configurada.
router.post('/setup', async (req, res) => {
  const existing = await getAuth()
  if (existing) {
    res.status(400).json({ error: 'Já existe uma password configurada.' })
    return
  }
  const { password } = req.body as { password?: string }
  if (!password || password.length < 8) {
    res.status(400).json({ error: 'A password tem de ter pelo menos 8 caracteres.' })
    return
  }
  const passwordHash = await bcrypt.hash(password, 12)
  const auth = getAuthenticator()
  const totpSecret = auth.generateSecret()
  await prisma.adminAuth.create({ data: { id: 1, passwordHash, totpSecret, totpEnabled: false } })

  const keyuri =
    typeof auth.keyuri === 'function'
      ? auth.keyuri('Admin', 'Petrochamp', totpSecret)
      : `otpauth://totp/Petrochamp:Admin?secret=${totpSecret}&issuer=Petrochamp`

  const qrDataUrl = await QRCode.toDataURL(keyuri)
  res.status(201).json({ qrDataUrl, secret: totpSecret })
})

// Confirma o primeiro código TOTP e ativa definitivamente o 2FA.
router.post('/confirm-totp', async (req, res) => {
  const { token } = req.body as { token?: string }
  const auth = await getAuth()
  if (!auth?.totpSecret) {
    res.status(400).json({ error: 'Configuração não iniciada.' })
    return
  }
  const valid = verifyTOTP(token ?? '', auth.totpSecret)
  if (!valid) {
    res.status(400).json({ error: 'Código inválido.' })
    return
  }
  await prisma.adminAuth.update({ where: { id: 1 }, data: { totpEnabled: true } })
  res.json({ success: true })
})

router.post('/login', async (req, res) => {
  const { password, token } = req.body as { password?: string; token?: string }
  const auth = await getAuth()
  if (!auth || !auth.totpEnabled) {
    res.status(400).json({ error: 'Admin ainda não foi configurado.' })
    return
  }
  const passwordOk = await bcrypt.compare(password ?? '', auth.passwordHash)
  if (!passwordOk) {
    res.status(401).json({ error: 'Password incorreta.' })
    return
  }
  const totpOk = verifyTOTP(token ?? '', auth.totpSecret!)
  if (!totpOk) {
    res.status(401).json({ error: 'Código de autenticação inválido.' })
    return
  }
  const sessionToken = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.adminSession.create({ data: { token: sessionToken, expiresAt } })

  res.json({ token: sessionToken })
})

router.get('/status', async (_req, res) => {
  const auth = await getAuth()
  res.json({ configured: !!auth?.totpEnabled })
})

router.post('/logout', async (req, res) => {
  const { token } = req.body as { token?: string }
  if (token) await prisma.adminSession.delete({ where: { token } }).catch(() => {})
  res.json({ success: true })
})

export default router
