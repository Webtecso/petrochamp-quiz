const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Import
const importAnchor = `import AnswerOptions from '../components/AnswerOptions.vue'`
const importCount = content.split(importAnchor).length - 1
console.log("ancora [import]: " + importCount + "x")
if (importCount !== 1) { console.error("Abortado (import)."); process.exit(1) }
const importReplacement = `import AnswerOptions from '../components/AnswerOptions.vue'
import { paginateText, ANALYTIC_PAGE_MAX_CHARS } from '../utils/paginateText'`
content = content.replace(importAnchor, importReplacement)

// 2. Computeds: paginas do enunciado analitico + texto/indicador a mostrar
const computedAnchor = `const isOpenAnalyticQuestion = computed(
  () => store.currentItemSource === 'analytic' && currentAnalyticItem.value?.mode === 'aberta'
)`
const computedCount = content.split(computedAnchor).length - 1
console.log("ancora [computeds]: " + computedCount + "x")
if (computedCount !== 1) { console.error("Abortado (computeds)."); process.exit(1) }
const computedReplacement = `const isOpenAnalyticQuestion = computed(
  () => store.currentItemSource === 'analytic' && currentAnalyticItem.value?.mode === 'aberta'
)

// NOVO - paginacao de enunciados analiticos longos. So se aplica a perguntas
// analiticas (currentItemSource === 'analytic'); o quiz normal continua a
// usar o texto completo com auto-fit, tal como antes.
const analyticQuestionPages = computed(() => {
  if (store.currentItemSource !== 'analytic') return null
  const text = currentAnalyticItem.value?.text
  if (!text) return null
  return paginateText(text, ANALYTIC_PAGE_MAX_CHARS)
})

const displayedQuestionText = computed(() => {
  const pages = analyticQuestionPages.value
  if (!pages) return currentQuestion.value?.text ?? ''
  const idx = Math.min(store.analyticQuestionPage, pages.length) - 1
  return pages[Math.max(0, idx)] ?? ''
})

const analyticTotalPages = computed(() => analyticQuestionPages.value?.length ?? 1)`
content = content.replace(computedAnchor, computedReplacement)

// 3. Trocar a interpolacao do texto pelo computed novo
const h1Anchor = `                  {{ currentQuestion?.text }}
                </h1>
              </div>`
const h1Count = content.split(h1Anchor).length - 1
console.log("ancora [h1]: " + h1Count + "x")
if (h1Count !== 1) { console.error("Abortado (h1)."); process.exit(1) }
const h1Replacement = `                  {{ displayedQuestionText }}
                </h1>
              </div>

              <div
                v-if="analyticQuestionPages && analyticTotalPages > 1"
                class="w-full flex items-center justify-center gap-2 mt-1 shrink-0"
              >
                <span
                  class="text-slate-400 font-semibold tracking-wide"
                  style="font-size: clamp(0.6rem, 0.85vw, 0.75rem)"
                >
                  Página {{ store.analyticQuestionPage }} / {{ analyticTotalPages }}
                </span>
              </div>`
content = content.replace(h1Anchor, h1Replacement)

fs.writeFileSync(filePath + ".bak-analytic-projecao", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ProjecaoView.vue - texto paginado + indicador de pagina adicionados.")
