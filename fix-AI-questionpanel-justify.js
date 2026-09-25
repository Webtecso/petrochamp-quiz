const fs = require("fs")
const filePath = "src\\renderer\\src\\components\\QuestionPanel.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `      <h2
        ref="questionTextRef"
        class="font-semibold break-words [overflow-wrap:anywhere] whitespace-normal"
        :class="imageUrl ? 'text-left' : 'text-center'"`

const count = content.split(anchor).length - 1
console.log("ancora AI1: encontrada " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `      <h2
        ref="questionTextRef"
        class="font-semibold break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-justify"
        :class="imageUrl ? '' : 'text-center'"`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: QuestionPanel.vue - texto agora preserva quebras de linha e fica justificado.")
