warning: in the working copy of 'petrochamp-backend/src/socket/index.ts', LF will be replaced by CRLF the next time Git touches it
[1mdiff --git a/petrochamp-backend/src/socket/index.ts b/petrochamp-backend/src/socket/index.ts[m
[1mindex 6eab786..e71e59f 100644[m
[1m--- a/petrochamp-backend/src/socket/index.ts[m
[1m+++ b/petrochamp-backend/src/socket/index.ts[m
[36m@@ -433,6 +433,50 @@[m [masync function pickSuspensePhrase(): Promise<string> {[m
     : 'Preparem-se - a próxima fase está prestes a começar...'[m
 }[m
 [m
[32m+[m[32masync function tryResolveBracketForPresentationPhase(phaseConfig: {[m
[32m+[m[32m  id: string[m
[32m+[m[32m  type: string[m
[32m+[m[32m  noElimination: boolean | null[m
[32m+[m[32m}): Promise<void> {[m
[32m+[m[32m  // Só se aplica a fases "apresentacao" isoladas COM eliminação.[m
[32m+[m[32m  // "apresentacao_quiz" e "apresentacao" com noElimination já têm os[m
[32m+[m[32m  // seus próprios fluxos (ponderação com o quiz / transporte de nota).[m
[32m+[m[32m  if (phaseConfig.type !== 'apresentacao' || phaseConfig.noElimination) return[m
[32m+[m[32m  if (!liveState.championship) return[m
[32m+[m
[32m+[m[32m  const duplas = await prisma.presentationDupla.findMany({[m
[32m+[m[32m    where: { phaseId: phaseConfig.id, deletedAt: null }[m
[32m+[m[32m  })[m
[32m+[m
[32m+[m[32m  for (const d of duplas) {[m
[32m+[m[32m    if (!d.teamBId) continue // apresentação individual, sem confronto a decidir[m
[32m+[m
[32m+[m[32m    const scoreA = liveState.phaseRankings.find((r) => r.teamId === d.teamAId)?.score[m
[32m+[m[32m    const scoreB = liveState.phaseRankings.find((r) => r.teamId === d.teamBId)?.score[m
[32m+[m[32m    if (scoreA === undefined || scoreB === undefined) continue // falta uma das equipas avaliar[m
[32m+[m
[32m+[m[32m    const alreadyResolved = await prisma.bracketMatch.findFirst({[m
[32m+[m[32m      where: {[m
[32m+[m[32m        championship: liveState.championship,[m
[32m+[m[32m        winnerId: { not: null },[m
[32m+[m[32m        OR: [[m
[32m+[m[32m          { teamAId: d.teamAId, teamBId: d.teamBId },[m
[32m+[m[32m          { teamAId: d.teamBId, teamBId: d.teamAId }[m
[32m+[m[32m        ][m
[32m+[m[32m      }[m
[32m+[m[32m    })[m
[32m+[m[32m    if (alreadyResolved) continue[m
[32m+[m
[32m+[m[32m    const winnerId = scoreA >= scoreB ? d.teamAId : d.teamBId[m
[32m+[m[32m    const loserId = winnerId === d.teamAId ? d.teamBId : d.teamAId[m
[32m+[m
[32m+[m[32m    await recordBracketResult(liveState.championship, d.teamAId, d.teamBId, winnerId)[m
[32m+[m[32m    if (!liveState.eliminatedTeamIds.includes(loserId)) {[m
[32m+[m[32m      liveState.eliminatedTeamIds.push(loserId)[m
[32m+[m[32m    }[m
[32m+[m[32m  }[m
[32m+[m[32m}[m
[32m+[m
 async function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {[m
   const flow = liveState.presentationFlow[m
   if (flow.stage !== 'concluded' || !flow.teamId) return[m
[36m@@ -530,10 +574,12 @@[m [masync function checkAllJurorsSubmitted(broadcast: () => void): Promise<void> {[m
       }[m
     }[m
   } else if (phaseConfig?.type === 'apresentacao') {[m
[31m-    // Apresentação isolada (com ou sem eliminação por ranking):[m
[31m-    // só notas — NÃO fecha BracketMatch do quiz[m
[32m+[m[32m    // Apresentação isolada COM eliminação: grava nota e, assim que[m
[32m+[m[32m    // ambas as equipas da mesma dupla tiverem nota, decide o vencedor[m
[32m+[m[32m    // e propaga para o BracketMatch (tal como o Quiz já faz).[m
     addToPhaseRanking(team, average)[m
     addToChampionshipRanking(team, average)[m
[32m+[m[32m    await tryResolveBracketForPresentationPhase(phaseConfig)[m
   } else {[m
     // Outros tipos legados: só ranking, sem tocar no bracket aqui[m
     addToPhaseRanking(team, average)[m
