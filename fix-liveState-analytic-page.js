const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\liveState.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Campo na interface (junto a currentAnalyticItemId, que deve estar perto de currentItemSource)
const ifaceAnchor = `  presentationPhaseScores: [],
  carriedPresentationScores: [],`

const ifaceCount = content.split(ifaceAnchor).length - 1
console.log("ancora [valores por omissao]: " + ifaceCount + "x")
if (ifaceCount !== 1) { console.error("Abortado (valores)."); process.exit(1) }

// Vamos inserir o campo no state inicial aqui (fica junto a outros campos globais)
const ifaceReplacement = `  // NOVO - pagina atual do enunciado de uma pergunta analitica longa,
  // paginado automaticamente na Projecao para manter o texto legivel sem
  // scroll. Reiniciado a 1 sempre que uma nova pergunta analitica e sorteada.
  analyticQuestionPage: 1,

  presentationPhaseScores: [],
  carriedPresentationScores: [],`

content = content.replace(ifaceAnchor, ifaceReplacement)

fs.writeFileSync(filePath + ".bak-analytic-page", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: liveState.ts - campo analyticQuestionPage adicionado ao state inicial.")
