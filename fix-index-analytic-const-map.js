const fs = require("fs")
const filePath = "petrochamp-backend\\src\\socket\\index.ts"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Constante ANALYTIC_PAGE_MAX_CHARS, logo antes da funcao paginateText
const constAnchor = `// NOVO - divide um enunciado longo em paginas legiveis para a Projecao,`

const constCount = content.split(constAnchor).length - 1
console.log("ancora [comentario paginateText]: " + constCount + "x")
if (constCount !== 1) { console.error("Abortado (const)."); process.exit(1) }

const constReplacement = `// NOVO - alvo de caracteres por pagina de um enunciado analitico. Calibrado
// para a card da Projecao/Moderador manter uma fonte confortavel sem scroll.
const ANALYTIC_PAGE_MAX_CHARS = 420

// NOVO - divide um enunciado longo em paginas legiveis para a Projecao,`

content = content.replace(constAnchor, constReplacement)

// 2. Registar os dois eventos novos no mapa de areas, junto a endOpenQuestion (fase 'quiz')
const mapAnchor = `  'moderator:endOpenQuestion': 'quiz',`

const mapCount = content.split(mapAnchor).length - 1
console.log("ancora [mapa de areas]: " + mapCount + "x")
if (mapCount !== 1) { console.error("Abortado (mapa)."); process.exit(1) }

const mapReplacement = `  'moderator:endOpenQuestion': 'quiz',
  'moderator:analyticNextPage': 'quiz',
  'moderator:analyticPrevPage': 'quiz',`

content = content.replace(mapAnchor, mapReplacement)

fs.writeFileSync(filePath + ".bak-analytic-const-map", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ANALYTIC_PAGE_MAX_CHARS declarada e eventos registados no mapa de areas.")
