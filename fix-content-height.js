const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `              questionImage
                  ? (questionTextLength > 500
                    ? 'flex-col xl:flex-row xl:items-stretch'
                    : 'flex-col lg:flex-row lg:items-stretch')
                : 'flex-col items-center justify-center py-4 md:py-8'`

const count = content.split(anchor).length - 1
console.log("ancora [container de conteudo]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `              questionImage
                  ? (questionTextLength > 500
                    ? 'flex-col xl:flex-row xl:items-stretch h-full'
                    : 'flex-col lg:flex-row lg:items-stretch h-full')
                : 'flex-col items-center justify-center py-4 md:py-8 h-full'`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-content-height", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: container de conteudo agora preenche a altura da card (h-full), permitindo ao questionWrapperRef (flex-1) crescer de verdade.")
