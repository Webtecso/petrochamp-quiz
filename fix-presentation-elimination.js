#!/usr/bin/env node
/**
 * Corrige: fase "apresentacao" COM eliminação (noElimination !== true)
 * nunca decidia vencedor nem gravava no BracketMatch, deixando o
 * chaveamento da ronda seguinte vazio e as duplas antigas por atualizar.
 *
 * Uso:
 *   node fix-presentation-elimination.js <caminho-backend>
 *
 * Exemplo:
 *   node fix-presentation-elimination.js C:\Users\LENOVO\petrochamp-quiz\petrochamp-backend
 */

const fs = require('fs')
const path = require('path')

const [, , backendRoot] = process.argv
if (!backendRoot) {
  console.error('Uso: node fix-presentation-elimination.js <caminho-backend>')
  process.exit(1)
}

const filePath = path.join(backendRoot, 'src', 'socket', 'index.ts')

if (!fs.existsSync(filePath)) {
  console.error(`✗ Ficheiro não encontrado: ${filePath}`)
  process.exit(1)
}

let content = fs.readFileSync(filePath, 'utf8')
const original = content

// ---------------------------------------------------------------------
// 1. Adicionar a função nova, logo antes de checkAllJurorsSubmitted
// ---------------------------------------------------------------------
const anchor1 = `async function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {`

const newFunction = `async function tryResolveBracketForPresentationPhase(phaseConfig: {
  id: string
  type: string
  noElimination: boolean | null
}): Promise<void> {
  // Só se aplica a fases "apresentacao" isoladas COM eliminação.
  // "apresentacao_quiz" e "apresentacao" com noElimination já têm os
  // seus próprios fluxos (ponderação com o quiz / transporte de nota).
  if (phaseConfig.type !== 'apresentacao' || phaseConfig.noElimination) return
  if (!liveState.championship) return

  const duplas = await prisma.presentationDupla.findMany({
    where: { phaseId: phaseConfig.id, deletedAt: null }
  })

  for (const d of duplas) {
    if (!d.teamBId) continue // apresentação individual, sem confronto a decidir

    const scoreA = liveState.phaseRankings.find((r) => r.teamId === d.teamAId)?.score
    const scoreB = liveState.phaseRankings.find((r) => r.teamId === d.teamBId)?.score
    if (scoreA === undefined || scoreB === undefined) continue // falta uma das equipas avaliar

    const alreadyResolved = await prisma.bracketMatch.findFirst({
      where: {
        championship: liveState.championship,
        winnerId: { not: null },
        OR: [
          { teamAId: d.teamAId, teamBId: d.teamBId },
          { teamAId: d.teamBId, teamBId: d.teamAId }
        ]
      }
    })
    if (alreadyResolved) continue

    const winnerId = scoreA >= scoreB ? d.teamAId : d.teamBId
    const loserId = winnerId === d.teamAId ? d.teamBId : d.teamAId

    await recordBracketResult(liveState.championship, d.teamAId, d.teamBId, winnerId)
    if (!liveState.eliminatedTeamIds.includes(loserId)) {
      liveState.eliminatedTeamIds.push(loserId)
    }
  }
}

async function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {`

const count1 = content.split(anchor1).length - 1
if (count1 !== 1) {
  console.error(`✗ Âncora 1 encontrada ${count1}x (esperava 1x). A abortar.`)
  process.exit(1)
}
content = content.replace(anchor1, newFunction)

// ---------------------------------------------------------------------
// 2. Chamar a nova função no ramo "apresentacao com eliminação"
// ---------------------------------------------------------------------
const anchor2 = `  } else if (phaseConfig?.type === 'apresentacao') {
    // Apresentação isolada (com ou sem eliminação por ranking):
    // só notas — NÃO fecha BracketMatch do quiz
    addToPhaseRanking(team, average)
    addToChampionshipRanking(team, average)
  } else {`

const replacement2 = `  } else if (phaseConfig?.type === 'apresentacao') {
    // Apresentação isolada COM eliminação: grava nota e, assim que
    // ambas as equipas da mesma dupla tiverem nota, decide o vencedor
    // e propaga para o BracketMatch (tal como o Quiz já faz).
    addToPhaseRanking(team, average)
    addToChampionshipRanking(team, average)
    await tryResolveBracketForPresentationPhase(phaseConfig)
  } else {`

const count2 = content.split(anchor2).length - 1
if (count2 !== 1) {
  console.error(`✗ Âncora 2 encontrada ${count2}x (esperava 1x). A abortar.`)
  process.exit(1)
}
content = content.replace(anchor2, replacement2)

if (content === original) {
  console.error('✗ Nenhuma alteração foi aplicada, algo está errado.')
  process.exit(1)
}

fs.writeFileSync(filePath, content, 'utf8')
console.log(`✓ ${filePath} atualizado.`)
console.log('\nRecomendo: git diff, depois npm run build (ou o teu comando de dev) para confirmar que compila.')
