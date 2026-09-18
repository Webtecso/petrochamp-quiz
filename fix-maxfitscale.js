const fs = require("fs")
const path = require("path")

const filePath = path.join(".", "src", "renderer", "src", "views", "ProjecaoView.vue")

const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")
const original = content

const anchor = `            :can-edit="false"
            :fit-padding="0"`

const replacement = `            :can-edit="false"
            :fit-padding="0"
            :max-fit-scale="null"`

const count = content.split(anchor).length - 1
console.log(`ancora: encontrada ${count}x`)
if (count !== 1) {
  console.error("Abortado: ancora nao encontrada exatamente 1x.")
  process.exit(1)
}
content = content.replace(anchor, replacement)

if (content === original) {
  console.error("Nenhuma alteracao foi aplicada.")
  process.exit(1)
}

if (hasCRLF) content = content.replace(/\n/g, "\r\n")

fs.writeFileSync(filePath, content, "utf8")
console.log(`OK: ${filePath} atualizado.`)
