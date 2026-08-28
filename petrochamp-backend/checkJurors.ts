import { prisma } from './src/db'
async function main() {
  const jurors = await prisma.juror.findMany({
    orderBy: { name: 'asc' }
  })
  console.log(JSON.stringify(jurors, null, 2))
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
