const fs = require("fs")
const filePath = "package.json"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `"version": "1.1.4",`
const count = content.split(anchor).length - 1
console.log("ancora versao: encontrada " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }
content = content.replace(anchor, `"version": "1.1.5",`)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: package.json atualizado para 1.1.5.")
