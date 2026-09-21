const fs = require("fs")

const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `watch(
  () => store.championship,
  async (newVal) => {
    if (!newVal) return
    await quizContent.fetchQuestions(newVal)
    await quizContent.fetchEvaluationItems(newVal)
    await quizContent.fetchTiebreakQuestions(newVal)
    await phasesStore.fetchPhases(newVal)
  }
)`

const count = content.split(anchor).length - 1
console.log("ancora M1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora M1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `watch(
  () => store.championship,
  async (newVal) => {
    if (!newVal) return
    await quizContent.fetchQuestions(newVal)
    await quizContent.fetchEvaluationItems(newVal)
    await quizContent.fetchTiebreakQuestions(newVal)
    await phasesStore.fetchPhases(newVal)
    await liveBracketStore.fetchBracket(newVal)
  }
)`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ProjecaoView.vue atualizado (chaveamento busca dados quando o campeonato chega, nao so quando a visibilidade muda).")
