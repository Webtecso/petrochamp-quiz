const fs = require("fs")

const filePath = "src\\renderer\\src\\stores\\campeonato.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `import { getSocket, onSocketRecreated, type Socket } from '../services/socket'`

const count = content.split(anchor).length - 1
console.log("ancora O1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora O1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `import { getSocket, onSocketRecreated } from '../services/socket'
import type { Socket } from 'socket.io-client'`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: campeonato.ts corrigido (import do tipo Socket).")
