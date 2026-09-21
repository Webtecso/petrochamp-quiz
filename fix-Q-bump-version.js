const fs = require("fs")

const filePath = "package.json"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `"version": "1.0.0",`

const count = content.split(anchor).length - 1
console.log("ancora Q1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora Q1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `"version": "1.1.0",`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: package.json atualizado.")
