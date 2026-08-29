import { PrismaClient } from '@prisma/client'
import { copyFileSync, existsSync, statSync } from 'fs'
import path from 'path'

// Em desenvolvimento o backend é executado a partir de
// petrochamp-backend/. O pacote Electron define DATABASE_URL em produção,
// mas, localmente, usar esta base SQLite por omissão evita que o servidor
// arranque sem conseguir atender nenhuma rota quando ainda não existe .env.
if (!process.env.DATABASE_URL) {
  const prismaDir = path.join(__dirname, '..', 'prisma')
  const databasePath = path.join(prismaDir, 'petrochamp.db')
  const seedPath = path.join(prismaDir, 'seed.db')

  // A base seed faz parte do projeto e contém o schema inicial. Só a
  // copiamos quando a base de desenvolvimento ainda não existe ou está
  // vazia; uma base já criada pelo utilizador nunca é substituída.
  if (existsSync(seedPath) && (!existsSync(databasePath) || statSync(databasePath).size === 0)) {
    copyFileSync(seedPath, databasePath)
  }
  process.env.DATABASE_URL = 'file:./petrochamp.db'
}

export const prisma = new PrismaClient()
