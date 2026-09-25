const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ModeradorDashboard.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Import
const importAnchor = `import { buildEvaluationItemOptions } from '../data/evaluationItems'`
const importCount = content.split(importAnchor).length - 1
console.log("ancora [import]: " + importCount + "x")
if (importCount !== 1) { console.error("Abortado (import)."); process.exit(1) }
const importReplacement = `import { buildEvaluationItemOptions } from '../data/evaluationItems'
import { paginateText, ANALYTIC_PAGE_MAX_CHARS } from '../utils/paginateText'`
content = content.replace(importAnchor, importReplacement)

// 2. Computeds: paginas + texto a mostrar + indicador
const computedAnchor = `const isAnalyticActive = computed(() => store.currentItemSource === 'analytic')
const isAnalyticScopeAll = computed(() => currentAnalyticItem.value?.scope === 'all')`
const computedCount = content.split(computedAnchor).length - 1
console.log("ancora [computeds]: " + computedCount + "x")
if (computedCount !== 1) { console.error("Abortado (computeds)."); process.exit(1) }
const computedReplacement = `const isAnalyticActive = computed(() => store.currentItemSource === 'analytic')
const isAnalyticScopeAll = computed(() => currentAnalyticItem.value?.scope === 'all')

// NOVO - paginacao de enunciados analiticos longos, espelhando a Projecao.
const analyticQuestionPages = computed(() => {
  if (!isAnalyticActive.value) return null
  const text = currentAnalyticItem.value?.text
  if (!text) return null
  return paginateText(text, ANALYTIC_PAGE_MAX_CHARS)
})

const analyticTotalPages = computed(() => analyticQuestionPages.value?.length ?? 1)

const displayedActiveText = computed(() => {
  const pages = analyticQuestionPages.value
  if (!pages) return activeDisplay.value?.text ?? ''
  const idx = Math.min(store.analyticQuestionPage, pages.length) - 1
  return pages[Math.max(0, idx)] ?? ''
})

function analyticPrevPage(): void {
  store.analyticPrevPage()
}

function analyticNextPage(): void {
  store.analyticNextPage()
}`
content = content.replace(computedAnchor, computedReplacement)

// 3. Trocar :question-text no QuestionPanel do quiz/analitico normal
const qpAnchor = `        <QuestionPanel
          :question-text="activeDisplay.text"
          :options="activeDisplay.options"`
const qpCount = content.split(qpAnchor).length - 1
console.log("ancora [question-text]: " + qpCount + "x")
if (qpCount !== 1) { console.error("Abortado (question-text)."); process.exit(1) }
const qpReplacement = `        <QuestionPanel
          :question-text="displayedActiveText"
          :options="activeDisplay.options"`
content = content.replace(qpAnchor, qpReplacement)

// 4. Bloco de navegacao, logo apos o fecho do <main> do quiz/analitico normal
const mainCloseAnchor = `          :active="store.activeTeam === 'B' && !store.teamBAnswer"
        />
      </main>`
const mainCloseCount = content.split(mainCloseAnchor).length - 1
console.log("ancora [fecho main]: " + mainCloseCount + "x")
if (mainCloseCount !== 1) { console.error("Abortado (fecho main)."); process.exit(1) }
const mainCloseReplacement = `          :active="store.activeTeam === 'B' && !store.teamBAnswer"
        />
      </main>

      <div
        v-if="analyticQuestionPages && analyticTotalPages > 1"
        class="flex items-center justify-center gap-4 py-2"
      >
        <button
          class="bg-white border border-gray-300 text-gray-700 rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="store.analyticQuestionPage <= 1"
          @click="analyticPrevPage"
        >
          ← Anterior
        </button>
        <span class="text-xs font-semibold text-gray-500">
          Página {{ store.analyticQuestionPage }} / {{ analyticTotalPages }}
        </span>
        <button
          class="bg-petro-primary text-white rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="store.analyticQuestionPage >= analyticTotalPages"
          @click="analyticNextPage"
        >
          Seguinte →
        </button>
      </div>`
content = content.replace(mainCloseAnchor, mainCloseReplacement)

fs.writeFileSync(filePath + ".bak-analytic-moderador", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: ModeradorDashboard.vue - texto paginado + botoes de navegacao adicionados.")
