const fs = require("fs")
const filePath = "src\\renderer\\src\\views\\ProjecaoView.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

// 1. Encolher o footer "Pergunta de resposta aberta..." quando o enunciado e longo
const footerAnchor = `                <p
                  v-else-if="isOpenAnalyticQuestion"
                  class="text-slate-500 font-semibold"
                  style="font-size: clamp(0.9rem, 1.4vw, 1.15rem); text-align: center;"
                >
                  Pergunta de resposta aberta - avaliação dos jurados em curso.
                </p>`

const footerCount = content.split(footerAnchor).length - 1
console.log("ancora [footer analitico]: " + footerCount + "x")
if (footerCount !== 1) { console.error("Abortado (footer)."); process.exit(1) }

const footerReplacement = `                <p
                  v-else-if="isOpenAnalyticQuestion"
                  class="text-slate-500 font-semibold shrink-0"
                  :style="questionTextLength > 400
                    ? 'font-size: clamp(0.65rem, 0.9vw, 0.8rem); text-align: center; margin-top: 0.25rem;'
                    : 'font-size: clamp(0.9rem, 1.4vw, 1.15rem); text-align: center;'"
                >
                  Pergunta de resposta aberta - avaliação dos jurados em curso.
                </p>`

content = content.replace(footerAnchor, footerReplacement)

// 2. Reduzir o badge do topo e o padding/gap da card quando o texto e longo e sem imagem
const paddingAnchor = `const questionCardPaddingClass = computed(() => {
  const len = questionTextLength.value
  if (len > 600) return 'p-5 md:p-6'
  if (len > 300) return 'p-6 md:p-8'
  return 'p-8 md:p-10'
})`

const paddingCount = content.split(paddingAnchor).length - 1
console.log("ancora [padding]: " + paddingCount + "x")
if (paddingCount !== 1) { console.error("Abortado (padding)."); process.exit(1) }

const paddingReplacement = `const questionCardPaddingClass = computed(() => {
  const len = questionTextLength.value
  if (len > 800) return 'p-3 md:p-4'
  if (len > 600) return 'p-5 md:p-6'
  if (len > 300) return 'p-6 md:p-8'
  return 'p-8 md:p-10'
})`

content = content.replace(paddingAnchor, paddingReplacement)

const gapAnchor = `const questionContentGapClass = computed(() => {
  const len = questionTextLength.value
  if (len > 500) return 'gap-4 md:gap-6'
  return 'gap-6 md:gap-8'
})`

const gapCount = content.split(gapAnchor).length - 1
console.log("ancora [gap]: " + gapCount + "x")
if (gapCount !== 1) { console.error("Abortado (gap)."); process.exit(1) }

const gapReplacement = `const questionContentGapClass = computed(() => {
  const len = questionTextLength.value
  if (len > 800) return 'gap-1 md:gap-2'
  if (len > 500) return 'gap-4 md:gap-6'
  return 'gap-6 md:gap-8'
})`

content = content.replace(gapAnchor, gapReplacement)

// 3. Encolher o badge do topo ("QUESTAO POR RESPONDER") quando o texto e muito longo
const badgeAnchor = `              <div
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold tracking-wide transition-all shrink-0"
                style="font-size: clamp(0.65rem, 1vw, 0.85rem)"
                :class="questionImage ? 'bg-amber-50 text-amber-700 border border-amber-200/60 self-start' : 'bg-slate-100 text-slate-600 self-center'"
              >`

const badgeCount = content.split(badgeAnchor).length - 1
console.log("ancora [badge]: " + badgeCount + "x")
if (badgeCount !== 1) { console.error("Abortado (badge)."); process.exit(1) }

const badgeReplacement = `              <div
                class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-bold tracking-wide transition-all shrink-0"
                :style="questionTextLength > 800
                  ? 'font-size: clamp(0.55rem, 0.75vw, 0.65rem); padding-top: 0.25rem; padding-bottom: 0.25rem;'
                  : 'font-size: clamp(0.65rem, 1vw, 0.85rem)'"
                :class="questionImage ? 'bg-amber-50 text-amber-700 border border-amber-200/60 self-start' : 'bg-slate-100 text-slate-600 self-center'"
              >`

content = content.replace(badgeAnchor, badgeReplacement)

fs.writeFileSync(filePath + ".bak-analytic-compact", raw, "utf8")
if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: espaco reservado pelo badge/footer/padding reduzido para textos longos, dando mais altura ao auto-fit do enunciado.")
