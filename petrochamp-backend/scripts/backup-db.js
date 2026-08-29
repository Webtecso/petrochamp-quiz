// Faz uma cópia de segurança do ficheiro SQLite antes de qualquer
// migração. Corre sempre ANTES de 'prisma migrate dev' (ver script
// "migrate" no package.json) para garantir que, mesmo que a migração
// corra mal, exista sempre uma cópia recente da base de dados completa
// (incluindo a tabela AdminAuth com a password/TOTP configurados).
//
// Mantém as últimas 20 cópias e apaga as mais antigas automaticamente,
// para a pasta backups/ não crescer indefinidamente.

const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db')
const BACKUP_DIR = path.join(__dirname, '..', 'prisma', 'backups')
const MAX_BACKUPS = 20

function timestamp() {
  const now = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return (
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}` +
    `-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  )
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    console.log(`[backup-db] Nenhuma base de dados encontrada em ${DB_PATH} - nada para copiar (primeira execução?).`)
    return
  }

  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true })
  }

  const backupName = `dev.${timestamp()}.db`
  const backupPath = path.join(BACKUP_DIR, backupName)
  fs.copyFileSync(DB_PATH, backupPath)
  console.log(`[backup-db] Cópia de segurança criada: prisma/backups/${backupName}`)

  // Limpar backups antigos, mantendo só os MAX_BACKUPS mais recentes.
  const existing = fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('dev.') && f.endsWith('.db'))
    .sort() // o timestamp no nome garante ordem cronológica ao ordenar por string
  const excess = existing.length - MAX_BACKUPS
  if (excess > 0) {
    for (const f of existing.slice(0, excess)) {
      fs.unlinkSync(path.join(BACKUP_DIR, f))
      console.log(`[backup-db] Backup antigo removido: prisma/backups/${f}`)
    }
  }
}

main()
