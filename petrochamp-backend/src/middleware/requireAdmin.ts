import type { Request, Response, NextFunction } from 'express'
import { prisma } from '../db'

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) {
    res.status(401).json({ error: 'Sessão de Admin necessária.' })
    return
  }
  const session = await prisma.adminSession.findUnique({ where: { token } })
  if (!session || session.expiresAt < new Date()) {
    res.status(401).json({ error: 'Sessão expirada. Faz login novamente.' })
    return
  }
  next()
}
