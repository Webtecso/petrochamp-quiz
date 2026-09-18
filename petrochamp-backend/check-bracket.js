// Uso: node check-bracket.js
// (correr dentro da pasta petrochamp-backend)
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function main() {
  const matches = await prisma.bracketMatch.findMany({
    where: { round: 1 },
    orderBy: [{ championship: 'asc' }, { slot: 'asc' }]
  })

  if (matches.length === 0) {
    console.log('Nenhum BracketMatch encontrado na Ronda 1 (tabela vazia).')
    return
  }

  for (const m of matches) {
    console.log(
      `[${m.championship}] slot=${m.slot} teamAId=${m.teamAId ?? 'null'} teamBId=${m.teamBId ?? 'null'} winnerId=${m.winnerId ?? 'null'}`
    )
  }
}

main()
  .catch((e) => console.error(e))
  .finally(() => prisma.$disconnect())
