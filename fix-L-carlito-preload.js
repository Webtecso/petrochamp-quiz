const fs = require("fs")

const filePath = "src\\renderer\\src\\main.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `import './assets/main.css'
import { createApp } from 'vue'`

const count = content.split(anchor).length - 1
console.log("ancora L1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora L1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `import './assets/main.css'
import { createApp } from 'vue'

void Promise.all([
  document.fonts.load('16px Carlito'),
  document.fonts.load('bold 16px Carlito'),
  document.fonts.load('italic 16px Carlito'),
  document.fonts.load('italic bold 16px Carlito')
]).catch(() => {})`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: main.ts atualizado.")
