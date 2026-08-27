import { prisma } from './src/db'
async function main() {
  const items = await prisma.evaluationItem.findMany({
    select: { id: true, mode: true, correctIndexes: true, phase: true, maxPoints: true }
  })
  console.log(JSON.stringify(items, null, 2))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
