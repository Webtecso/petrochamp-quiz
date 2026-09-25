const fs = require("fs")

function patchFile(filePath, mountAnchor, scheduleFnName) {
  const raw = fs.readFileSync(filePath, "utf8")
  const hasCRLF = raw.includes("\r\n")
  let content = raw.replace(/\r\n/g, "\n")

  const count = content.split(mountAnchor).length - 1
  console.log(filePath + " -> ancora: " + count + "x")
  if (count !== 1) { console.error("Abortado: " + filePath); process.exit(1) }

  const replacement = mountAnchor + `

  // NOVO - a fonte Carlito e' custom (@font-face) e pode ainda nao estar
  // carregada quando o primeiro fit corre (sobretudo na 1a execucao apos
  // instalar, antes de qualquer cache de fontes do SO/Chromium). Se isso
  // acontecer, o texto e' medido com a fonte de fallback (mais estreita),
  // o fit calcula um tamanho maior do que cabe de verdade, e nunca mais
  // recalcula. Assim que as fontes ficam prontas, forcamos um novo fit.
  document.fonts?.ready?.then(() => {
    ${scheduleFnName}()
  })`

  content = content.replace(mountAnchor, replacement)

  fs.writeFileSync(filePath + ".bak-fontfit", raw, "utf8")
  if (hasCRLF) content = content.replace(/\n/g, "\r\n")
  fs.writeFileSync(filePath, content, "utf8")
  console.log("OK: " + filePath)
}

patchFile(
  "src\\renderer\\src\\components\\QuestionPanel.vue",
  `onMounted(() => {
  if (questionWrapperRef.value) {
    questionResizeObserver = new ResizeObserver(() => scheduleQuestionFit())
    questionResizeObserver.observe(questionWrapperRef.value)
  }
  scheduleQuestionFit()
})`,
  "scheduleQuestionFit"
)
