const fs = require("fs")

const filePath = "src\\renderer\\src\\components\\QuestionPanel.vue"
const raw = fs.readFileSync(filePath, "utf8")
const hasCRLF = raw.includes("\r\n")
let content = raw.replace(/\r\n/g, "\n")

function applyAnchor(label, anchor, replacement) {
  const count = content.split(anchor).length - 1
  console.log(label + ": encontrada " + count + "x")
  if (count !== 1) {
    console.error("Abortado: " + label + " nao encontrada exatamente 1x.")
    process.exit(1)
  }
  content = content.replace(anchor, replacement)
}

applyAnchor(
  "ancora P1",
  `import { computed } from 'vue'`,
  `import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'`
)

applyAnchor(
  "ancora P2",
  `const questionTextSizeClass = computed(() => {
  const len = textLen.value
  if (len > 900) {
    return hasImage.value
      ? 'text-xs sm:text-xs md:text-sm leading-snug'
      : 'text-xs sm:text-sm md:text-base leading-snug'
  }
  if (len > 600) {
    return hasImage.value
      ? 'text-xs sm:text-sm md:text-sm lg:text-base leading-snug'
      : 'text-sm sm:text-sm md:text-base leading-snug'
  }
  if (len > 400) {
    return hasImage.value
      ? 'text-sm sm:text-sm md:text-base leading-snug'
      : 'text-sm sm:text-base md:text-lg leading-snug'
  }
  if (len > 250) {
    return hasImage.value
      ? 'text-sm sm:text-base md:text-base lg:text-lg leading-snug'
      : 'text-sm sm:text-base md:text-lg leading-snug'
  }
  return hasImage.value
    ? 'text-base sm:text-lg md:text-lg leading-snug'
    : 'text-base sm:text-lg md:text-xl leading-snug'
})`,
  `const questionWrapperRef = ref<HTMLElement | null>(null)
const questionTextRef = ref<HTMLElement | null>(null)
const fittedQuestionFontSize = ref(20)

const MAX_QUESTION_FONT = 32
const MIN_QUESTION_FONT = 10

function fitQuestionText(): void {
  const wrapper = questionWrapperRef.value
  const textEl = questionTextRef.value
  if (!wrapper || !textEl) return

  let lo = MIN_QUESTION_FONT
  let hi = MAX_QUESTION_FONT

  const fitsAt = (size: number): boolean => {
    textEl.style.fontSize = \`\${size}px\`
    return textEl.scrollHeight <= wrapper.clientHeight + 1 && textEl.scrollWidth <= wrapper.clientWidth + 1
  }

  if (fitsAt(hi)) {
    fittedQuestionFontSize.value = hi
    return
  }

  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2
    if (fitsAt(mid)) lo = mid
    else hi = mid
  }

  fittedQuestionFontSize.value = Math.floor(lo)
  textEl.style.fontSize = \`\${fittedQuestionFontSize.value}px\`
}

let questionFitRaf = 0
function scheduleQuestionFit(): void {
  if (questionFitRaf) cancelAnimationFrame(questionFitRaf)
  questionFitRaf = requestAnimationFrame(() => {
    fitQuestionText()
    requestAnimationFrame(fitQuestionText)
  })
}

let questionResizeObserver: ResizeObserver | null = null

onMounted(() => {
  if (questionWrapperRef.value) {
    questionResizeObserver = new ResizeObserver(() => scheduleQuestionFit())
    questionResizeObserver.observe(questionWrapperRef.value)
  }
  scheduleQuestionFit()
})

onUnmounted(() => {
  questionResizeObserver?.disconnect()
  if (questionFitRaf) cancelAnimationFrame(questionFitRaf)
})

watch(
  () => [props.questionText, props.imageUrl],
  () => nextTick(() => scheduleQuestionFit())
)`
)

applyAnchor(
  "ancora P3",
  `    <div class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
      <h2
        class="font-semibold break-words [overflow-wrap:anywhere] whitespace-normal"
        :class="[questionTextSizeClass, imageUrl ? 'text-left' : 'text-center']"
      >
        {{ questionText }}
      </h2>
    </div>`,
  `    <div ref="questionWrapperRef" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
      <h2
        ref="questionTextRef"
        class="font-semibold break-words [overflow-wrap:anywhere] whitespace-normal"
        :class="imageUrl ? 'text-left' : 'text-center'"
        :style="{ fontSize: fittedQuestionFontSize + 'px' }"
      >
        {{ questionText }}
      </h2>
    </div>`
)

if (hasCRLF) content = content.replace(/\n/g, "\r\n")
fs.writeFileSync(filePath, content, "utf8")
console.log("OK: QuestionPanel.vue atualizado.")
