<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import TimerRing from './TimerRing.vue'
import AnswerOptions from './AnswerOptions.vue'

interface Option {
  label: string
  text: string
}

const props = defineProps<{
  questionText: string
  options: Option[]
  questionNumber: number
  totalQuestions: number
  timeLeft: number
  correctIndex?: number
  imageUrl?: string
  teamAAnswer?: string | null
  teamBAnswer?: string | null
  teamACorrect?: boolean | null
  teamBCorrect?: boolean | null
}>()

const textLen = computed(() => props.questionText?.length ?? 0)
const hasImage = computed(() => !!props.imageUrl)

const cardWidthClass = computed(() => {
  const len = textLen.value
  if (hasImage.value) {
    if (len > 500) return 'w-full max-w-[min(100%,96vw)] sm:max-w-[min(100%,1100px)] lg:max-w-[min(100%,1280px)]'
    if (len > 220) return 'w-full max-w-[min(100%,96vw)] sm:max-w-[min(100%,1000px)] lg:max-w-[min(100%,1200px)]'
    return 'w-full max-w-[min(100%,96vw)] sm:max-w-[min(100%,860px)] md:max-w-[min(100%,960px)]'
  }
  if (len > 700) return 'w-full max-w-[min(100%,96vw)]'
  if (len > 400) return 'w-full max-w-[min(100%,96vw)] sm:max-w-[min(100%,960px)] lg:max-w-[min(100%,1120px)]'
  if (len > 200) return 'w-full max-w-[min(100%,96vw)] sm:max-w-[min(100%,760px)] md:max-w-[min(100%,880px)]'
  return 'w-full max-w-[min(100%,96vw)] sm:max-w-[480px] md:max-w-[560px]'
})

const cardPaddingClass = computed(() => {
  const len = textLen.value
  if (len > 600 || (hasImage.value && len > 300)) return 'p-3 sm:p-4 md:p-5'
  if (len > 300) return 'p-3 sm:p-4 md:p-5 lg:p-6'
  return 'p-4 sm:p-5 md:p-6 lg:p-8'
})

const questionWrapperRef = ref<HTMLElement | null>(null)
const questionTextRef = ref<HTMLElement | null>(null)
const fittedQuestionFontSize = ref(20)

const MAX_QUESTION_FONT = 56
const MIN_QUESTION_FONT = 10

function fitQuestionText(): void {
  const wrapper = questionWrapperRef.value
  const textEl = questionTextRef.value
  if (!wrapper || !textEl) return

  let lo = MIN_QUESTION_FONT
  let hi = MAX_QUESTION_FONT

  const fitsAt = (size: number): boolean => {
    textEl.style.fontSize = `${size}px`
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
  textEl.style.fontSize = `${fittedQuestionFontSize.value}px`
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

  // NOVO - a fonte Carlito e' custom (@font-face) e pode ainda nao estar
  // carregada quando o primeiro fit corre (sobretudo na 1a execucao apos
  // instalar, antes de qualquer cache de fontes do SO/Chromium). Se isso
  // acontecer, o texto e' medido com a fonte de fallback (mais estreita),
  // o fit calcula um tamanho maior do que cabe de verdade, e nunca mais
  // recalcula. Assim que as fontes ficam prontas, forcamos um novo fit.
  document.fonts?.ready?.then(() => {
    scheduleQuestionFit()
  })

onUnmounted(() => {
  questionResizeObserver?.disconnect()
  if (questionFitRaf) cancelAnimationFrame(questionFitRaf)
})

watch(
  () => [props.questionText, props.imageUrl],
  () => nextTick(() => scheduleQuestionFit())
)

/** Imagem mais alta; texto longo → um pouco mais baixa para equilibrar */
const imageBoxClass = computed(() => {
  const len = textLen.value
  if (len > 500) {
    return 'h-[min(28vh,320px)] lg:h-[min(32vh,420px)]'
  }
  if (len > 300) {
    return 'h-[min(32vh,360px)] lg:h-[min(36vh,460px)]'
  }
  return 'h-[min(36vh,400px)] lg:h-[min(40vh,520px)]'
})

const gapClass = computed(() => {
  const len = textLen.value
  if (len > 500 || (hasImage.value && len > 300)) return 'gap-2 sm:gap-2.5 md:gap-3'
  return 'gap-2.5 sm:gap-3 md:gap-4'
})
</script>

<template>
  <div
    class="bg-white rounded-2xl shadow flex flex-col min-h-0 max-h-[94vh] overflow-x-hidden"
    :class="[cardWidthClass, cardPaddingClass, gapClass]"
  >
    <div class="flex items-center justify-between text-[10px] sm:text-xs shrink-0">
      <span class="bg-petro-primary/10 text-petro-primary px-2 py-0.5 sm:py-1 rounded-full font-medium">
        EM JOGO
      </span>
      <span class="text-gray-400">
        PERGUNTA {{ questionNumber }} DE {{ totalQuestions }}
      </span>
    </div>

    <TimerRing
      :seconds="timeLeft"
      class="shrink-0 self-center scale-90 sm:scale-100"
      style="color: black;"
    />

    <!-- Sem fundo na div; imagem maior -->
    <div
      v-if="imageUrl"
      class="w-full shrink-0 flex items-center justify-center rounded-lg sm:rounded-xl overflow-hidden"
      :class="imageBoxClass"
    >
      <img
        :src="imageUrl"
        alt="Imagem da pergunta"
        class="w-full h-full object-contain object-center"
      />
    </div>

    <div ref="questionWrapperRef" class="flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain">
      <h2
        ref="questionTextRef"
        class="font-semibold break-words [overflow-wrap:anywhere] whitespace-pre-wrap text-justify"
        :class="imageUrl ? '' : 'text-center'"
        :style="{ fontSize: fittedQuestionFontSize + 'px' }"
      >
        {{ questionText }}
      </h2>
    </div>

    <div class="shrink-0 min-h-0 overflow-x-hidden">
      <AnswerOptions
        :options="options"
        :correct-index="correctIndex"
        :team-a-answer="teamAAnswer"
        :team-b-answer="teamBAnswer"
        :team-a-correct="teamACorrect"
        :team-b-correct="teamBCorrect"
      />
    </div>
  </div>
</template>