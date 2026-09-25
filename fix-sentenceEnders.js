const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// A string partida ocupa exatamente estas 3 linhas (confirmadas pelo Select-String)
const brokenAnchor = "    const sentenceEnders = ['. ', '; ', '! ', '? ', '.\n', ';\n']"

const count = content.split(brokenAnchor).length - 1
console.log("ancora [linha partida]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const fixed = "    const sentenceEnders = ['. ', '; ', '! ', '? ']"

content = content.replace(brokenAnchor, fixed)

fs.writeFileSync(filePath + ".bak-fix-sentenceEnders", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: sentenceEnders corrigido (string partida por \\n literal).")
