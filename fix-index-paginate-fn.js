const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Reiniciar a pagina no momento em que uma nova pergunta analitica e sorteada
const drawAnchor = `    liveState.currentItemSource = 'analytic'
    liveState.currentItemMode = chosen.mode
    liveState.currentAnalyticItemId = chosen.id
    liveState.currentQuestionId = null
    liveState.usedAnalyticItemIds.push(chosen.id)`

const drawCount = content.split(drawAnchor).length - 1
console.log("ancora [sorteio analitico]: " + drawCount + "x")
if (drawCount !== 1) { console.error("Abortado (sorteio)."); process.exit(1) }

const drawReplacement = `    liveState.currentItemSource = 'analytic'
    liveState.currentItemMode = chosen.mode
    liveState.currentAnalyticItemId = chosen.id
    liveState.currentQuestionId = null
    liveState.analyticQuestionPage = 1
    liveState.usedAnalyticItemIds.push(chosen.id)`

content = content.replace(drawAnchor, drawReplacement)

// 2. Funcao paginateText + handlers novos, logo apos drawTiebreakQuestion (funcao ja conhecida)
const fnAnchor = `async function pickSuspensePhrase(): Promise<string> {`

const fnCount = content.split(fnAnchor).length - 1
console.log("ancora [funcao pickSuspensePhrase]: " + fnCount + "x")
if (fnCount !== 1) { console.error("Abortado (funcao)."); process.exit(1) }

const fnReplacement = `// NOVO - divide um enunciado longo em paginas legiveis para a Projecao,
// sem cortar a meio de uma palavra ou (sempre que possivel) a meio de uma
// frase. maxChars e um alvo, nao um limite rigido: a funcao so corta numa
// fronteira de frase/espaco proxima desse alvo.
function paginateText(text: string, maxChars: number): string[] {
  const trimmed = (text ?? '').trim()
  if (trimmed.length <= maxChars) return [trimmed]

  const pages: string[] = []
  let rest = trimmed

  while (rest.length > maxChars) {
    const slice = rest.slice(0, maxChars + 1)

    // Preferimos cortar depois de um fim de frase (. ; ! ?) dentro da fatia.
    let cutIndex = -1
    const sentenceEnders = ['. ', '; ', '! ', '? ', '.\n', ';\n']
    for (const ender of sentenceEnders) {
      const idx = slice.lastIndexOf(ender)
      if (idx > cutIndex) cutIndex = idx + ender.length
    }

    // Sem fronteira de frase razoavel: corta no ultimo espaco antes do alvo,
    // para nunca partir uma palavra a meio.
    if (cutIndex <= 0 || cutIndex < maxChars * 0.4) {
      const lastSpace = slice.lastIndexOf(' ')
      cutIndex = lastSpace > 0 ? lastSpace + 1 : maxChars
    }

    pages.push(rest.slice(0, cutIndex).trim())
    rest = rest.slice(cutIndex).trim()
  }

  if (rest.length > 0) pages.push(rest)
  return pages
}

async function pickSuspensePhrase(): Promise<string> {`

content = content.replace(fnAnchor, fnReplacement)

fs.writeFileSync(filePath + ".bak-analytic-pagination", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: reset de pagina no sorteio + funcao paginateText adicionados.")
