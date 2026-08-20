import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { generateSecret, generateURI, verify } from 'otplib'
import { randomUUID } from 'crypto'
import QRCode from 'qrcode'
import { prisma } from '../db'
import { liveState } from '../socket/liveState'
import { broadcastLiveState } from '../socket/configEvents'

const router = Router()
const SESSION_DAYS = 7

async function getAuth() {
  return prisma.adminAuth.findUnique({ where: { id: 1 } })
}

function isRemoteRequest(req: import('express').Request): boolean {
  const host = req.get('host') ?? ''
  return !host.startsWith('localhost') && !host.startsWith('127.0.0.1')
}

// Primeira configuração — só corre se ainda não existir password nenhuma.
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
  const totpSecret = generateSecret()
  await prisma.adminAuth.create({ data: { id: 1, passwordHash, totpSecret, totpEnabled: false } })

  const otpauth = generateURI({ strategy: 'totp', issuer: 'Petrochamp', label: 'Admin', secret: totpSecret })
  const qrDataUrl = await QRCode.toDataURL(otpauth)
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
  const valid = await verify({ secret: auth.totpSecret, token: token ?? '' })
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
  const totpOk = await verify({ secret: auth.totpSecret!, token: token ?? '' })
  if (!totpOk) {
    res.status(401).json({ error: 'Código de autenticação inválido.' })
    return
  }
  const sessionToken = randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)
  await prisma.adminSession.create({ data: { token: sessionToken, expiresAt } })

  // Assim que alguém entra no Admin vindo de fora (pelo túnel), o banner
  // no Moderador deve desaparecer — mas só entra logins locais nunca contam.
  if (isRemoteRequest(req) && !liveState.adminAccessedRemotely) {
    liveState.adminAccessedRemotely = true
    broadcastLiveState()
  }

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
