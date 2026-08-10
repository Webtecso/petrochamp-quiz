<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useCampeonatoStore } from '../stores/campeonato'
import { playSelectSound, playCorrectSound, playWrongSound } from '../services/sound'
import LogoMark from '../components/LogoMark.vue'
import TimerRing from '../components/TimerRing.vue'

const route = useRoute()
const myTeam = computed(() => (route.query.team as 'A' | 'B') || 'A')
const teamName = computed(() => (route.query.teamName as string) || 'A tua equipa')
const opponentName = computed(() => (route.query.opponentName as string) || 'Equipa Adversária')

const store = useCampeonatoStore()

const myQuestion = computed(() => (myTeam.value === 'A' ? store.teamAQuestion : store.teamBQuestion))
const myAnswer = computed(() => (myTeam.value === 'A' ? store.teamAAnswer : store.teamBAnswer))
const opponentAnswer = computed(() => (myTeam.value === 'A' ? store.teamBAnswer : store.teamAAnswer))
const myCorrect = computed(() => (myTeam.value === 'A' ? store.teamACorrect : store.teamBCorrect))

const flashLabel = ref<string | null>(null)

function selectOption(label: string): void {
  if (!myQuestion.value || myAnswer.value) return
  flashLabel.value = label
  playSelectSound()
  setTimeout(() => {
    store.submitPlayerAnswer(myTeam.value, label)
    flashLabel.value = null
  }, 350)
}

watch(myCorrect, (value) => {
  if (value === true) playCorrectSound()
  else if (value === false) playWrongSound()
})

function optionClass(label: string): string {
  if (myAnswer.value === label && myCorrect.value === true) return 'bg-green-500 text-white border-green-500'
  if (myAnswer.value === label && myCorrect.value === false) return 'bg-red-500 text-white border-red-500'
  if (
    myCorrect.value === false &&
    myQuestion.value &&
    myQuestion.value.options.findIndex((o) => o.label === label) === myQuestion.value.correctIndex
  ) {
    return 'bg-green-500 text-white border-green-500'
  }
  if (flashLabel.value === label) return 'scale-95 bg-yellow-100 border-yellow-300'
  if (myAnswer.value && myAnswer.value !== label) return 'border-gray-100 text-gray-300'
  return 'border-gray-200 active:border-petro-primary'
}
</script>

<template>
  <div class="min-h-screen bg-petro-bg flex flex-col px-4 py-6 gap-4">
    <div class="flex justify-center">
      <LogoMark size="sm" />
    </div>

    <header class="flex items-center justify-between text-xs text-gray-400">
      <span>{{ teamName }} <span class="text-gray-300">vs {{ opponentName }}</span></span>
      <span class="flex items-center gap-1">
        <span class="w-2 h-2 rounded-full bg-green-500"></span> Online
      </span>
    </header>

    <div v-if="!myQuestion" class="flex-1 flex flex-col items-center justify-center gap-3 text-center">
      <p class="text-gray-400 text-sm">A aguardar o moderador iniciar a pergunta...</p>
    </div>

    <template v-else>
      <div class="flex items-center justify-center">
        <TimerRing :seconds="store.timeLeft" />
      </div>

      <div class="text-center flex flex-col items-center gap-1">
        <span v-if="!myAnswer" class="bg-petro-primary/10 text-petro-primary text-xs font-semibold px-3 py-1 rounded-full">
          Responde já
        </span>
        <template v-else>
          <span
            class="text-xs font-semibold px-3 py-1 rounded-full"
            :class="myCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'"
          >
            {{ myCorrect ? 'Acertaste! ✓' : 'Não foi desta vez ✕' }}
          </span>
          <span v-if="!opponentAnswer" class="text-[11px] text-gray-400">
            Aguardando resposta de {{ opponentName }}...
          </span>
        </template>
      </div>

      <img
        v-if="myQuestion.imageUrl"
        :src="myQuestion.imageUrl"
        alt="Imagem da pergunta"
        class="w-full max-h-40 object-cover rounded-xl"
      />

      <h2 class="text-base font-semibold text-center">{{ myQuestion.text }}</h2>

      <div class="flex flex-col gap-3">
        <button
          v-for="opt in myQuestion.options"
          :key="opt.label"
          class="flex items-center gap-3 border rounded-xl px-4 py-3 text-left transition-all duration-200"
          :class="optionClass(opt.label)"
          :disabled="!!myAnswer"
          @click="selectOption(opt.label)"
        >
          <span class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 bg-petro-primary/10 text-petro-primary">
            {{ opt.label }}
          </span>
          {{ opt.text }}
        </button>
      </div>
    </template>

    <div class="mt-auto pt-4 flex items-center justify-center gap-6 text-center">
      <div>
        <div class="text-xs text-gray-400">{{ teamName }}</div>
        <div class="font-bold text-petro-primary">{{ myTeam === 'A' ? store.teamAScore : store.teamBScore }}</div>
      </div>
      <div class="text-gray-300 text-xs">VS</div>
      <div>
        <div class="text-xs text-gray-400">{{ opponentName }}</div>
        <div class="font-bold text-gray-400">{{ myTeam === 'A' ? store.teamBScore : store.teamAScore }}</div>
      </div>
    </div>
  </div>
</template>
