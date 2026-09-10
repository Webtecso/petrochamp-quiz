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
  <div class="bg-white rounded-2xl shadow p-6 sm:p-8 text-center w-full" :class="imageUrl ? 'max-w-[600px]' : 'max-w-[520px]'">
    <div class="flex items-center justify-between mb-4 text-xs">
      <span class="bg-petro-primary/10 text-petro-primary px-2 py-1 rounded-full">EM JOGO</span>
      <span class="text-gray-400">PERGUNTA {{ questionNumber }} DE {{ totalQuestions }}</span>
    </div>

    <TimerRing :seconds="timeLeft" class="mb-6" />

    <div v-if="imageUrl" class="mb-4 overflow-hidden rounded-xl border border-gray-100 bg-gray-50 w-full h-[clamp(220px,35vh,420px)]">
      <img :src="imageUrl" alt="Imagem da pergunta" class="block w-full h-full object-cover object-center" />
    </div>

    <h2 class="text-lg font-semibold mb-6">{{ questionText }}</h2>

    <AnswerOptions
      :options="options"
      :correct-index="correctIndex"
      :team-a-answer="teamAAnswer"
      :team-b-answer="teamBAnswer"
      :team-a-correct="teamACorrect"
      :team-b-correct="teamBCorrect"
    />
  </div>
</template>
