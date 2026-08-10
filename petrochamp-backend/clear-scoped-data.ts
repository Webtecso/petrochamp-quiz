import { prisma } from './src/db'

async function main(): Promise<void> {
  await prisma.question.deleteMany()
  await prisma.tiebreakQuestion.deleteMany()
  await prisma.phase.deleteMany()
  console.log('Perguntas, perguntas de desempate e fases limpas.')
}

main().then(() => process.exit(0))
