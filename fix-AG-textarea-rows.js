const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\AdminEvaluationView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

const anchor = `        <textarea
          v-model="form.text"
          rows="2"
          placeholder="Enunciado da pergunta analítica"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        ></textarea>`

const count = content.split(anchor).length - 1
console.log("ancora AG1: encontrada " + count + "x")
if (count !== 1) { console.error("Abortado."); process.exit(1) }

const replacement = `        <textarea
          v-model="form.text"
          rows="6"
          placeholder="Enunciado da pergunta analítica (usa Enter para criar parágrafos - eles aparecem exatamente assim na Projeção)"
          class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        ></textarea>`

content = content.replace(anchor, replacement)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: AdminEvaluationView.vue - textarea maior, com aviso sobre paragrafos.")
