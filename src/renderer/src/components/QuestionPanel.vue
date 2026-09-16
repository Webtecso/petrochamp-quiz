<script setup lang="ts">
import TimerRing from './TimerRing.vue'
import AnswerOptions from './AnswerOptions.vue'

interface Option {
  label: string
  text: string
}

defineProps<{
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
</script>

<template>
  <div
    class="bg-white rounded-2xl shadow p-4 sm:p-6 md:p-8 text-center w-full flex flex-col min-h-0"
    :class="imageUrl ? 'max-w-[min(100%,720px)]' : 'max-w-[520px]'"
  >
    <div class="flex items-center justify-between mb-3 sm:mb-4 text-xs shrink-0">
      <span class="bg-petro-primary/10 text-petro-primary px-2 py-1 rounded-full">EM JOGO</span>
      <span class="text-gray-400">PERGUNTA {{ questionNumber }} DE {{ totalQuestions }}</span>
    </div>

    <TimerRing :seconds="timeLeft" class="mb-4 sm:mb-6 shrink-0 self-center" />
 
    <!-- Imagem responsiva: preenche a largura do painel, altura fluida -->
    <div
      v-if="imageUrl"
      class="mb-4 w-full shrink-0 overflow-hidden rounded-xl border border-gray-100 bg-slate-900"
      style="aspect-ratio: 16 / 10; max-height: min(42vh, 480px)"
    >
      <img
        :src="imageUrl"
        alt="Imagem da pergunta"
        class="block w-full h-full object-contain object-center"
      />
    </div>

    <h2 class="text-base sm:text-lg font-semibold mb-4 sm:mb-6 shrink-0">{{ questionText }}</h2>

    <div class="min-h-0">
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