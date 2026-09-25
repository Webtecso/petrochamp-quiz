const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\liveState.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `  currentQuestionId: string | null
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  activeTeam: 'A' | 'B'`

const count = content.split(anchor).length - 1
console.log("ancora [interface]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `  currentQuestionId: string | null
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  // NOVO - pagina atual do enunciado analitico (ver comentario no state inicial)
  analyticQuestionPage: number
  activeTeam: 'A' | 'B'`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-analytic-page-iface", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: interface LiveState atualizada com analyticQuestionPage.")
