const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `              :class="[
                questionContentGapClass,
                questionImage
                  ? (questionTextLength > 500 ? 'flex-[1.4] min-w-0' : 'flex-1 min-w-[40%]')
                  : 'w-full max-w-4xl items-center text-center'
              ]"`

const count = content.split(anchor).length - 1
console.log("ancora [largura do texto sem imagem]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `              :class="[
                questionContentGapClass,
                questionImage
                  ? (questionTextLength > 500 ? 'flex-[1.4] min-w-0' : 'flex-1 min-w-[40%]')
                  : questionTextLength > 300
                    ? 'w-full max-w-[92vw] items-center text-center'
                    : 'w-full max-w-4xl items-center text-center'
              ]"`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-analytic-width", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: perguntas longas sem imagem agora usam ate 92vw de largura, em vez de max-w-4xl fixo.")
