const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `              <img
                :src="formatImageUrl(questionImage)"
                alt="Imagem Ilustrativa"
                class="max-w-full max-h-full w-auto h-auto object-contain object-center"
              />`

const count = content.split(anchor).length - 1
console.log("ancora [img da pergunta sem @load]: " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `              <img
                :src="formatImageUrl(questionImage)"
                alt="Imagem Ilustrativa"
                class="max-w-full max-h-full w-auto h-auto object-contain object-center"
                @load="scheduleQuestionFit"
                @error="scheduleQuestionFit"
              />`

content = content.replace(anchor, replacement)

fs.writeFileSync(filePath + ".bak-img-load-fit", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: imagem da pergunta agora recalcula o fit do texto quando termina de carregar (ou falha).")
