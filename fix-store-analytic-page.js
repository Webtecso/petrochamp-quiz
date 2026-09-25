const fs = require("fs")
const filePath = "src\\renderer\\src\\stores\\campeonato.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Interface
const ifaceAnchor = `  analyticEvaluation: AnalyticEvaluationState
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  awaitingJuryEvaluation: boolean`

const ifaceCount = content.split(ifaceAnchor).length - 1
console.log("ancora [interface]: " + ifaceCount + "x")
if (ifaceCount !== 1) { console.error("Abortado (interface)."); process.exit(1) }

const ifaceReplacement = `  analyticEvaluation: AnalyticEvaluationState
  currentItemSource: 'question' | 'analytic' | null
  currentAnalyticItemId: string | null
  currentItemMode: 'multipla_escolha' | 'aberta' | null
  // NOVO - pagina atual do enunciado analitico, paginado automaticamente
  analyticQuestionPage: number
  awaitingJuryEvaluation: boolean`

content = content.replace(ifaceAnchor, ifaceReplacement)

// 2. Valor inicial
const initAnchor = `    analyticEvaluation: defaultAnalyticEvaluation(),
    currentItemSource: null,
    currentAnalyticItemId: null,
    currentItemMode: null,
    awaitingJuryEvaluation: false,`

const initCount = content.split(initAnchor).length - 1
console.log("ancora [valor inicial]: " + initCount + "x")
if (initCount !== 1) { console.error("Abortado (valor inicial)."); process.exit(1) }

const initReplacement = `    analyticEvaluation: defaultAnalyticEvaluation(),
    currentItemSource: null,
    currentAnalyticItemId: null,
    currentItemMode: null,
    analyticQuestionPage: 1,
    awaitingJuryEvaluation: false,`

content = content.replace(initAnchor, initReplacement)

// 3. Actions novas, junto a submitThirdPlaceAnswer (ja confirmado no fluxo anterior)
const actionAnchor = `    submitThirdPlaceAnswer(team: 'A' | 'B', optionLabel: string) {
      getSocket().emit('thirdPlace:submitAnswer', { team, optionLabel })
    },`

const actionCount = content.split(actionAnchor).length - 1
console.log("ancora [actions]: " + actionCount + "x")
if (actionCount !== 1) { console.error("Abortado (actions)."); process.exit(1) }

const actionReplacement = `    submitThirdPlaceAnswer(team: 'A' | 'B', optionLabel: string) {
      getSocket().emit('thirdPlace:submitAnswer', { team, optionLabel })
    },
    analyticNextPage() {
      getSocket().emit('moderator:analyticNextPage')
    },
    analyticPrevPage() {
      getSocket().emit('moderator:analyticPrevPage')
    },`

content = content.replace(actionAnchor, actionReplacement)

fs.writeFileSync(filePath + ".bak-analytic-page", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: store atualizada com analyticQuestionPage + actions analyticNextPage/PrevPage.")
