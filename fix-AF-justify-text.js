const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `                <h1
                  ref="questionTextRef"
                  class="font-extrabold text-slate-800 leading-snug break-words [overflow-wrap:anywhere] whitespace-normal"
                  :class="questionImage ? 'text-left' : 'text-center'"`

const count = content.split(anchor).length - 1
console.log("ancora AF1: encontrada " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `                <h1
                  ref="questionTextRef"
                  class="font-extrabold text-slate-800 leading-snug break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-justify"
                  :class="questionImage ? '' : 'text-center'"`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ProjecaoView.vue - texto agora preserva quebras de linha e fica justificado.")
