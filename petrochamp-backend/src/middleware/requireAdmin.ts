import { Request, Response, NextFunction } from 'express'

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization

  if (!authHeader) {
    console.warn(`[requireAdmin] Token não fornecido em ${req.method} ${req.originalUrl}`)
    return res.status(401).json({ error: 'Acesso negado. Token de administração não fornecido.' })
  }

  const token = authHeader.replace(/^Bearer\s+/i, '').trim()

  if (!token) {
    console.warn(`[requireAdmin] Token formato inválido em ${req.method} ${req.originalUrl}`)
    return res.status(401).json({ error: 'Acesso não autorizado. Sessão de administrador inválida.' })
  }

  next()
}
