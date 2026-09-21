const fs = require("fs")

const filePath = "src\\renderer\\index.html"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `content="default-src 'self' http://localhost:4000; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: http://localhost:4000 https://petrochamp-admin-cloud.onrender.com; connect-src 'self' http://localhost:4000 ws://localhost:4000 https://petrochamp-admin-cloud.onrender.com; frame-src 'self' http://localhost:4000; child-src 'self' http://localhost:4000;"`

const count = content.split(anchor).length - 1
console.log("ancora J1: encontrada " + count + "x")
if (count !== 1) {
  console.error("Abortado: ancora J1 nao encontrada exatamente 1x.")
  process.exit(1)
}

const replacement = `content="default-src 'self' http://localhost:4000; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: http://localhost:4000 https://petrochamp-admin-cloud.onrender.com; connect-src 'self' http://localhost:4000 ws://localhost:4000 https://petrochamp-admin-cloud.onrender.com https://fonts.googleapis.com https://fonts.gstatic.com; frame-src 'self' http://localhost:4000; child-src 'self' http://localhost:4000;"`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: index.html atualizado (CSP permite fontes do pptx-vue-viewer).")
